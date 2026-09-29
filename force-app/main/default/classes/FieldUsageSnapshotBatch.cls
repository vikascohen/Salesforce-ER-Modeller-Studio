public without sharing class FieldUsageSnapshotBatch implements Database.Batchable<String>, Database.Stateful {
    private final Id runId;
    private Integer errorCount=0, dependencyCount=0;
    private List<String> errors=new List<String>();
    public FieldUsageSnapshotBatch(Id runId){ this.runId=runId; }
    public Iterable<String> start(Database.BatchableContext bc) {
        update new Field_Usage_Run__c(Id=runId,Status__c='Running',Started_At__c=System.now(),Heartbeat_At__c=System.now());
        List<String> names=new List<String>();
        for(String apiName: Schema.getGlobalDescribe().keySet()) {
            Schema.DescribeSObjectResult d=Schema.getGlobalDescribe().get(apiName).getDescribe();
            if(d.isAccessible() && d.isQueryable()) names.add(apiName);
        }
        names.sort();
        return names;
    }
    public void execute(Database.BatchableContext bc,List<String> objectNames) {
        List<Field_Usage_Evidence__c> evidence=new List<Field_Usage_Evidence__c>();
        for(String objectName:objectNames) {
            try { evidence.addAll(FieldUsageFormulaScanner.scan(runId,objectName)); }
            catch(Exception ex) { errorCount++; addError(objectName+': '+ex.getTypeName()+' - '+ex.getMessage()); }
        }
        if(!evidence.isEmpty()) {
            Database.SaveResult[] results=Database.insert(evidence,false);
            for(Database.SaveResult sr:results) {
                if(sr.isSuccess()) dependencyCount++;
                else { errorCount++; addError('Evidence insert: '+sr.getErrors()[0].getMessage()); }
            }
        }
        update new Field_Usage_Run__c(Id=runId,Heartbeat_At__c=System.now(),Error_Count__c=errorCount,Dependency_Count__c=dependencyCount);
    }
    public void finish(Database.BatchableContext bc) {
        try {
            Field_Usage_Run__c run=[SELECT Id,Status__c FROM Field_Usage_Run__c WHERE Id=:runId FOR UPDATE];
            List<Field_Usage_Run__c> old=[SELECT Id,Is_Current__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Id!=:runId];
            for(Field_Usage_Run__c r:old) r.Is_Current__c=false;
            if(!old.isEmpty()) update old;
            run.Status__c=errorCount==0?'Completed':'Completed With Errors';
            run.Completed_At__c=System.now(); run.Heartbeat_At__c=System.now(); run.Is_Current__c=true;
            run.Error_Count__c=errorCount; run.Dependency_Count__c=dependencyCount; run.Errors__c=String.join(errors,'\n');
            update run;
            if(!old.isEmpty()) Database.delete(old,false);
        } catch(Exception ex) {
            try { update new Field_Usage_Run__c(Id=runId,Status__c='Failed',Completed_At__c=System.now(),Errors__c=ex.getTypeName()+': '+ex.getMessage(),Is_Current__c=false); } catch(Exception ignored) {}
        }
    }
    private void addError(String message){ if(errors.size()<100) errors.add(message.left(500)); }
}