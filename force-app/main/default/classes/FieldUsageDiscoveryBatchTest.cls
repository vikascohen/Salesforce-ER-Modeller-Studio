/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageDiscoveryBatchTest {
 @IsTest static void startAndExecuteCheckpointDiscoverySafely(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Queued');insert run;
  FieldUsageDiscoveryBatch batch=new FieldUsageDiscoveryBatch(run.Id);
  Iterable<String> names=batch.start(null);
  System.assertNotEquals(null,names);
  batch.execute(null,new List<String>{'Account','DefinitelyMissing__c'});
  run=[SELECT Status__c,Heartbeat_At__c FROM Field_Usage_Run__c WHERE Id=:run.Id];
  System.assertEquals('Running',run.Status__c);System.assertNotEquals(null,run.Heartbeat_At__c);
 }
}
