/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageToolingApiClientTest {
    private class ToolingMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);

            Boolean includesBody = request.getEndpoint().contains('Body');
            String bodyProperty = includesBody
                ? ',"Body":"String x = Account.Name;"'
                : '';

            response.setBody(
                '{"totalSize":2,"done":true,"records":[' +
                '{"attributes":{"type":"ApexClass"},"Id":"01p000000000001",' +
                '"Name":"AccountService"' + bodyProperty + '},' +
                '{"attributes":{"type":"ApexClass"},"Id":"01p000000000002",' +
                '"Name":"ContactService"' + bodyProperty + '}]}'
            );
            return response;
        }
    }

    @IsTest
    static void indexQueryDoesNotRequestSourceBody() {
        Test.setMock(HttpCalloutMock.class, new ToolingMock());

        List<FieldUsageToolingApiClient.SourceComponent> components =
            FieldUsageToolingApiClient.getApexClassIndex();

        System.assertEquals(2, components.size());
        System.assertEquals(null, components[0].body);
    }

    @IsTest
    static void bulkSourceQueryReturnsMultipleComponentsInOneCall() {
        Test.setMock(HttpCalloutMock.class, new ToolingMock());

        Test.startTest();
        List<FieldUsageToolingApiClient.SourceComponent> components =
            FieldUsageToolingApiClient.getApexClasses(
                new Set<String>{ '01p000000000001', '01p000000000002' }
            );
        Integer callouts = Limits.getCallouts();
        Test.stopTest();

        System.assertEquals(2, components.size());
        System.assertEquals('String x = Account.Name;', components[0].body);
        System.assertEquals(1, callouts);
    }

    private class DeletedFlowMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse response=new HttpResponse();response.setStatusCode(404);response.setBody('[{"errorCode":"NOT_FOUND","message":"Flow was deleted"}]');return response;
        }
    }

    @IsTest
    static void deletedFlowBetweenDiscoveryAndWorkerIsHarmless(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        Test.setMock(HttpCalloutMock.class,new DeletedFlowMock());
        Test.startTest();
        List<Field_Usage_Evidence__c> rows=FieldUsageToolingApiClient.scanFlow(run.Id,'301000000000099');
        Test.stopTest();
        System.assertEquals(0,rows.size(),'A Flow deleted after discovery should contribute no evidence rather than fail the snapshot.');
    }

    private class EmptyQueryMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse response=new HttpResponse();response.setStatusCode(200);response.setBody('{"totalSize":0,"done":true,"records":[]}');return response;
        }
    }

    @IsTest
    static void deletedApexComponentBetweenDiscoveryAndWorkerIsHarmless(){
        Test.setMock(HttpCalloutMock.class,new EmptyQueryMock());
        Test.startTest();
        List<FieldUsageToolingApiClient.SourceComponent> rows=FieldUsageToolingApiClient.getApexClasses(new Set<String>{'01p000000000099'});
        Test.stopTest();
        System.assertEquals(0,rows.size());
    }

    private class FlowMetadataMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse response=new HttpResponse();response.setStatusCode(200);
            if(request.getEndpoint().contains('/tooling/sobjects/Flow/'))
                response.setBody('{"Id":"301000000000001","MasterLabel":"Account Flow","Metadata":{"object":"Account","field":"Name"}}');
            else response.setBody('{"totalSize":1,"done":true,"records":[{"Id":"301000000000001","MasterLabel":"Account Flow","Status":"Active","VersionNumber":1}]}');
            return response;
        }
    }
    @IsTest static void flowIndexAndMetadataAreParsed(){
        Test.setMock(HttpCalloutMock.class,new FlowMetadataMock());
        System.assertEquals(1,FieldUsageToolingApiClient.getFlowIndex().size());
        List<Field_Usage_Evidence__c> evidence=FieldUsageToolingApiClient.scanFlow(null,'301000000000001');
        System.assertEquals(1,evidence.size());System.assertEquals('Account.Name',evidence[0].Field_Key__c);
    }
    private class ErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){HttpResponse response=new HttpResponse();response.setStatusCode(500);response.setBody('server failure');return response;}
    }
    @IsTest static void toolingHttpFailureIsExplicit(){
        Test.setMock(HttpCalloutMock.class,new ErrorMock());
        try{FieldUsageToolingApiClient.getApexTriggerIndex();System.assert(false,'Expected Tooling API exception');}
        catch(FieldUsageToolingApiClient.ToolingApiException ex){System.assert(ex.getMessage().contains('HTTP 500'));}
    }
}
