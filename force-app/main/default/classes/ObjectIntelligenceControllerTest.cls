@IsTest
private class ObjectIntelligenceControllerTest {
    private class ToolingMock implements HttpCalloutMock {
        private Integer statusCode;
        private Boolean emptyEntity;
        private Boolean paginateLayout;
        ToolingMock(){this(200,false,false);}
        ToolingMock(Integer statusCode, Boolean emptyEntity, Boolean paginateLayout){
            this.statusCode=statusCode;this.emptyEntity=emptyEntity;this.paginateLayout=paginateLayout;
        }
        public HttpResponse respond(HttpRequest req){
            HttpResponse res=new HttpResponse();res.setStatusCode(statusCode);res.setHeader('Content-Type','application/json');
            if(statusCode<200||statusCode>=300){res.setBody('{"message":"mock failure"}');return res;}
            String endpoint=EncodingUtil.urlDecode(req.getEndpoint(),'UTF-8');
            if(endpoint.contains('/next-layout-page')){
                res.setBody('{"done":true,"records":[{"Id":"00h000000000002","Name":"Account Secondary Layout"}]}');
            }else if(endpoint.contains('FROM EntityDefinition')){
                res.setBody(emptyEntity?'{"done":true,"records":[]}':'{"done":true,"records":[{"DurableId":"Account"}]}');
            }else if(endpoint.contains('FROM Layout')){
                res.setBody(paginateLayout?'{"done":false,"nextRecordsUrl":"/services/data/v60.0/tooling/query/next-layout-page","records":[{"Id":"00h000000000001","Name":"Account Layout"}]}':'{"done":true,"records":[{"Id":"00h000000000001","Name":"Account Layout"}]}');
            }else if(endpoint.contains('FROM ApexTrigger')){
                res.setBody('{"done":true,"records":[{"Id":"01q000000000001","Name":"AccountTrigger","Status":"Active"},{"Id":"01q000000000002","Name":"OldAccountTrigger","Status":"Deleted"}]}');
            }else if(endpoint.contains('FROM ValidationRule')){
                res.setBody('{"done":true,"records":[{"Id":"03d000000000001","ValidationName":"Account_Check","Active":true},{"Id":"03d000000000002","ValidationName":"Legacy_Check","Active":false}]}');
            }else res.setBody('{"done":true,"records":[]}');
            return res;
        }
    }

    @IsTest static void loadsScopedMetadata(){
        Test.setMock(HttpCalloutMock.class,new ToolingMock());
        Test.startTest();
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');
        Test.stopTest();
        System.assertEquals(true,result.toolingLoaded);
        System.assertEquals(null,result.toolingMessage);
        System.assertEquals(1,result.layouts.size());
        System.assertEquals('Account Layout',result.layouts[0].name);
        System.assertEquals(2,result.triggers.size());
        System.assertEquals(true,result.triggers[0].active);
        System.assertEquals(false,result.triggers[1].active);
        System.assertEquals(2,result.validationRules.size());
        System.assertEquals(true,result.validationRules[0].active);
        System.assertEquals(false,result.validationRules[1].active);
        System.assertNotEquals(null,result.recordTypes);
        System.assertEquals(false,result.snapshotLoaded,'No current usage snapshot is required for metadata intelligence.');
    }

    @IsTest static void supportsToolingPagination(){
        Test.setMock(HttpCalloutMock.class,new ToolingMock(200,false,true));
        Test.startTest();
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');
        Test.stopTest();
        System.assertEquals(true,result.toolingLoaded);
        System.assertEquals(2,result.layouts.size());
        System.assertEquals('Account Secondary Layout',result.layouts[1].name);
    }

    @IsTest static void handlesMissingEntityDefinition(){
        Test.setMock(HttpCalloutMock.class,new ToolingMock(200,true,false));
        Test.startTest();
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');
        Test.stopTest();
        System.assertEquals(false,result.toolingLoaded);
        System.assertEquals(0,result.layouts.size());
        System.assertEquals('Object metadata was not returned by Tooling API.',result.toolingMessage);
    }

    @IsTest static void handlesToolingHttpFailureWithoutBreakingDescribeData(){
        Test.setMock(HttpCalloutMock.class,new ToolingMock(503,false,false));
        Test.startTest();
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');
        Test.stopTest();
        System.assertEquals(false,result.toolingLoaded);
        System.assert(result.toolingMessage!=null&&result.toolingMessage.contains('Tooling API HTTP 503'));
        System.assertNotEquals(null,result.recordTypes,'Native describe metadata must remain usable when Tooling API is unavailable.');
    }

    @IsTest static void handlesBlankObject(){
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('   ');
        System.assertEquals(false,result.toolingLoaded);
        System.assertEquals(0,result.layouts.size());
        System.assertEquals(0,result.triggers.size());
        System.assertEquals(0,result.validationRules.size());
    }

    @IsTest static void rejectsUnknownObject(){
        ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Definitely_Not_An_Object__c');
        System.assertEquals(0,result.layouts.size());
        System.assertEquals(false,result.toolingLoaded);
        System.assertEquals(false,result.snapshotLoaded);
    }
}