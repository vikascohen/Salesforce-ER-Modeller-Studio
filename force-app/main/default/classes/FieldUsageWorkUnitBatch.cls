/**
 * @author Vikas Cohen
 */
public without sharing class FieldUsageWorkUnitBatch implements Database.Batchable<SObject>, Database.Stateful, Database.AllowsCallouts {
    private static final Integer MAX_ATTEMPTS = 3;
    private final Id runId; private Integer completed=0, failed=0, dependencies=0; private List<String> errors=new List<String>();
    public FieldUsageWorkUnitBatch(Id runId){this.runId=runId;}
    public Database.QueryLocator start(Database.BatchableContext bc){
        return Database.getQueryLocator([SELECT Id,Scanner_Type__c,Target_Key__c,Status__c,Attempt_Count__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c IN ('Pending','Running') ORDER BY CreatedDate]);
    }
    public void execute(Database.BatchableContext bc,List<SObject> scope){
        for(SObject raw:scope){ Field_Usage_Work_Unit__c unit=(Field_Usage_Work_Unit__c)raw;
            unit.Status__c='Running';unit.Attempt_Count__c=(unit.Attempt_Count__c==null?0:unit.Attempt_Count__c)+1;update unit;
            Savepoint workUnitSavepoint=Database.setSavepoint();
            try{
                List<Field_Usage_Evidence__c> rows=scan(unit); Integer inserted=insertIdempotent(rows);dependencies+=inserted;
                unit.Status__c='Completed';unit.Completed_At__c=System.now();unit.Last_Error__c=null;update unit;completed++;
            }catch(Exception ex){
                Database.rollback(workUnitSavepoint);
                unit=[SELECT Id,Scanner_Type__c,Target_Key__c,Status__c,Attempt_Count__c FROM Field_Usage_Work_Unit__c WHERE Id=:unit.Id];
                unit.Last_Error__c=(ex.getTypeName()+': '+ex.getMessage()).left(4000); if(unit.Attempt_Count__c < MAX_ATTEMPTS){unit.Status__c='Pending';}else{unit.Status__c='Failed';failed++;if(errors.size()<100)errors.add(unit.Target_Key__c+': '+unit.Last_Error__c.left(500));} update unit;
            }
        }
        updateProgress();
    }
    private List<Field_Usage_Evidence__c> scan(Field_Usage_Work_Unit__c unit) {
        if (unit.Scanner_Type__c == 'Formula') {
            List<String> parts = unit.Target_Key__c.split('\\|');
            if (parts.size() == 2) {
                return FieldUsageFormulaScanner.scanField(runId, parts[0], parts[1]);
            }
        }

        if (unit.Scanner_Type__c == 'Flow Bulk') {
            String flowId=unit.Target_Key__c==null?null:unit.Target_Key__c.trim();
            return String.isBlank(flowId)
                ? new List<Field_Usage_Evidence__c>()
                : FieldUsageToolingApiClient.scanFlow(runId,flowId);
        }

        if (
            unit.Scanner_Type__c == 'Apex Class Bulk' ||
            unit.Scanner_Type__c == 'Apex Trigger Bulk'
        ) {
            Set<String> componentIds = new Set<String>();
            for (String componentId : unit.Target_Key__c.split(',')) {
                if (!String.isBlank(componentId)) {
                    componentIds.add(componentId.trim());
                }
            }

            if (componentIds.isEmpty()) {
                return new List<Field_Usage_Evidence__c>();
            }

            List<FieldUsageToolingApiClient.SourceComponent> components =
                unit.Scanner_Type__c == 'Apex Class Bulk'
                    ? FieldUsageToolingApiClient.getApexClasses(componentIds)
                    : FieldUsageToolingApiClient.getApexTriggers(componentIds);

            List<Field_Usage_Evidence__c> evidence = new List<Field_Usage_Evidence__c>();
            Integer heapLimit=Limits.getLimitHeapSize();
            for (FieldUsageToolingApiClient.SourceComponent component : components) {
                if(Limits.getHeapSize() > (heapLimit*80/100))
                    throw new FieldUsageWorkUnitException('Heap safety threshold reached before scanning all source components. Reduce the Tooling source chunk size.');
                evidence.addAll(
                    FieldUsageApexScanner.scan(
                        runId,
                        component.sourceType,
                        component.name,
                        component.id,
                        component.body
                    )
                );
                component.body=null;
            }
            components=null;
            return evidence;
        }

        throw new FieldUsageWorkUnitException('Unsupported scanner type: '+String.valueOf(unit.Scanner_Type__c));
    }

    private Integer insertIdempotent(List<Field_Usage_Evidence__c> rows){
        if(rows.isEmpty())return 0; Set<String> keys=new Set<String>();for(Field_Usage_Evidence__c r:rows)keys.add(r.Field_Key__c+'|'+r.Source_Type__c+'|'+r.Component_Name__c+'|'+r.Location__c);
        Map<String,Field_Usage_Evidence__c> existing=new Map<String,Field_Usage_Evidence__c>();
        for(Field_Usage_Evidence__c r:[SELECT Id,Field_Key__c,Source_Type__c,Component_Name__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__c=:runId AND Field_Key__c IN :new Set<String>(rowsFieldKeys(rows))])
            existing.put(r.Field_Key__c+'|'+r.Source_Type__c+'|'+r.Component_Name__c+'|'+r.Location__c,r);
        List<Field_Usage_Evidence__c> fresh=new List<Field_Usage_Evidence__c>();Set<String> seen=new Set<String>();for(Field_Usage_Evidence__c r:rows){String k=r.Field_Key__c+'|'+r.Source_Type__c+'|'+r.Component_Name__c+'|'+r.Location__c;if(!existing.containsKey(k)&&!seen.contains(k)){fresh.add(r);seen.add(k);}}
        if(fresh.isEmpty())return 0;Database.SaveResult[] results=Database.insert(fresh,false);Integer n=0;List<String> insertErrors=new List<String>();for(Database.SaveResult sr:results)if(sr.isSuccess())n++;else insertErrors.add(sr.getErrors()[0].getMessage());if(!insertErrors.isEmpty())throw new FieldUsageWorkUnitException('Evidence persistence failed: '+String.join(insertErrors,' | ').left(3500));return n;
    }
    public class FieldUsageWorkUnitException extends Exception {}\n    private static List<String> rowsFieldKeys(List<Field_Usage_Evidence__c> rows){List<String> out=new List<String>();for(Field_Usage_Evidence__c r:rows)out.add(r.Field_Key__c);return out;}
    private void updateProgress(){Integer total=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId];Integer done=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Completed'];Integer pct=total==0?95:Math.min(95,5+(done*90/total));Integer evidence=[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:runId];Integer failures=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Failed'];update new Field_Usage_Run__c(Id=runId,Heartbeat_At__c=System.now(),Objects_Processed__c=done,Objects_Total__c=total,Dependency_Count__c=evidence,Error_Count__c=failures,Progress_Percent__c=pct,Progress_Phase__c='Processing resumable work units');}
    public void finish(Database.BatchableContext bc){
        List<Field_Usage_Work_Unit__c> remaining=[SELECT Id,Status__c,Last_Error__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c IN ('Pending','Running')];Integer failures=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Failed'];
        AsyncApexJob job=[SELECT NumberOfErrors FROM AsyncApexJob WHERE Id=:bc.getJobId()];
        if(!remaining.isEmpty()&&job.NumberOfErrors>0){for(Field_Usage_Work_Unit__c unit:remaining){unit.Status__c='Failed';unit.Last_Error__c='Worker transaction rolled back before checkpoint completion. Review the scanner target and rerun after correction.';}update remaining;failures+=remaining.size();errors.add('One or more worker transactions were rolled back by the platform; the incomplete work units were retained and marked Failed.');}
        else if(!remaining.isEmpty()){Database.executeBatch(new FieldUsageWorkUnitBatch(runId),1);return;}
        FieldUsageSnapshotFinalizer.finish(runId,failures,errors);
    }
}