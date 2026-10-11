/**
 * @author Vikas Cohen
 */
@IsTest
private class ErMcpActionsTest {
    private static Field_Usage_Run__c run(Boolean current) {
        Field_Usage_Run__c r=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=current,Completed_At__c=System.now());
        insert r;return r;
    }
    private static Map<String,Object> parsed(String jsonValue) {return (Map<String,Object>)JSON.deserializeUntyped(jsonValue);}
    private static void config(Boolean enabled) {
        insert new MCP_Settings__c(Name='Default',Status_Enabled__c=enabled,Usage_Enabled__c=enabled,Changed_Enabled__c=enabled,Scan_Enabled__c=enabled,Cooldown_Hours__c=24);
    }
    @IsTest static void coreDefaultsAndGuardAndLog() {
        System.assertEquals(true,ErMcpCore.settings().Status_Enabled__c);
        ErMcpCore.requireEnabled(true);
        Boolean blocked=false;
        try {ErMcpCore.requireEnabled(false);} catch(ErMcpCore.DisabledException ex) {blocked=true;}
        System.assert(blocked);
        System.assertEquals(null,parsed(ErMcpCore.snapshotContext()).get('snapshotId'));
        ErMcpCore.logCall('Get Snapshot Status','Account.Name','Success',System.now().getTime(),null);
        Field_Usage_Run__c r=run(true);
        System.assertEquals(String.valueOf(r.Id),String.valueOf(parsed(ErMcpCore.snapshotContext()).get('snapshotId')));
    }
    @IsTest static void readOnlyActionsWithoutSnapshot() {
        ErMcpGetSnapshotStatus.Request status=new ErMcpGetSnapshotStatus.Request();
        System.assertEquals(null,parsed(ErMcpGetSnapshotStatus.invoke(new List<ErMcpGetSnapshotStatus.Request>{status})[0].result).get('snapshotId'));
        ErMcpGetFieldUsage.Request invalid=new ErMcpGetFieldUsage.Request();
        System.assert(parsed(ErMcpGetFieldUsage.invoke(new List<ErMcpGetFieldUsage.Request>{invalid})[0].result).containsKey('error'));
        ErMcpGetChangedFields.Request changed=new ErMcpGetChangedFields.Request();
        System.assertEquals(0,parsed(ErMcpGetChangedFields.invoke(new List<ErMcpGetChangedFields.Request>{changed})[0].result).get('successfulRuns'));
    }
    @IsTest static void disabledActionsAndUnauthorizedScan() {
        config(false);
        System.assert(parsed(ErMcpGetSnapshotStatus.invoke(new List<ErMcpGetSnapshotStatus.Request>{new ErMcpGetSnapshotStatus.Request()})[0].result).containsKey('error'));
        ErMcpGetFieldUsage.Request usage=new ErMcpGetFieldUsage.Request();usage.objectApiName='Account';usage.fieldApiName='Name';
        System.assert(parsed(ErMcpGetFieldUsage.invoke(new List<ErMcpGetFieldUsage.Request>{usage})[0].result).containsKey('error'));
        System.assert(parsed(ErMcpGetChangedFields.invoke(new List<ErMcpGetChangedFields.Request>{new ErMcpGetChangedFields.Request()})[0].result).containsKey('error'));
        System.assert(parsed(ErMcpRunScan.invoke(new List<ErMcpRunScan.Request>{new ErMcpRunScan.Request()})[0].result).containsKey('error'));
    }
    @IsTest static void fieldUsageActionWithSnapshot() {
        Field_Usage_Run__c r=run(true);
        insert new Field_Usage_Evidence__c(Run__c=r.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='Example',Evidence_Type__c='Apex Source Reference',Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=1);
        ErMcpGetFieldUsage.Request req=new ErMcpGetFieldUsage.Request();req.objectApiName='Account';req.fieldApiName='Name';req.pageSize=1;
        Map<String,Object> result=parsed(ErMcpGetFieldUsage.invoke(new List<ErMcpGetFieldUsage.Request>{req})[0].result);
        System.assertEquals('Account.Name',result.get('field'));
        System.assertEquals(1,((List<Object>)result.get('usage')).size());
    }
    @IsTest static void changedFieldsComparesEvidence() {
        Field_Usage_Run__c older=run(false);
        insert new Field_Usage_Evidence__c(Run__c=older.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='OldClass',Evidence_Type__c='Apex Source Reference',Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=1);
        Field_Usage_Run__c newer=run(true);
        insert new Field_Usage_Evidence__c(Run__c=newer.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='NewClass',Evidence_Type__c='Apex Source Reference',Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=1);
        Map<String,Object> result=parsed(ErMcpGetChangedFields.invoke(new List<ErMcpGetChangedFields.Request>{new ErMcpGetChangedFields.Request()})[0].result);
        System.assertEquals(2,result.get('successfulRuns'));
        System.assertEquals(1,((List<Object>)result.get('comparisons')).size());
    }
    @IsTest static void adminAccessIsEnforced() {
        User unassigned=integrationUser();
        System.runAs(unassigned) {
            Boolean denied=false;
            try {ErMcpSettingsController.getSettings();}catch(Exception ex){denied=true;}
            System.assert(denied,'Unassigned user must not administer MCP');
            denied=false;
            try {ErMcpSettingsController.saveSettings(true,true,true,true,24);}catch(Exception ex){denied=true;}
            System.assert(denied);
        }
    }
    private static User integrationUser() {
        User u=new User(Alias='ermcp',Email='ermcp@example.com',EmailEncodingKey='UTF-8',LastName='McpTest',LanguageLocaleKey='en_US',LocaleSidKey='en_US',TimeZoneSidKey='Pacific/Auckland',ProfileId=UserInfo.getProfileId(),Username='ermcp.'+String.valueOf(System.now().getTime())+'@example.com');
        insert u;return u;
    }
    @IsTest static void adminSettingsAndDiagnostics() {
        User u=integrationUser();
        PermissionSet admin=[SELECT Id FROM PermissionSet WHERE Name='Diagram_Studio_User' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=admin.Id);
        System.runAs(u) {
            System.assertEquals(true,ErMcpSettingsController.getSettings().Status_Enabled__c);
            Boolean invalid=false;
            try {ErMcpSettingsController.saveSettings(true,true,true,true,-1);}catch(Exception ex){invalid=true;}
            System.assert(invalid);
            ErMcpSettingsController.saveSettings(true,true,true,false,0);
            System.assertEquals(false,ErMcpSettingsController.getSettings().Scan_Enabled__c);
            ErMcpCore.logCall('Get Field Usage','Account.Name','Success',System.now().getTime(),null);
        }
    }
    @IsTest static void scanOperatorBlockedByActiveRun() {
        User u=integrationUser();
        PermissionSet operatorSet=[SELECT Id FROM PermissionSet WHERE Name='Diagram_Studio_User' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=operatorSet.Id);
        System.runAs(u) {
            insert new Field_Usage_Run__c(Status__c='Running',Is_Current__c=false);
            Map<String,Object> result=parsed(ErMcpRunScan.invoke(new List<ErMcpRunScan.Request>{new ErMcpRunScan.Request()})[0].result);
            System.assert(String.valueOf(result.get('error')).contains('already running'),String.valueOf(result));
        }
    }
    @IsTest static void scanOperatorCooldown() {
        User u=integrationUser();
        PermissionSet operatorSet=[SELECT Id FROM PermissionSet WHERE Name='Diagram_Studio_User' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=operatorSet.Id);
        System.runAs(u) {
            run(true);
            Map<String,Object> result=parsed(ErMcpRunScan.invoke(new List<ErMcpRunScan.Request>{new ErMcpRunScan.Request()})[0].result);
            System.assert(String.valueOf(result.get('error')).contains('cooldown'),String.valueOf(result));
        }
    }
}
