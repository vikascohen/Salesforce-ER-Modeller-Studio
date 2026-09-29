/**
 * @author Vikas Cohen
 */
public with sharing class FieldUsageOrchestrator {
    public class ScanAlreadyRunningException extends Exception {}
    public static Id start(String runType) {
        List<Field_Usage_Run__c> active = [SELECT Id,Status__c,Heartbeat_At__c,Started_At__c,CreatedDate,Job_Id__c FROM Field_Usage_Run__c WHERE Status__c IN ('Queued','Running') LIMIT 1 FOR UPDATE];
        if(!active.isEmpty()){
            Field_Usage_Run__c existing=active[0];
            Datetime lastActivity=existing.Heartbeat_At__c!=null?existing.Heartbeat_At__c:(existing.Started_At__c!=null?existing.Started_At__c:existing.CreatedDate);
            Boolean stale=lastActivity<System.now().addHours(-2);
            if(stale){
                existing.Status__c='Failed';existing.Is_Current__c=false;existing.Completed_At__c=System.now();existing.Progress_Phase__c='Abandoned scan recovered';existing.Errors__c='The scan had no heartbeat for more than two hours and was marked failed so a new scan could start.';update existing;
            }else throw new ScanAlreadyRunningException('A field usage scan is already running. Please wait for it to finish.');
        }
        Field_Usage_Run__c run = new Field_Usage_Run__c(Status__c='Queued', Run_Type__c=runType, Error_Count__c=0, Dependency_Count__c=0);
        insert run;
        Id jobId = Database.executeBatch(new FieldUsageDiscoveryBatch(run.Id),1);
        run.Job_Id__c = jobId==null?null:String.valueOf(jobId);
        update run;
        return run.Id;
    }
    public static void startScheduled() {
        try { start('Scheduled'); }
        catch (ScanAlreadyRunningException ex) { System.debug(LoggingLevel.INFO, ex.getMessage()); }
    }
}