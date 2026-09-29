/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageOrchestratorTest {
 @IsTest static void preventsConcurrentRun(){insert new Field_Usage_Run__c(Status__c='Running',Run_Type__c='Manual');try{FieldUsageOrchestrator.start('Manual');System.assert(false);}catch(FieldUsageOrchestrator.ScanAlreadyRunningException e){System.assert(e.getMessage().contains('already running'));}}
}