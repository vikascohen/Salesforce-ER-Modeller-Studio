@IsTest private class AppPageFieldServiceTest {
    private static AppModelController.Component objectRef(String name){AppModelController.Component c=new AppModelController.Component();c.type='Object';c.name=name;return c;}
    private class PageMock implements HttpCalloutMock {
        String mode;PageMock(String mode){this.mode=mode;}
        public HttpResponse respond(HttpRequest request){
            String endpoint=EncodingUtil.urlDecode(request.getEndpoint(),'UTF-8');HttpResponse r=new HttpResponse();r.setStatusCode(200);
            if(endpoint.contains('FROM CustomApplication')){
                if(mode=='denied'){r.setStatusCode(403);r.setBody('{}');return r;}
                if(mode=='missing'){r.setBody('{"done":true,"records":[]}');return r;}
                String overrides=(mode=='dynamic'||mode=='detail'||mode=='pageDenied'||mode=='ambiguous')?'[{"actionName":"View","type":"Flexipage","content":"Account_Record_Page","pageOrSobjectType":"Account","formFactor":"Large"}]':mode=='visualforce'?'[{"actionName":"View","type":"Visualforce","content":"Other","pageOrSobjectType":"Account","formFactor":"Large"}]':'[]';
                r.setBody('{"done":true,"records":[{"Metadata":{"actionOverrides":'+overrides+',"profileActionOverrides":[]}}]}');
            }else if(endpoint.contains('FROM FlexiPage')){
                if(mode=='pageDenied'){r.setStatusCode(403);r.setBody('{}');return r;}
                if(mode=='ambiguous'){r.setBody('{"done":true,"records":[{},{}]}');return r;}
                r.setBody('{"done":true,"records":[{"Id":"0M0000000000001","DeveloperName":"Account_Record_Page","Metadata":{"sobjectType":"Account","flexiPageRegions":[{"itemInstances":[{"fieldInstance":{"fieldItem":"Record.Description"}},{"fieldInstance":{"fieldItem":"Record.Other.Name"}},{"fieldInstance":{"fieldItem":"Record.DoesNotExist__c"}},{"componentInstance":{"componentName":"'+(mode=='detail'?'force:recordDetail':'force:highlightsPanel')+'"}}]}]}}]}');
            }else if(endpoint.contains('/ui-api/layout/')){
                System.assert(!endpoint.contains('object-info'),'Never use all schema fields as page evidence.');
                System.assert(endpoint.contains('/v66.0/ui-api/layout/'),'Layouts must use the version supporting Task and Event.');
                if(mode=='unsupported'){r.setStatusCode(400);r.setBody('[{"errorCode":"INVALID_TYPE","message":"private detail"}]');return r;}
                if(mode=='oldVersion'){r.setStatusCode(400);r.setBody('[{"errorCode":"UNSUPPORTED_API_VERSION"}]');return r;}
                if(mode=='dynamic'||mode=='visualforce'||mode=='pageDenied'||mode=='ambiguous')System.assert(false,'An override must not fall back to an unrelated default layout.');
                if(mode=='layoutDenied'){r.setStatusCode(403);r.setBody('{}');return r;}
                if(mode=='wrongObject'){r.setBody('{"objectApiName":"Contact","sections":[]}');return r;}
                r.setBody('{"objectApiName":"Account","id":"00h000000000001","recordTypeId":"012000000000000AAA","sections":[{"layoutRows":[{"layoutItems":[{"layoutComponents":[{"componentType":"Field","apiName":"Name"},{"componentType":"Field","apiName":"Description"},{"componentType":"Field","apiName":"DoesNotExist__c"},{"componentType":"CustomLink","apiName":"Phone"},{"componentType":"Field","apiName":"Owner.Name"},{"componentType":"Field","apiName":"Name"}]}]}]}]}');
            }else {r.setStatusCode(404);r.setBody('{}');}return r;
        }
    }
    private static AppPageFieldService.Result run(String mode){Test.setMock(HttpCalloutMock.class,new PageMock(mode));return AppPageFieldService.discover('Sales','02u000000000001',new List<AppModelController.Component>{objectRef('Account')});}
    @IsTest static void defaultLayoutsIncludeOnlyExplicitReadableFields(){
        Test.startTest();AppPageFieldService.Result result=run('default');Test.stopTest();
        System.assertEquals(2,result.fields.size());Set<String> fields=new Set<String>();for(AppModelController.FieldUse field:result.fields){fields.add(field.fieldApiName);System.assertEquals('Account',field.objectApiName);System.assertEquals('Navigation page layout',field.sourceType);System.assert(field.location.contains('012000000000000AAA'));}
        System.assertEquals(new Set<String>{'Name','Description'},fields);System.assert(result.warnings[0].contains('shared across apps'));
    }
    @IsTest static void dynamicFormsUseOnlyAssignedPageFields(){
        Test.startTest();AppPageFieldService.Result result=run('dynamic');Test.stopTest();System.assertEquals(1,result.fields.size());System.assertEquals('Description',result.fields[0].fieldApiName);System.assertEquals('App-assigned Lightning page',result.fields[0].sourceType);System.assertEquals(1,result.pages.size());
    }
    @IsTest static void recordDetailExplicitlyIncludesProfileLayout(){Test.startTest();AppPageFieldService.Result result=run('detail');Test.stopTest();System.assertEquals(3,result.fields.size());System.assertEquals(1,result.pages.size());}
    @IsTest static void missingAssignmentsNeverAssumeLayouts(){
        Test.startTest();for(String mode:new List<String>{'denied','missing','pageDenied','layoutDenied','visualforce'}){AppPageFieldService.Result result=run(mode);System.assertEquals(0,result.fields.size(),mode);System.assert(!result.warnings.isEmpty(),mode);}Test.stopTest();
    }
    @IsTest static void malformedOrAmbiguousMetadataFailsWithoutPartialEvidence(){
        Test.startTest();for(String mode:new List<String>{'wrongObject','ambiguous'}){Boolean rejected=false;try{run(mode);}catch(AppPageFieldService.PageEvidenceException ex){rejected=true;}System.assert(rejected,mode);}Test.stopTest();
    }
    @IsTest static void nonAppRootsAndNavigationBounds(){
        Test.startTest();AppPageFieldService.Result empty=AppPageFieldService.discover('Other',null,new List<AppModelController.Component>{objectRef('Missing_Object__c')});System.assertEquals(0,empty.fields.size());
        empty=AppPageFieldService.discover('Other',null,new List<AppModelController.Component>{objectRef('Account')});System.assertEquals(0,empty.fields.size());System.assert(!empty.warnings.isEmpty());
        List<AppModelController.Component> many=new List<AppModelController.Component>();for(String name:Schema.getGlobalDescribe().keySet()){many.add(objectRef(name));if(many.size()==26)break;}
        Boolean rejected=false;try{AppPageFieldService.discover('Too large','02u000000000001',many);}catch(AppPageFieldService.PageEvidenceException ex){rejected=true;}System.assert(rejected);Test.stopTest();
    }
    @IsTest static void unsupportedLayoutsExplainCapabilityWithoutLeakingResponse(){
        Test.startTest();
        AppPageFieldService.Result unsupported=run('unsupported');
        AppPageFieldService.Result oldVersion=run('oldVersion');
        Test.stopTest();
        System.assertEquals(0,unsupported.fields.size());
        System.assert(unsupported.warnings[0].contains('does not expose a readable UI API layout'));
        System.assert(!unsupported.warnings[0].contains('private detail'));
        System.assertEquals(0,oldVersion.fields.size());
        System.assert(oldVersion.warnings[0].contains('requires a newer UI API version'));
    }
    @IsTest static void deeplyNestedPageIsBounded(){
        Object node=new Map<String,Object>();for(Integer i=0;i<32;i++)node=new List<Object>{node};Boolean rejected=false;
        try{AppPageFieldService.walk(node,'Account','page','Account','test',new List<AppModelController.FieldUse>(),new Set<String>(),0);}catch(AppPageFieldService.PageEvidenceException ex){rejected=true;}System.assert(rejected);
    }
}
