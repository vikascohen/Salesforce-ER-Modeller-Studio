/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageToolingDiscoveryBatchTest {
 @TestSetup static void setupRun(){insert new Field_Usage_Run__c(Status__c='Running',Run_Type__c='Manual');}
 private class IndexMock implements HttpCalloutMock {
  public HttpResponse respond(HttpRequest request){
   HttpResponse response=new HttpResponse();response.setStatusCode(200);
   if(request.getEndpoint().contains('ApexClass'))response.setBody('{"totalSize":2,"done":true,"records":[{"Id":"01p000000000001","Name":"One"},{"Id":"01p000000000002","Name":"Two"}]}');
   else response.setBody('{"totalSize":0,"done":true,"records":[]}');
   return response;
  }
 }
 @IsTest static void checkpointsBulkApexWorkUnit(){
  Field_Usage_Run__c run=[SELECT Id FROM Field_Usage_Run__c LIMIT 1];
  Test.setMock(HttpCalloutMock.class,new IndexMock());
  FieldUsageToolingDiscoveryBatch batch=new FieldUsageToolingDiscoveryBatch(run.Id);
  Integer sourceCount=0;for(String ignored:batch.start(null))sourceCount++;System.assertEquals(3,sourceCount);
  Test.startTest();
  Database.executeBatch(batch,1);
  Test.stopTest();
  List<Field_Usage_Work_Unit__c> units=[SELECT Scanner_Type__c,Target_Key__c,Status__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id];
  System.assertEquals(1,units.size());System.assertEquals('Apex Class Bulk',units[0].Scanner_Type__c);System.assertEquals('Pending',units[0].Status__c);
  System.assert(units[0].Target_Key__c.contains('01p000000000001'));System.assert(units[0].Target_Key__c.contains('01p000000000002'));
 }
}
