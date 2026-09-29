/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageWorkUnitBatchTest {
 @IsTest static void workUnitsCheckpointAndPromote(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Queued',Run_Type__c='Manual');insert run;
  insert new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c=run.Id+'|Formula|Account|Name',Scanner_Type__c='Formula',Target_Key__c='Account|Name',Status__c='Pending');
  Test.startTest();Database.executeBatch(new FieldUsageWorkUnitBatch(run.Id),1);Test.stopTest();
  Field_Usage_Work_Unit__c unit=[SELECT Status__c,Attempt_Count__c,Completed_At__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id LIMIT 1];
  System.assertEquals('Completed',unit.Status__c);System.assertEquals(1,unit.Attempt_Count__c);System.assertNotEquals(null,unit.Completed_At__c);
  System.assertEquals('Completed',[SELECT Status__c FROM Field_Usage_Run__c WHERE Id=:run.Id].Status__c);
 }
 @IsTest static void completedUnitsAreNotSelectedAgain(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
  insert new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c=run.Id+'|Formula|Account',Scanner_Type__c='Formula',Target_Key__c='Account',Status__c='Completed',Attempt_Count__c=1);
  Test.startTest();Database.executeBatch(new FieldUsageWorkUnitBatch(run.Id),1);Test.stopTest();
  System.assertEquals(1,[SELECT Attempt_Count__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id].Attempt_Count__c);
 }

 @IsTest static void unknownScannerRetriesOneAttemptAtATime(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
  insert new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c=run.Id+'|Unknown|1',Scanner_Type__c='Unknown',Target_Key__c='bad-target',Status__c='Pending');
  Test.startTest();Database.executeBatch(new FieldUsageWorkUnitBatch(run.Id),1);Test.stopTest();
  Field_Usage_Work_Unit__c unit=[SELECT Status__c,Attempt_Count__c,Last_Error__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id LIMIT 1];
  System.assertEquals(3,unit.Attempt_Count__c,'Each failed execution should consume exactly one retry attempt.');
  System.assertEquals('Failed',unit.Status__c);
  System.assert(unit.Last_Error__c.contains('Unsupported scanner type'));
 }

 private class ApexBodyMock implements HttpCalloutMock {
  public HttpResponse respond(HttpRequest request){HttpResponse response=new HttpResponse();response.setStatusCode(200);response.setBody('{"totalSize":1,"done":true,"records":[{"Id":"01p000000000001","Name":"AccountService","Body":"String x = Account.Name;"}]}');return response;}
 }
 @IsTest static void apexBulkWorkUnitPersistsEvidence(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
  insert new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c=run.Id+'|Apex|1',Scanner_Type__c='Apex Class Bulk',Target_Key__c='01p000000000001',Status__c='Pending');
  Test.setMock(HttpCalloutMock.class,new ApexBodyMock());
  Test.startTest();Database.executeBatch(new FieldUsageWorkUnitBatch(run.Id),1);Test.stopTest();
  Field_Usage_Work_Unit__c unit=[SELECT Status__c,Last_Error__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id LIMIT 1];
  System.assertEquals('Completed',unit.Status__c,'Apex work unit failed: '+unit.Last_Error__c);
  System.assertEquals(1,[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:run.Id AND Field_Key__c='Account.Name']);
 }
}