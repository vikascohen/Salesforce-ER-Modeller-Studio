public without sharing class FieldUsageSnapshotBatch implements Database.Batchable<String>, Database.Stateful {
    private final Id runId;
    private Integer errorCount=0, dependencyCount=0, processedCount=0, totalCount=0;
    private List<String> errors=new List<String>();
    public FieldUsageSnapshotBatch(Id runId){ this.runId=runId; }
    public Iterable<String> start(Database.BatchableContext bc) {
        update new Field_Usage_Run__c(Id=runId,Status__c='Running',Started_At__c=System.now(),Heartbeat_At__c=System.now());
        Map<String,Schema.SObjectType> gd=Schema.getGlobalDescribe();
        List<String> names=new List<String>();
        for(String apiName:gd.keySet()) {
            Schema.DescribeSObjectResult d=gd.get(apiName).getDescribe();
            if(d.isAccessible() && d.isQueryable()) names.add(apiName);
        }
        names.sort(); totalCount=names.size(); update new Field_Usage_Run__c(Id=runId,Objects_Total__c=totalCount,Progress_Percent__c=1,Progress_Phase__c='Discovering org metadata',Progress_Log__c=stamp('Discovered '+totalCount+' queryable objects. Starting dependency scanners.')); return names;
    }
    public void execute(Database.BatchableContext bc,List<String> objectNames) {
        List<Field_Usage_Evidence__c> evidence=new List<Field_Usage_Evidence__c>();
        for(String objectName:objectNames) {
            try { evidence.addAll(FieldUsageFormulaScanner.scan(runId,objectName)); }
            catch(Exception ex) { errorCount++; addError(objectName+': '+ex.getTypeName()+' - '+ex.getMessage()); }
        }
        processedCount+=objectNames.size();
        if(!evidence.isEmpty()) {
            for(Database.SaveResult sr:Database.insert(evidence,false)) {
                if(sr.isSuccess()) dependencyCount++;
                else { errorCount++; addError('Evidence insert: '+sr.getErrors()[0].getMessage()); }
            }
        }
        Integer pct=totalCount==0?95:Math.min(95,((processedCount*90)/totalCount)+5); Field_Usage_Run__c progress=[SELECT Id,Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:runId]; progress.Heartbeat_At__c=System.now(); progress.Error_Count__c=errorCount; progress.Dependency_Count__c=dependencyCount; progress.Objects_Processed__c=processedCount; progress.Progress_Percent__c=pct; progress.Progress_Phase__c='Scanning field dependencies'; progress.Progress_Log__c=appendLog(progress.Progress_Log__c,stamp('Scanned '+processedCount+' / '+totalCount+' objects · '+dependencyCount+' evidence records · '+errorCount+' errors.')); update progress;
    }
    public void finish(Database.BatchableContext bc) {
        try {
            AsyncApexJob job=[SELECT NumberOfErrors FROM AsyncApexJob WHERE Id=:bc.getJobId()];
            Integer totalErrors=errorCount+Integer.valueOf(job.NumberOfErrors);
            Field_Usage_Run__c run=[SELECT Id,Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:runId FOR UPDATE];
            if(totalErrors>0) {
                run.Status__c='Completed With Errors'; run.Completed_At__c=System.now(); run.Progress_Percent__c=100; run.Progress_Phase__c='Scan completed with errors'; run.Progress_Log__c=appendLog(run.Progress_Log__c,stamp('Scan completed with errors. Previous successful snapshot remains active.')); run.Heartbeat_At__c=System.now();
                run.Is_Current__c=false; run.Error_Count__c=totalErrors; run.Dependency_Count__c=dependencyCount;
                run.Errors__c=String.join(errors,'\n'); update run;
                return;
            }
            List<Field_Usage_Run__c> old=[SELECT Id,Is_Current__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Id!=:runId];
            for(Field_Usage_Run__c r:old) r.Is_Current__c=false;
            if(!old.isEmpty()) update old;
            run.Status__c='Completed'; run.Completed_At__c=System.now(); run.Progress_Percent__c=100; run.Progress_Phase__c='Snapshot ready'; run.Progress_Log__c=appendLog(run.Progress_Log__c,stamp('Snapshot validated and promoted successfully.')); run.Heartbeat_At__c=System.now(); run.Is_Current__c=true;
            run.Error_Count__c=0; run.Dependency_Count__c=dependencyCount; run.Errors__c=null; update run;
            if(!old.isEmpty()) Database.delete(old,false);
        } catch(Exception ex) {
            try { update new Field_Usage_Run__c(Id=runId,Status__c='Failed',Completed_At__c=System.now(),Errors__c=ex.getTypeName()+': '+ex.getMessage(),Is_Current__c=false); } catch(Exception ignored) {}
        }
    }
    private static String stamp(String message){return '['+System.now().format('HH:mm:ss')+'] '+message;}
    private static String appendLog(String existing,String line){String value=String.isBlank(existing)?line:existing+'\\n'+line;return value.length()>32000?value.right(32000):value;}
    private void addError(String message){ if(errors.size()<100) errors.add(message.left(500)); }
}