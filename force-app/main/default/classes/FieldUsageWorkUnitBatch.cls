public without sharing class FieldUsageWorkUnitBatch implements Database.Batchable<SObject>, Database.Stateful {
    private final Id runId; private Integer completed=0, failed=0, dependencies=0; private List<String> errors=new List<String>();
    public FieldUsageWorkUnitBatch(Id runId){this.runId=runId;}
    public Database.QueryLocator start(Database.BatchableContext bc){
        return Database.getQueryLocator([SELECT Id,Scanner_Type__c,Target_Key__c,Status__c,Attempt_Count__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c IN ('Pending','Running') ORDER BY CreatedDate]);
    }
    public void execute(Database.BatchableContext bc,List<Field_Usage_Work_Unit__c> scope){
        for(Field_Usage_Work_Unit__c unit:scope){
            unit.Status__c='Running';unit.Attempt_Count__c=(unit.Attempt_Count__c==null?0:unit.Attempt_Count__c)+1;update unit;
            try{
                List<Field_Usage_Evidence__c> rows=scan(unit); Integer inserted=insertIdempotent(rows);dependencies+=inserted;
                unit.Status__c='Completed';unit.Completed_At__c=System.now();unit.Last_Error__c=null;update unit;completed++;
            }catch(Exception ex){
                unit.Status__c='Failed';unit.Last_Error__c=(ex.getTypeName()+': '+ex.getMessage()).left(4000);update unit;failed++;if(errors.size()<100)errors.add(unit.Target_Key__c+': '+unit.Last_Error__c.left(500));
            }
        }
        updateProgress();
    }
    private List<Field_Usage_Evidence__c> scan(Field_Usage_Work_Unit__c unit){
        if(unit.Scanner_Type__c=='Formula'){List<String> parts=unit.Target_Key__c.split('\\|');if(parts.size()==2)return FieldUsageFormulaScanner.scanField(runId,parts[0],parts[1]);}
        return new List<Field_Usage_Evidence__c>();
    }
    private Integer insertIdempotent(List<Field_Usage_Evidence__c> rows){
        if(rows.isEmpty())return 0; Set<String> keys=new Set<String>();for(Field_Usage_Evidence__c r:rows)keys.add(r.Field_Key__c+'|'+r.Source_Type__c+'|'+r.Component_Name__c+'|'+r.Location__c);
        Map<String,Field_Usage_Evidence__c> existing=new Map<String,Field_Usage_Evidence__c>();
        for(Field_Usage_Evidence__c r:[SELECT Id,Field_Key__c,Source_Type__c,Component_Name__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__c=:runId AND Field_Key__c IN :new Set<String>(rowsFieldKeys(rows))])
            existing.put(r.Field_Key__c+'|'+r.Source_Type__c+'|'+r.Component_Name__c+'|'+r.Location__c,r);
        List<Field_Usage_Evidence__c> fresh=new List<Field_Usage_Evidence__c>();Set<String> seen=new Set<String>();for(Field_Usage_Evidence__c r:rows){String k=r.Field_Key__c+'|'+r.Source_Type__c+'|'+r.Component_Name__c+'|'+r.Location__c;if(!existing.containsKey(k)&&!seen.contains(k)){fresh.add(r);seen.add(k);}}
        if(fresh.isEmpty())return 0;Database.SaveResult[] results=Database.insert(fresh,false);Integer n=0;for(Database.SaveResult sr:results)if(sr.isSuccess())n++;else{failed++;if(errors.size()<100)errors.add('Evidence insert: '+sr.getErrors()[0].getMessage().left(450));}return n;
    }
    private static List<String> rowsFieldKeys(List<Field_Usage_Evidence__c> rows){List<String> out=new List<String>();for(Field_Usage_Evidence__c r:rows)out.add(r.Field_Key__c);return out;}
    private void updateProgress(){Integer total=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId];Integer done=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Completed'];Integer pct=total==0?95:Math.min(95,5+(done*90/total));Integer evidence=[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:runId];Integer failures=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Failed'];update new Field_Usage_Run__c(Id=runId,Heartbeat_At__c=System.now(),Objects_Processed__c=done,Objects_Total__c=total,Dependency_Count__c=evidence,Error_Count__c=failures,Progress_Percent__c=pct,Progress_Phase__c='Processing resumable work units');}
    public void finish(Database.BatchableContext bc){
        List<Field_Usage_Work_Unit__c> remaining=[SELECT Id,Status__c,Last_Error__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c IN ('Pending','Running')];Integer failures=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Failed'];
        AsyncApexJob job=[SELECT NumberOfErrors FROM AsyncApexJob WHERE Id=:bc.getJobId()];
        if(!remaining.isEmpty()&&job.NumberOfErrors>0){for(Field_Usage_Work_Unit__c unit:remaining){unit.Status__c='Failed';unit.Last_Error__c='Worker transaction rolled back before checkpoint completion. Review the scanner target and rerun after correction.';}update remaining;failures+=remaining.size();errors.add('One or more worker transactions were rolled back by the platform; the incomplete work units were retained and marked Failed.');}
        else if(!remaining.isEmpty()){Database.executeBatch(new FieldUsageWorkUnitBatch(runId),1);return;}
        FieldUsageSnapshotFinalizer.finish(runId,failures,errors);
    }
}