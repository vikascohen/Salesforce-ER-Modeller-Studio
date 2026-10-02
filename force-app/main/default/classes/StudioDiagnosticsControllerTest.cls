@IsTest
private class StudioDiagnosticsControllerTest {
    private class ToolingOkMock implements HttpCalloutMock { public HTTPResponse respond(HTTPRequest req){System.assert(req.getEndpoint().startsWith('callout:Salesforce_Tooling_API/services/data/v60.0/tooling/query'));HttpResponse res=new HttpResponse();res.setStatusCode(200);res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"01p000000000001AAA"}]}');return res;} }
    private class ToolingErrorMock implements HttpCalloutMock { public HTTPResponse respond(HTTPRequest req){HttpResponse res=new HttpResponse();res.setStatusCode(401);res.setBody('Unauthorized');return res;} }

    @IsTest static void systemInfoIsReadOnlyAndOperationallyUseful(){
        Test.startTest();StudioDiagnosticsController.SystemInfoDTO dto=StudioDiagnosticsController.getSystemInfo();Test.stopTest();
        System.assertEquals('3',dto.studioVersion);System.assertEquals('v60.0',dto.toolingApiVersion);System.assertEquals('60.0',dto.salesforceApiVersion);
        System.assertEquals(UserInfo.getOrganizationId(),dto.organisationId);System.assertEquals(UserInfo.getUserName(),dto.runningUser);
        System.assertNotEquals(null,dto.organisationName);System.assertNotEquals(null,dto.organisationType);System.assertNotEquals(null,dto.environmentType);
        System.assertNotEquals(null,dto.runningUserName);System.assertNotEquals(null,dto.userType);System.assertNotEquals(null,dto.profileName);
        System.assertNotEquals(null,dto.timeZone);System.assertNotEquals(null,dto.locale);System.assertNotEquals(null,dto.language);System.assertNotEquals(null,dto.generatedAt);
    }
    @IsTest static void healthyDiagnosticsProveToolingConnection(){
        Test.setMock(HttpCalloutMock.class,new ToolingOkMock());Test.startTest();StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();Test.stopTest();
        System.assertNotEquals(null,dto.overallStatus);System.assert(dto.checks.size()>=6);Boolean toolingPassed=false;for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='tooling'&&c.status=='Passed')toolingPassed=true;System.assert(toolingPassed,'Tooling API must be proven by an authenticated preflight.');
    }
    @IsTest static void failedToolingConnectionIsActionable(){
        Test.setMock(HttpCalloutMock.class,new ToolingErrorMock());Test.startTest();StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();Test.stopTest();
        System.assertEquals('Configuration Required',dto.overallStatus);Boolean found=false;for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='tooling'&&c.status=='Failed'){found=true;System.assertNotEquals(null,c.diagnosis);System.assert(c.diagnosis.toLowerCase().contains('authentication')||c.diagnosis.toLowerCase().contains('principal'));System.assert(c.actions.size()>=10);Boolean principalStep=false;for(String step:c.actions)if(step.contains('External Credential Principal Access'))principalStep=true;System.assert(principalStep,'Troubleshooting must explicitly call out External Credential Principal Access.');}System.assert(found);
    }
}
