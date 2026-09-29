public with sharing class FieldUsageOrchestrator {
    public class ScanAlreadyRunningException extends Exception {}
    public static Id start(String runType) {
        List<Field_Usage_Run__c> active = [SELECT Id, Status__c FROM Field_Usage_Run__c WHERE Status__c IN ('Queued','Running') ORDER BY CreatedDate DESC LIMIT 1 FOR UPDATE];
        if (!active.isEmpty()) throw new ScanAlreadyRunningException('A field usage scan is already running. Please wait for it to finish.');
        Field_Usage_Run__c run = new Field_Usage_Run__c(Status__c='Queued', Run_Type__c=runType, Error_Count__c=0, Dependency_Count__c=0);
        insert run;
        Id jobId = FieldUsageWorkCoordinator.start(run.Id);
        run.Job_Id__c = jobId==null?null:String.valueOf(jobId);
        update run;
        return run.Id;
    }
    public static void startScheduled() {
        try { start('Scheduled'); }
        catch (ScanAlreadyRunningException ex) { System.debug(LoggingLevel.INFO, ex.getMessage()); }
    }
}