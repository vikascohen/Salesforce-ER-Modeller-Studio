/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageOrchestratorTest {
    @IsTest static void preventsConcurrentRunWhenAsyncJobIsActive(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(
            Status__c='Running',
            Run_Type__c='Manual',
            Job_Id__c='707000000000001AAA'
        );
        insert run;
        FieldUsageOrchestrator.asyncJobActiveOverride=true;

        try{
            FieldUsageOrchestrator.ensureNoActiveRun();
            System.assert(false,'An active async job must prevent a duplicate scan.');
        }catch(FieldUsageOrchestrator.ScanAlreadyRunningException e){
            System.assert(e.getMessage().contains('already running'));
        }
    }

    @IsTest static void recoversRunWhoseAsyncJobNoLongerExists(){
        Field_Usage_Run__c abandoned=new Field_Usage_Run__c(
            Status__c='Running',
            Run_Type__c='Manual',
            Job_Id__c='707000000000001AAA'
        );
        insert abandoned;

        FieldUsageOrchestrator.ensureNoActiveRun();

        abandoned=[SELECT Status__c,Is_Current__c,Completed_At__c,Progress_Phase__c FROM Field_Usage_Run__c WHERE Id=:abandoned.Id];
        System.assertEquals('Failed',abandoned.Status__c);
        System.assertEquals(false,abandoned.Is_Current__c);
        System.assertNotEquals(null,abandoned.Completed_At__c);
        System.assertEquals('Aborted scan recovered',abandoned.Progress_Phase__c);
    }
}