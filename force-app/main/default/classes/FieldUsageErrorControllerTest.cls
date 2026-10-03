@IsTest
private class FieldUsageErrorControllerTest {
    @IsTest static void returnsPersistedErrorDetail(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Failed',Error_Count__c=2,Progress_Phase__c='Tooling discovery',Errors__c='First error\nSecond error',Progress_Log__c='Started\nFailed',Objects_Processed__c=3,Objects_Total__c=10);
        insert run;
        Test.startTest();FieldUsageErrorController.ErrorDetailDTO dto=FieldUsageErrorController.getErrorDetail(run.Id);Test.stopTest();
        System.assertEquals(run.Id,dto.runId);System.assertEquals('Failed',dto.status);System.assertEquals(2,dto.errorCount);System.assertEquals('Tooling discovery',dto.phase);System.assert(dto.errors.contains('First error'));System.assert(dto.progressLog.contains('Failed'));System.assertEquals(3,dto.objectsProcessed);System.assertEquals(10,dto.objectsTotal);
    }
    @IsTest static void nullCountsProjectAsZero(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Failed');insert run;
        FieldUsageErrorController.ErrorDetailDTO dto=FieldUsageErrorController.getErrorDetail(run.Id);
        System.assertEquals(0,dto.errorCount);System.assertEquals(0,dto.objectsProcessed);System.assertEquals(0,dto.objectsTotal);
    }
    @IsTest static void rejectsMissingRunId(){
        try{FieldUsageErrorController.getErrorDetail(null);System.assert(false,'Expected missing run id validation');}catch(AuraHandledException expected){System.assert(true);}
    }
}