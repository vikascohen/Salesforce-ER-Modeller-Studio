/**
 * @author Vikas Cohen
 */
public with sharing class FieldUsageOrchestrator {
    public class ScanAlreadyRunningException extends Exception {}

    // Test seam for the AsyncApexJob status lookup. This avoids starting a
    // real batch merely to exercise the concurrency guard in an Apex test.
    @TestVisible private static Boolean asyncJobActiveOverride;

    public static Id start(String runType) {
        ensureNoActiveRun();
        FieldUsageToolingApiClient.assertConnectionReady();
        Field_Usage_Run__c run = new Field_Usage_Run__c(Status__c='Queued', Run_Type__c=runType, Error_Count__c=0, Dependency_Count__c=0);
        insert run;
        Id jobId = Database.executeBatch(new FieldUsageDiscoveryBatch(run.Id),1);
        run.Job_Id__c = jobId==null?null:String.valueOf(jobId);
        update run;
        return run.Id;
    }

    @TestVisible
    private static void ensureNoActiveRun() {
        List<Field_Usage_Run__c> active = [SELECT Id,Status__c,Heartbeat_At__c,Started_At__c,CreatedDate,Job_Id__c FROM Field_Usage_Run__c WHERE Status__c IN ('Queued','Running') LIMIT 1 FOR UPDATE];
        if(active.isEmpty()) return;

        Field_Usage_Run__c existing=active[0];
        Datetime lastActivity=existing.Heartbeat_At__c!=null?existing.Heartbeat_At__c:(existing.Started_At__c!=null?existing.Started_At__c:existing.CreatedDate);
        Boolean stale=lastActivity<System.now().addHours(-2);
        Boolean asyncJobStillActive=false;
        if(asyncJobActiveOverride!=null && Test.isRunningTest()){
            asyncJobStillActive=asyncJobActiveOverride;
        }else if(!String.isBlank(existing.Job_Id__c)){
            try{
                Id asyncJobId=(Id)existing.Job_Id__c;
                List<AsyncApexJob> jobs=[SELECT Id,Status FROM AsyncApexJob WHERE Id=:asyncJobId LIMIT 1];
                asyncJobStillActive=!jobs.isEmpty() && new Set<String>{'Holding','Queued','Preparing','Processing'}.contains(jobs[0].Status);
            }catch(Exception ignored){
                asyncJobStillActive=false;
            }
        }

        // A manually aborted/deleted async job must not leave the durable
        // run record blocking every future manual scan for two hours.
        if(stale || !asyncJobStillActive){
            existing.Status__c='Failed';
            existing.Is_Current__c=false;
            existing.Completed_At__c=System.now();
            existing.Progress_Phase__c=stale?'Abandoned scan recovered':'Aborted scan recovered';
            existing.Errors__c=stale
                ?'The scan had no heartbeat for more than two hours and was marked failed so a new scan could start.'
                :'The asynchronous scan job is no longer active. The stale run was marked failed so a new scan could start.';
            update existing;
            return;
        }
        throw new ScanAlreadyRunningException('A field usage scan is already running. Please wait for it to finish.');
    }

    public static void startScheduled() {
        try { start('Scheduled'); }
        catch (ScanAlreadyRunningException ex) { System.debug(LoggingLevel.INFO, ex.getMessage()); }
        catch (FieldUsageToolingApiClient.ToolingApiException ex) { System.debug(LoggingLevel.ERROR, ex.getMessage()); }
    }
}