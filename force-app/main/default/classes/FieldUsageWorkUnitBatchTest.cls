/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageWorkUnitBatchTest {
 @IsTest static void workUnitsAreReleasedAndPromote(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Queued',Run_Type__c='Manual',Objects_Total__c=1);insert run;
  insert new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c=run.Id+'|Formula|Account|Name',Scanner_Type__c='Formula',Target_Key__c='Account|Name',Status__c='Pending');
  Test.startTest();Database.executeBatch(new FieldUsageWorkUnitBatch(run.Id),1);Test.stopTest();
  System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id],'Successful work units must not consume snapshot storage.');
  Field_Usage_Run__c saved=[SELECT Status__c,Objects_Processed__c FROM Field_Usage_Run__c WHERE Id=:run.Id];
  System.assertEquals('Completed',saved.Status__c);System.assertEquals(1,saved.Objects_Processed__c);
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
  System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id],'Failed-run finalisation should release temporary work units.');
  Field_Usage_Run__c saved=[SELECT Status__c,Errors__c FROM Field_Usage_Run__c WHERE Id=:run.Id];
  System.assertEquals('Completed With Errors',saved.Status__c);System.assert(saved.Errors__c.contains('Unsupported scanner type'));
 }

 private class ApexBodyMock implements HttpCalloutMock {
  public HttpResponse respond(HttpRequest request){HttpResponse response=new HttpResponse();response.setStatusCode(200);response.setBody('{"totalSize":1,"done":true,"records":[{"Id":"01p000000000001","Name":"AccountService","Body":"String x = Account.Name;"}]}');return response;}
 }
 @IsTest static void apexBulkWorkUnitPersistsEvidence(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running',Objects_Total__c=1);insert run;
  insert new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c=run.Id+'|Apex|1',Scanner_Type__c='Apex Class Bulk',Target_Key__c='01p000000000001',Status__c='Pending');
  Test.setMock(HttpCalloutMock.class,new ApexBodyMock());
  Test.startTest();Database.executeBatch(new FieldUsageWorkUnitBatch(run.Id),1);Test.stopTest();
  System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id]);
  System.assertEquals(1,[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:run.Id AND Field_Key__c='Account.Name']);
 }
}