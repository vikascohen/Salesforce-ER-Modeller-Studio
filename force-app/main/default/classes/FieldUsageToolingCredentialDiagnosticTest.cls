@IsTest
private class FieldUsageToolingCredentialDiagnosticTest {
    private class ToolingMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            System.assertEquals('GET', req.getMethod());
            System.assert(req.getEndpoint().startsWith('callout:Salesforce_Tooling_API/services/data/v60.0/tooling/query/'));
            HttpResponse res=new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"01p000000000001AAA"}]}');
            return res;
        }
    }

    @IsTest static void reportsToolingCredentialResponse(){
        Test.setMock(HttpCalloutMock.class,new ToolingMock());
        Test.startTest();
        String result=FieldUsageToolingCredentialDiagnostic.run();
        Test.stopTest();
        System.assert(result.startsWith('STATUS = 200'));
        System.assert(result.contains('totalSize'));
    }
}
