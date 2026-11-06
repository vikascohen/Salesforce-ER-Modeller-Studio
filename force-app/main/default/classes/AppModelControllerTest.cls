@IsTest private class AppModelControllerTest {
    private class ApiMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse response=new HttpResponse();response.setStatusCode(200);
            String decoded=EncodingUtil.urlDecode(request.getEndpoint(),'UTF-8');
            if(decoded.contains('FROM LightningComponentBundle')){response.setBody('{"done":true,"records":[{"Id":"0Rb000000000001","DeveloperName":"salesPanel"}]}');return response;}
            if(decoded.contains('FROM ApexClass')){response.setBody('{"done":true,"records":[{"Id":"01p000000000001","Name":"SalesService"}]}');return response;}
            if(request.getEndpoint().contains('/tooling/query/'))response.setBody('{"done":true,"records":[{"MetadataComponentName":"salesPanel","MetadataComponentType":"LightningComponentBundle","RefMetadataComponentName":"SalesService","RefMetadataComponentType":"ApexClass"},{"MetadataComponentName":"salesPanel","MetadataComponentType":"ApexClass","RefMetadataComponentName":"Lead","RefMetadataComponentType":"StandardEntity"}]}');
            else if(request.getEndpoint().contains('/apps/'))response.setBody('{"label":"Sales","developerName":"Sales","navItems":[{"objectApiName":"Account","apiName":"standard-Account"},{"apiName":"Home"}]}');
            else response.setBody('{"apps":[{"appId":"06m000000000001","label":"Sales"}]}');return response;
        }
    }
    private static AppModelController.Component comp(String type,String name){AppModelController.Component c=new AppModelController.Component();c.type=type;c.name=name;return c;}
    @IsTest static void appListAndNavigationScope(){
        Test.setMock(HttpCalloutMock.class,new ApiMock());System.assertEquals(1,AppModelController.listApps().size());
        AppModelController.Scope scope=AppModelController.getAppScope('06m000000000001',false);System.assertEquals('Sales',scope.appLabel);System.assertEquals(3,scope.components.size());System.assertEquals(null,scope.runId);
    }
    @IsTest static void oldSnapshotRequiresRescan(){
        insert new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true);
        Test.setMock(HttpCalloutMock.class,new ApiMock());Boolean rejected=false;
        Test.startTest();try{AppModelController.getAppScope('06m000000000001',true);}catch(AuraHandledException expected){rejected=true;}Test.stopTest();System.assert(rejected);
    }
    @IsTest static void scopedEvidenceAndAutomation(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Object_Scan_Version__c=5);insert run;
        insert new List<Object_Usage_Evidence__c>{
            new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='ApexClass',Component_Name__c='SalesService',Target_Type__c='Object',Target_Name__c='Opportunity',Evidence__c='SOQL'),
            new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='ApexClass',Component_Name__c='Unrelated',Target_Type__c='Object',Target_Name__c='Lead'),
            new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='Flow',Component_Name__c='AccountFlow',Target_Type__c='Object',Target_Name__c='Contact',Entry_Object__c='Account')
        };
        Test.setMock(HttpCalloutMock.class,new ApiMock());
        Test.startTest();AppModelController.Expansion expansion=AppModelController.expandScope(run.Id,new List<AppModelController.Component>{comp('ApexClass','SalesService'),comp('Object','Account')},null,true);
        Set<String> names=new Set<String>();for(AppModelController.Component c:expansion.components)names.add(c.name);
        System.assert(names.containsAll(new Set<String>{'Opportunity','AccountFlow','Contact'}));System.assert(!names.contains('Lead'));
        expansion=AppModelController.expandScope(run.Id,new List<AppModelController.Component>{comp('Object','Account')},null,false);System.assertEquals(0,expansion.components.size());Test.stopTest();
    }
    @IsTest static void dependencyTypesDoNotLeakAcrossSameNamedComponents(){
        Test.setMock(HttpCalloutMock.class,new ApiMock());AppModelController.Expansion result=AppModelController.expandScope(null,new List<AppModelController.Component>{comp('LightningComponentBundle','salesPanel')},null,false);
        System.assertEquals(1,result.components.size());System.assertEquals('SalesService',result.components[0].name);
        System.assertEquals(0,result.verifiedComponents.size(),'LWC itself is not an Apex/Flow card.');
    }
    @IsTest static void invalidInputsAreRejected(){
        Boolean rejected=false;try{AppModelController.getAppScope('../bad',false);}catch(AuraHandledException expected){rejected=true;}System.assert(rejected);
        rejected=false;try{AppModelController.expandScope(null,new List<AppModelController.Component>(),null,false);}catch(AuraHandledException expected){rejected=true;}System.assert(rejected);
    }
    private class AppTypesMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse response=new HttpResponse();response.setStatusCode(200);
            if(request.getEndpoint().contains('/query/'))response.setBody('{"done":true,"records":[{"DurableId":"06m000000000001AAA","NamespacePrefix":"standard"},{"DurableId":"06m000000000002AAA","NamespacePrefix":null},{"DurableId":"06m000000000003AAA","NamespacePrefix":"pkg"}]}');
            else response.setBody('{"apps":[{"appId":"06m000000000001","label":"Sales"},{"appId":"06m000000000002","label":"Sales"},{"appId":"06m000000000003","label":"Packaged App"},{"appId":"06m000000000004","label":"Unknown App"}]}');
            return response;
        }
    }
    @IsTest static void classifiesFromMetadataRatherThanLabels(){
        Test.setMock(HttpCalloutMock.class,new AppTypesMock());List<AppModelController.AppOption> options=AppModelController.listApps();
        System.assertEquals(4,options.size());System.assertEquals('standard',options[0].appType);System.assertEquals('custom',options[1].appType);System.assertEquals('custom',options[2].appType);System.assertEquals('unknown',options[3].appType);
    }
    private class AppTypeFailureMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){HttpResponse response=new HttpResponse();if(request.getEndpoint().contains('/query/')){response.setStatusCode(403);response.setBody('Forbidden');}else{response.setStatusCode(200);response.setBody('{"apps":[{"appId":"06m000000000001","label":"Still Available"}]}');}return response;}
    }
    @IsTest static void failedClassificationDoesNotHideTheAppList(){Test.setMock(HttpCalloutMock.class,new AppTypeFailureMock());List<AppModelController.AppOption> options=AppModelController.listApps();System.assertEquals(1,options.size());System.assertEquals('unknown',options[0].appType);}

    private class ComponentTabMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse r=new HttpResponse();r.setStatusCode(200);String decoded=EncodingUtil.urlDecode(request.getEndpoint(),'UTF-8');
            if(decoded.contains('/apps/'))r.setBody('{"label":"Warden Studio","developerName":"Warden_Studio","startUrl":"https://example.test/home?tsid=02u000000000001","navItems":[{"custom":true,"developerName":"Warden_Studio","objectApiName":"0Rb000000000001","itemType":"TabAura"}]}');
            else if(decoded.contains('FROM LightningComponentBundle'))r.setBody('{"done":true,"records":[{"Id":"0Rb000000000001","DeveloperName":"wardenApp"}]}');
            else if(decoded.contains('FROM CustomTab'))r.setBody('{"done":true,"records":[{"Id":"01r000000000001","DeveloperName":"Warden_Studio"}]}');
            else if(decoded.contains('FROM MetadataComponentDependency')){
                System.assert(!decoded.substringAfter(' WHERE ').contains('MetadataComponentName'),'Dependency requests must filter on component IDs.');
                System.assert(decoded.contains('MetadataComponentId IN'));
                r.setBody('{"done":true,"records":[{"MetadataComponentId":"0Rb000000000001","MetadataComponentName":"wardenApp","MetadataComponentType":"LightningComponentBundle","RefMetadataComponentId":"01p000000000001","RefMetadataComponentName":"WardenController","RefMetadataComponentType":"ApexClass"}]}');
            }else r.setBody('{"done":true,"records":[]}');return r;
        }
    }
    @IsTest static void customComponentTabReachesObjectsFromTheExistingScan(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Object_Scan_Version__c=5);insert run;
        insert new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='ApexClass',Component_Name__c='WardenController',Target_Type__c='Object',Target_Name__c='Contact',Evidence__c='Static Apex object reference');
        Test.setMock(HttpCalloutMock.class,new ComponentTabMock());Test.startTest();
        AppModelController.Scope scope=AppModelController.getAppScope('06m000000000001',true);
        Boolean found=false;for(AppModelController.Component c:scope.components)if(c.type=='LightningComponentBundle'&&c.name=='wardenApp'&&c.id=='0Rb000000000001')found=true;
        System.assert(found,'Tab component IDs must resolve to their bundle names before reading scanner evidence.');
        AppModelController.Expansion first=AppModelController.expandScope(run.Id,scope.components,null,false);
        AppModelController.Expansion second=AppModelController.expandScope(run.Id,first.components,null,false);
        Boolean contact=false;for(AppModelController.Component c:second.components)if(c.type=='Object'&&c.name=='Contact')contact=true;
        System.assert(contact,'App → LWC → Apex → scanned sObject must resolve using the existing V5 scan.');Test.stopTest();
    }

    @IsTest static void browserJsonBoundaryRetainsComponentMetadata(){
        Test.setMock(HttpCalloutMock.class,new ApiMock());
        Map<String,Object> scope=(Map<String,Object>)JSON.deserializeUntyped(AppModelController.getAppScopeJson('06m000000000001',false));
        System.assertEquals('Sales',(String)scope.get('appLabel'));System.assert(scope.get('components') instanceof List<Object>);
        String browserPayload='[{"type":"LightningComponentBundle","name":"salesPanel","id":"0Rb000000000001"}]';
        Map<String,Object> expansion=(Map<String,Object>)JSON.deserializeUntyped(AppModelController.expandScopeJson(null,browserPayload,null,false));
        List<Object> components=(List<Object>)expansion.get('components');System.assertEquals(1,components.size());
        Map<String,Object> target=(Map<String,Object>)components[0];System.assertEquals('ApexClass',(String)target.get('type'));System.assertEquals('SalesService',(String)target.get('name'));
    }
    @IsTest static void browserJsonBoundaryRejectsMissingFieldsInsteadOfEmptyModel(){
        for(String payload:new List<String>{null,'not-json','[]','null','[{"type":"ApexClass"}]','[null]'}){
            Boolean rejected=false;try{AppModelController.expandScopeJson(null,payload,null,false);}catch(AuraHandledException expected){rejected=true;}System.assert(rejected,'Invalid browser data must fail explicitly: '+payload);
        }
    }

    @IsTest static void fieldEvidenceIsLimitedToReachedSourcesAndSnapshot(){
        Field_Usage_Run__c currentRun=new Field_Usage_Run__c(Status__c='Completed',Object_Scan_Version__c=5),oldRun=new Field_Usage_Run__c(Status__c='Completed');
        insert new List<Field_Usage_Run__c>{currentRun,oldRun};
        List<Field_Usage_Evidence__c> rows=new List<Field_Usage_Evidence__c>();
        for(String spec:new List<String>{'Apex Class|SalesService|Description','Apex Class|Unrelated|Industry','Flow|SalesService|Phone','LWC|sales_panel / sales_panel.js|Name','LWC|salesXpanel / salesXpanel.js|Website'}){
            List<String> parts=spec.split('\\|');
            rows.add(new Field_Usage_Evidence__c(Run__c=currentRun.Id,Source_Type__c=parts[0],Component_Name__c=parts[1],Object_API_Name__c='Account',Field_API_Name__c=parts[2]));
        }
        rows.add(new Field_Usage_Evidence__c(Run__c=oldRun.Id,Source_Type__c='Apex Class',Component_Name__c='SalesService',Object_API_Name__c='Account',Field_API_Name__c='Fax'));insert rows;
        Test.setMock(HttpCalloutMock.class,new ApiMock());Test.startTest();
        AppModelController.Expansion result=AppModelController.expandScope(currentRun.Id,new List<AppModelController.Component>{comp('ApexClass','SalesService'),comp('LightningComponentBundle','sales_panel')},null,false);
        Test.stopTest();Set<String> fields=new Set<String>();for(AppModelController.FieldUse usage:result.fieldUsage)fields.add(usage.fieldApiName);
        System.assertEquals(new Set<String>{'Name','Description'},fields,'Only exact app source type/name and current snapshot may contribute fields.');
    }

    @IsTest static void componentCardsRequireResolvedIdentity(){
        Test.setMock(HttpCalloutMock.class,new ApiMock());
        AppModelController.Expansion expansion=AppModelController.expandScope(null,new List<AppModelController.Component>{comp('ApexClass','SalesService'),comp('ApexClass','ApexClass')},null,false);
        System.assertEquals(1,expansion.verifiedComponents.size());
        System.assertEquals('SalesService',expansion.verifiedComponents[0].name);
        System.assert(expansion.verifiedComponents[0].id.startsWith('01p'));
    }

}
