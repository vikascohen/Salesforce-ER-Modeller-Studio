/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageOrchestratorTest {
    @IsTest static void allowsRunWhenNothingIsActive(){
        FieldUsageOrchestrator.ensureNoActiveRun();
        System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Run__c WHERE Status__c IN ('Queued','Running')]);
    }

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

    @IsTest static void recoversStaleRunEvenWhenAsyncJobAppearsActive(){
        Field_Usage_Run__c staleRun=new Field_Usage_Run__c(
            Status__c='Running',
            Run_Type__c='Manual',
            Job_Id__c='707000000000001AAA'
        );
        insert staleRun;
        Test.setCreatedDate(staleRun.Id,System.now().addHours(-3));
        FieldUsageOrchestrator.asyncJobActiveOverride=true;

        FieldUsageOrchestrator.ensureNoActiveRun();

        staleRun=[SELECT Status__c,Is_Current__c,Completed_At__c,Progress_Phase__c,Errors__c FROM Field_Usage_Run__c WHERE Id=:staleRun.Id];
        System.assertEquals('Failed',staleRun.Status__c);
        System.assertEquals(false,staleRun.Is_Current__c);
        System.assertNotEquals(null,staleRun.Completed_At__c);
        System.assertEquals('Abandoned scan recovered',staleRun.Progress_Phase__c);
        System.assert(staleRun.Errors__c.contains('no heartbeat'));
    }
}