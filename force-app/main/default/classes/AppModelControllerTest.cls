@IsTest private class AppModelControllerTest {
    private class ApiMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request){
            HttpResponse response=new HttpResponse();response.setStatusCode(200);
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
        try{AppModelController.getAppScope('06m000000000001',true);}catch(AuraHandledException expected){rejected=true;}System.assert(rejected);
    }
    @IsTest static void scopedEvidenceAndAutomation(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Object_Scan_Version__c=5);insert run;
        insert new List<Object_Usage_Evidence__c>{
            new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='ApexClass',Component_Name__c='SalesService',Target_Type__c='Object',Target_Name__c='Opportunity',Evidence__c='SOQL'),
            new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='ApexClass',Component_Name__c='Unrelated',Target_Type__c='Object',Target_Name__c='Lead'),
            new Object_Usage_Evidence__c(Run__c=run.Id,Source_Type__c='Flow',Component_Name__c='AccountFlow',Target_Type__c='Object',Target_Name__c='Contact',Entry_Object__c='Account')
        };
        Test.setMock(HttpCalloutMock.class,new ApiMock());
        AppModelController.Expansion expansion=AppModelController.expandScope(run.Id,new List<AppModelController.Component>{comp('ApexClass','SalesService'),comp('Object','Account')},null,true);
        Set<String> names=new Set<String>();for(AppModelController.Component c:expansion.components)names.add(c.name);
        System.assert(names.containsAll(new Set<String>{'Opportunity','AccountFlow','Contact'}));System.assert(!names.contains('Lead'));
        expansion=AppModelController.expandScope(run.Id,new List<AppModelController.Component>{comp('Object','Account')},null,false);System.assertEquals(0,expansion.components.size());
    }
    @IsTest static void dependencyTypesDoNotLeakAcrossSameNamedComponents(){
        Test.setMock(HttpCalloutMock.class,new ApiMock());AppModelController.Expansion result=AppModelController.expandScope(null,new List<AppModelController.Component>{comp('LightningComponentBundle','salesPanel')},null,false);
        System.assertEquals(1,result.components.size());System.assertEquals('SalesService',result.components[0].name);
    }
    @IsTest static void invalidInputsAreRejected(){
        Boolean rejected=false;try{AppModelController.getAppScope('../bad',false);}catch(AuraHandledException expected){rejected=true;}System.assert(rejected);
        rejected=false;try{AppModelController.expandScope(null,new List<AppModelController.Component>(),null,false);}catch(AuraHandledException expected){rejected=true;}System.assert(rejected);
    }
}
