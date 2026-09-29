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
}
