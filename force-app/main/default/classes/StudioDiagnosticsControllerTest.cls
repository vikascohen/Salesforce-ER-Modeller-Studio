@IsTest
private class StudioDiagnosticsControllerTest {
    private class ToolingOkMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req){
            System.assert(req.getEndpoint().startsWith('callout:Salesforce_Tooling_API/services/data/v60.0/tooling/query'));
            HttpResponse res=new HttpResponse();res.setStatusCode(200);res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"01p000000000001AAA"}]}');return res;
        }
    }
    @IsTest static void systemInfoIsReadOnlyAndVersioned(){
        Test.startTest();StudioDiagnosticsController.SystemInfoDTO dto=StudioDiagnosticsController.getSystemInfo();Test.stopTest();
        System.assertEquals('3',dto.studioVersion);
        System.assertEquals('v60.0',dto.toolingApiVersion);
        System.assertEquals('60.0',dto.salesforceApiVersion);
        System.assertNotEquals(null,dto.organisationId);
        System.assertNotEquals(null,dto.environmentType);
    }
    @IsTest static void healthyDiagnosticsProveToolingConnection(){
        Test.setMock(HttpCalloutMock.class,new ToolingOkMock());
        Test.startTest();StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();Test.stopTest();
        System.assertNotEquals(null,dto.overallStatus);
        System.assert(dto.checks.size()>=6);
        Boolean toolingPassed=false;
        for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='tooling'&&c.status=='Passed')toolingPassed=true;
        System.assert(toolingPassed,'Tooling API must be proven by an authenticated preflight.');
    }
    @IsTest static void failedToolingConnectionIsActionable(){
        Test.setMock(HttpCalloutMock.class,new FieldUsageToolingApiClientTest.ErrorMock(401,'Unauthorized'));
        Test.startTest();StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();Test.stopTest();
        System.assertEquals('Configuration Required',dto.overallStatus);
        Boolean found=false;
        for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='tooling'&&c.status=='Failed'){found=true;System.assert(c.remediation.contains('Help')); }
        System.assert(found);
    }
}