/** @author Vikas Cohen */
@IsTest
private class FieldUsageToolingDiscoveryBatchTest {
 @TestSetup static void setupRun(){insert new Field_Usage_Run__c(Status__c='Running',Run_Type__c='Manual');}
 private class IndexMock implements HttpCalloutMock {public HttpResponse respond(HttpRequest request){HttpResponse r=new HttpResponse();r.setStatusCode(200);String e=request.getEndpoint();if(e.contains('ApexClass'))r.setBody('{"totalSize":2,"done":true,"records":[{"Id":"01p000000000001","Name":"One"},{"Id":"01p000000000002","Name":"Two"}]}');else if(e.contains('ApexTrigger'))r.setBody('{"totalSize":1,"done":true,"records":[{"Id":"01q000000000001","Name":"Trig"}]}');else if(e.contains('FlowDefinition'))r.setBody('{"totalSize":1,"done":true,"records":[{"Id":"300000000000001","DeveloperName":"F","MasterLabel":"F","ActiveVersionId":"301000000000001"}]}');else if(e.contains('LightningComponentBundle'))r.setBody('{"totalSize":1,"done":true,"records":[{"Id":"0Rb000000000001","DeveloperName":"LwcOne"}]}');else if(e.contains('AuraDefinitionBundle'))r.setBody('{"totalSize":1,"done":true,"records":[{"Id":"0Ab000000000001","DeveloperName":"AuraOne"}]}');else if(e.contains('ValidationRule'))r.setBody('{"totalSize":1,"done":true,"records":[{"Id":"03d000000000001","ValidationName":"VR","Active":true,"EntityDefinition":{"QualifiedApiName":"Account"}}]}');else r.setBody('{"totalSize":0,"done":true,"records":[]}');return r;}}
 @IsTest static void checkpointsAllBulkWorkUnits(){
   Field_Usage_Run__c run=[SELECT Id FROM Field_Usage_Run__c LIMIT 1];Test.setMock(HttpCalloutMock.class,new IndexMock());
   FieldUsageToolingDiscoveryBatch batch=new FieldUsageToolingDiscoveryBatch(run.Id);Integer sourceCount=0;for(String ignored:batch.start(null))sourceCount++;System.assertEquals(6,sourceCount,'Persisted Field Usage discovery must contain only dependency sources; layouts and record types are loaded on demand.');
   FieldUsageToolingDiscoveryBatch.suppressWorkerChainForTest=true;Test.startTest();Database.executeBatch(batch,6);Test.stopTest();
   List<Field_Usage_Work_Unit__c> units=[SELECT Scanner_Type__c,Target_Key__c,Status__c FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id];
   Set<String> types=new Set<String>();for(Field_Usage_Work_Unit__c u:units){types.add(u.Scanner_Type__c);System.assertEquals('Pending',u.Status__c);System.assert(!String.isBlank(u.Target_Key__c));}
   System.assert(types.containsAll(new Set<String>{'Apex Class Bulk','Apex Trigger Bulk','Flow Bulk','LWC Bulk','Aura Bulk','Validation Rule Bulk'}));
   System.assert(!types.contains('Page Layout Bulk'),'Page layouts must not consume snapshot storage.');
 }
}