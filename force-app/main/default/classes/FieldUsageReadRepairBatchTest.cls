@IsTest
private class FieldUsageReadRepairBatchTest {
    @TestSetup static void prepareCompletedScan() {
        insert new Field_Usage_Run__c(Status__c='Completed', Run_Type__c='Manual',
            Tracks_Skips__c=true, Progress_Phase__c=FieldUsageReadRepairBatch.ACTIVE);
    }

    private class ToolingResponse implements HttpCalloutMock {
        private Integer code;
        ToolingResponse(Integer code) { this.code = code; }
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(code);
            response.setBody('{}');
            return response;
        }
    }

    // Use a fresh transaction for the finish step. Salesforce tests permit one batch launch.
    private class FinishTransaction implements Queueable, Database.AllowsCallouts {
        private FieldUsageReadRepairBatch repair;
        FinishTransaction(FieldUsageReadRepairBatch repair) { this.repair = repair; }
        public void execute(QueueableContext context) {
            repair.completeReview();
            // Assert the handoff without executing the entire chained discovery pipeline.
            for (Field_Usage_Run__c child : [SELECT Job_Id__c FROM Field_Usage_Run__c WHERE Run_Type__c='Verification']) {
                System.abortJob((Id)child.Job_Id__c);
            }
        }
    }

    @IsTest static void grantsQueueOneVerification() {
        Field_Usage_Run__c parent = [SELECT Id FROM Field_Usage_Run__c LIMIT 1];
        Test.setMock(HttpCalloutMock.class, new ToolingResponse(200));
        FieldUsageReadRepairBatch repair = new FieldUsageReadRepairBatch(parent.Id);
        repair.changed = 2;
        Test.startTest();
        System.enqueueJob(new FinishTransaction(repair));
        Test.stopTest();
        System.assertEquals(1, [SELECT COUNT() FROM Field_Usage_Run__c WHERE Run_Type__c='Verification'], [SELECT Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:parent.Id].Progress_Log__c);
        System.assertEquals('Read repair complete; verification queued',
            [SELECT Progress_Phase__c FROM Field_Usage_Run__c WHERE Id=:parent.Id].Progress_Phase__c);
    }

    @IsTest static void noChangeEndsWithoutAnotherScan() {
        Id parent = [SELECT Id FROM Field_Usage_Run__c LIMIT 1].Id;
        new FieldUsageReadRepairBatch(parent).completeReview();
        System.assertEquals(1, [SELECT COUNT() FROM Field_Usage_Run__c]);
    }

    @IsTest static void toolingFailureDuringVerificationRemainsVisible() {
        Id parent = [SELECT Id FROM Field_Usage_Run__c LIMIT 1].Id;
        Test.setMock(HttpCalloutMock.class, new ToolingResponse(403));
        FieldUsageReadRepairBatch repair = new FieldUsageReadRepairBatch(parent);
        repair.changed = 1;
        Test.startTest();
        Database.executeBatch(repair,1);
        Test.stopTest();
        System.assertEquals(1, [SELECT COUNT() FROM Field_Usage_Run__c]);
        Field_Usage_Run__c result = [SELECT Progress_Phase__c, Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:parent];
        System.assertEquals('Read repair needs attention', result.Progress_Phase__c);
        System.assert(result.Progress_Log__c.contains('403'), result.Progress_Log__c);
    }
}
