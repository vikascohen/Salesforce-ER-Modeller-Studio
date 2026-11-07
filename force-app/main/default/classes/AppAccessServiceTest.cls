@IsTest private class AppAccessServiceTest {
    private class MetadataMock implements HttpCalloutMock {
        String mode;MetadataMock(String mode){this.mode=mode;}
        public HttpResponse respond(HttpRequest req){
            String q=EncodingUtil.urlDecode(req.getEndpoint().substringAfter('?q='),'UTF-8');
            System.assert(!q.contains('Injected'),'Invalid component IDs must never reach SOQL');
            HttpResponse res=new HttpResponse();res.setStatusCode(mode=='denied'?403:200);
            List<Object> records=new List<Object>();
            if(q.contains(' FROM AppDefinition '))records.add(new Map<String,Object>{'DeveloperName'=>'ExampleApp','NamespacePrefix'=>'example'});
            else if(q.contains(' FROM AppMenuItem ')){records.add(new Map<String,Object>{'ApplicationId'=>'02u000000000001'});if(mode=='ambiguous')records.add(new Map<String,Object>{'ApplicationId'=>'02u000000000002'});}
            else if(q.contains(' FROM SetupEntityAccess ')&&mode!='empty'){System.assert(q.contains('Parent.IsOwnedByProfile=false'));records.add(new Map<String,Object>{'ParentId'=>'0PS000000000001','SetupEntityId'=>'02u000000000001','SetupEntityType'=>'TabSet'});records.add(new Map<String,Object>{'ParentId'=>'0PS000000000002','SetupEntityId'=>'01p000000000001','SetupEntityType'=>'ApexClass'});}
            else if(q.contains(' FROM PermissionSet ')){
                records.add(new Map<String,Object>{'Id'=>'0PS000000000001','Name'=>'LoggerAdmin','Label'=>'Logger Admin','NamespacePrefix'=>'example','LicenseId'=>'0PL000000000001'});
                records.add(new Map<String,Object>{'Id'=>'0PS000000000002','Name'=>'LoggerUser','Label'=>'Logger User','LicenseId'=>'100000000000001'});
            }
            else if(q.contains(' FROM PermissionSetLicense '))records.add(new Map<String,Object>{'Id'=>'0PL000000000001','DeveloperName'=>'ExampleCRM','MasterLabel'=>'Example CRM Licence'});
            else if(q.contains(' FROM UserLicense '))records.add(new Map<String,Object>{'Id'=>'100000000000001','Name'=>'Salesforce'});
            else if(q.contains(' FROM PackageLicense ')&&mode!='empty')records.add(new Map<String,Object>{'Id'=>'050000000000001','NamespacePrefix'=>'example'});
            else if(q.contains(' FROM InstalledSubscriberPackage ')){if(mode=='packageDenied'){res.setStatusCode(403);}else records.add(new Map<String,Object>{'SubscriberPackage'=>new Map<String,Object>{'Name'=>'Example Package'}});}
            res.setBody(JSON.serialize(new Map<String,Object>{'records'=>records,'done'=>mode!='truncated'}));return res;
        }
    }
    private static Map<String,Object> discover(String mode){Test.setMock(HttpCalloutMock.class,new MetadataMock(mode));return (Map<String,Object>)JSON.deserializeUntyped(AppAccessService.discover('06m000000000001','[{"type":"ApexClass","id":"01p000000000001"},{"type":"ApexClass","id":"Injected"}]'));}
    @IsTest static void namesAreScopedAndLicencesAreResolvedFromTheirReferences(){
        Map<String,Object> result=discover('normal');List<Object> cards=(List<Object>)result.get('cards');System.assertEquals(5,cards.size());
        Set<String> types=new Set<String>(),labels=new Set<String>();for(Object raw:cards){Map<String,Object> c=(Map<String,Object>)raw;types.add((String)c.get('type'));labels.add((String)c.get('label'));System.assert(((String)c.get('name')).startsWith('Access_'));}
        System.assert(types.contains('PermissionSet')&&types.contains('PermissionSetLicense')&&types.contains('UserLicense')&&types.contains('PackageLicense'));
        System.assert(labels.contains('Logger Admin [example__LoggerAdmin]'));System.assert(labels.contains('Example CRM Licence'));System.assert(labels.contains('Salesforce'));System.assert(labels.contains('Example Package [example]'));
    }
    @IsTest static void emptyOrAmbiguousMetadataIsExplainedRatherThanInvented(){
        Map<String,Object> empty=discover('empty');System.assertEquals(0,((List<Object>)empty.get('cards')).size());System.assert(JSON.serialize(empty.get('warnings')).contains('No named permission sets'));
        System.assert(JSON.serialize(discover('ambiguous').get('warnings')).contains('unambiguously'));
        System.assert(JSON.serialize(discover('packageDenied').get('warnings')).contains('namespace is shown explicitly'));
    }
    @IsTest static void deniedTruncatedAndInvalidInputFailClearly(){
        for(String mode:new List<String>{'denied','truncated'}){Boolean failed=false;try{discover(mode);}catch(Exception ex){failed=true;}System.assert(failed);}
        Boolean failed=false;try{AppAccessService.discover('bad','[]');}catch(Exception ex){failed=true;}System.assert(failed);
        failed=false;try{AppAccessService.discover('06m000000000001','invalid');}catch(Exception ex){failed=true;}System.assert(failed);
    }
}
