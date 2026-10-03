@IsTest
private class ObjectIntelligenceControllerTest {
    private class ToolingMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req){
            HttpResponse res=new HttpResponse();res.setStatusCode(200);res.setHeader('Content-Type','application/json');
            String endpoint=EncodingUtil.urlDecode(req.getEndpoint(),'UTF-8');
            if(endpoint.contains('FROM EntityDefinition'))res.setBody('{"done":true,"records":[{"DurableId":"Account"}]}');
            else if(endpoint.contains('FROM Layout'))res.setBody('{"done":true,"records":[{"Id":"00h000000000001","Name":"Account Layout"}]}');
            else if(endpoint.contains('FROM ApexTrigger'))res.setBody('{"done":true,"records":[{"Id":"01q000000000001","Name":"AccountTrigger","Status":"Active"}]}');
            else if(endpoint.contains('FROM ValidationRule'))res.setBody('{"done":true,"records":[{"Id":"03d000000000001","ValidationName":"Account_Check","Active":true}]}');
            else res.setBody('{"done":true,"records":[]}');
            return res;
        }
    }
    @IsTest static void loadsScopedMetadata(){
        Test.setMock(HttpCalloutMock.class,new ToolingMock());
        Test.startTest();ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');Test.stopTest();
        System.assertEquals(true,result.toolingLoaded);
        System.assertEquals(1,result.layouts.size());
        System.assertEquals('Account Layout',result.layouts[0].name);
        System.assertEquals(1,result.triggers.size());
        System.assertEquals(true,result.triggers[0].active);
        System.assertEquals(1,result.validationRules.size());
    }
    @IsTest static void rejectsUnknownObject(){
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Definitely_Not_An_Object__c');
        System.assertEquals(0,result.layouts.size());
        System.assertEquals(false,result.toolingLoaded);
    }
}