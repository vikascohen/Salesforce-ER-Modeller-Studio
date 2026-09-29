/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageToolingApiClientTest {
    private class ToolingMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);

            if (request.getEndpoint().contains('/tooling/query/')) {
                response.setBody(
                    '{"totalSize":1,"done":true,"records":[' +
                    '{"attributes":{"type":"ApexClass"},"Id":"01p000000000001",' +
                    '"Name":"AccountService","Body":"String x = Account.Name;"}]}'
                );
            } else {
                response.setBody(
                    '{"Id":"01p000000000001","Name":"AccountService",' +
                    '"Body":"String x = Account.Name;"}'
                );
            }
            return response;
        }
    }

    @IsTest
    static void readsToolingQueryAndIndividualSource() {
        Test.setMock(HttpCalloutMock.class, new ToolingMock());

        List<FieldUsageToolingApiClient.SourceComponent> components =
            FieldUsageToolingApiClient.getApexClasses();
        System.assertEquals(1, components.size());
        System.assertEquals('AccountService', components[0].name);

        FieldUsageToolingApiClient.SourceComponent component =
            FieldUsageToolingApiClient.getApexClass('01p000000000001');
        System.assertEquals('String x = Account.Name;', component.body);
        System.assertEquals('Apex Class', component.sourceType);
    }
}
