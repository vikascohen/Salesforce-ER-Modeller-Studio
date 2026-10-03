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
        System.assert(dto.accessibleObjects>0);System.assert(dto.standardObjects>0);System.assertNotEquals(null,dto.namespacePrefix);System.assertNotEquals(null,dto.snapshotStatus);System.assertNotEquals(null,dto.enabledSchedules);
    }
    @IsTest static void systemInfoProjectsSnapshotAndSchedule(){
        insert new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Completed_At__c=System.now(),Dependency_Count__c=4,Error_Count__c=1,Progress_Percent__c=100,Progress_Phase__c='Snapshot ready');
        insert new Field_Usage_Schedule__c(Name='Diagnostics Schedule',Enabled__c=true,Hour__c=2,Minute__c=0);
        StudioDiagnosticsController.SystemInfoDTO dto=StudioDiagnosticsController.getSystemInfo();
        System.assertEquals(true,dto.snapshotAvailable);System.assertEquals('Completed',dto.snapshotStatus);System.assertEquals(4,dto.dependencyCount);System.assertEquals(1,dto.snapshotErrors);System.assertEquals(100,dto.scanProgressPercent);System.assertEquals('Snapshot ready',dto.scanPhase);System.assertEquals(1,dto.enabledSchedules);
    }
    @IsTest static void healthyDiagnosticsProveToolingConnection(){
        Test.setMock(HttpCalloutMock.class,new ToolingOkMock());Test.startTest();StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();Test.stopTest();
        System.assertEquals('Application Ready',dto.overallStatus);System.assert(dto.checks.size()>=6);Boolean toolingPassed=false;for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='tooling'&&c.status=='Passed')toolingPassed=true;System.assert(toolingPassed,'Tooling API must be proven by an authenticated preflight.');System.assert(dto.summary.contains('passed'));System.assertNotEquals(null,dto.completedAt);
    }
    @IsTest static void failedToolingConnectionIsActionable(){
        Test.setMock(HttpCalloutMock.class,new ToolingErrorMock());Test.startTest();StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();Test.stopTest();
        System.assertEquals('Configuration Required',dto.overallStatus);Boolean found=false;for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='tooling'&&c.status=='Failed'){found=true;System.assertNotEquals(null,c.diagnosis);System.assert(c.diagnosis.toLowerCase().contains('authentication')||c.diagnosis.toLowerCase().contains('configuration'));System.assert(c.actions.size()>=5);Boolean principalStep=false;for(String step:c.actions)if(step.contains('External Credential Principal Access'))principalStep=true;System.assert(principalStep,'Troubleshooting must explicitly call out External Credential Principal Access.');System.assertNotEquals(null,c.remediation);}System.assert(found);
    }
    @IsTest static void failedSnapshotProducesAttention(){
        insert new Field_Usage_Run__c(Status__c='Failed',Is_Current__c=false,Completed_At__c=System.now());
        Test.setMock(HttpCalloutMock.class,new ToolingOkMock());StudioDiagnosticsController.DiagnosticDTO dto=StudioDiagnosticsController.runDiagnostics();
        Boolean snapshotAttention=false;for(StudioDiagnosticsController.CheckDTO c:dto.checks)if(c.key=='snapshot'&&c.status=='Attention')snapshotAttention=true;
        System.assert(snapshotAttention,'A failed snapshot must be surfaced as an attention item.');
        System.assert(new Set<String>{'Attention Required','Configuration Required'}.contains(dto.overallStatus),'The overall status may also report configuration because Salesforce blocks the mocked Tooling callout after this test inserts the failed run.');
    }
}