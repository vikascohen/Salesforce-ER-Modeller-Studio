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
}