/** V5 read-only app discovery and bounded, evidence-based dependency expansion. */
public with sharing class AppModelController {
    private static final String ROOT='callout:Salesforce_Tooling_API/services/data/v60.0';
    public class Component {
        @AuraEnabled public String type;
        @AuraEnabled public String name;
        @AuraEnabled public String id;
    }
    public class AppOption { @AuraEnabled public String label; @AuraEnabled public String value; }
    public class Scope {
        @AuraEnabled public String appLabel;
        @AuraEnabled public Id runId;
        @AuraEnabled public Datetime scannedAt;
        @AuraEnabled public List<Component> components=new List<Component>();
        @AuraEnabled public List<String> warnings=new List<String>();
    }
    public class Expansion {
        @AuraEnabled public List<Component> components=new List<Component>();
        @AuraEnabled public List<String> reasons=new List<String>();
        @AuraEnabled public String nextCursor;
        @AuraEnabled public List<String> warnings=new List<String>();
    }
    @AuraEnabled public static List<AppOption> listApps() {
        Map<String,Object> payload=get('/ui-api/apps?formFactor=Large&userCustomizations=false');
        List<AppOption> options=new List<AppOption>();
        for(Object raw:items(payload.get('apps'))){Map<String,Object> app=(Map<String,Object>)raw;AppOption option=new AppOption();option.label=str(app.get('label'));option.value=str(app.get('appId'));if(!String.isBlank(option.value))options.add(option);}
        return options;
    }
    @AuraEnabled public static Scope getAppScope(String appId,Boolean includeUsage) {
        if(String.isBlank(appId)||!Pattern.matches('^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$',appId))throw new AuraHandledException('Select a valid Salesforce app.');
        Map<String,Object> app=get('/ui-api/apps/'+appId+'?formFactor=Large&userCustomizations=false');
        Scope scope=new Scope();scope.appLabel=str(app.get('label'));
        String legacyId;
        String startUrl=str(app.get('startUrl'));
        if(startUrl!=null){Matcher legacy=Pattern.compile('[?&]tsid=([A-Za-z0-9]{15,18})').matcher(startUrl);if(legacy.find())legacyId=legacy.group(1);}
        Component root=component('CustomApplication',str(app.get('developerName')),legacyId);scope.components.add(root);
        if(scope.appLabel!=root.name)scope.components.add(component('CustomApplication',scope.appLabel,legacyId));
        Object nav=app.get('navItems');if(nav instanceof Map<String,Object>)nav=((Map<String,Object>)nav).get('navItems');
        for(Object raw:items(nav)){
            Map<String,Object> tab=(Map<String,Object>)raw;
            String objectName=ObjectUsageScanner.canonical(str(tab.get('objectApiName')));
            if(objectName!=null)scope.components.add(component('Object',objectName,null));
            else {
                String tabName=str(tab.get('apiName'));if(String.isBlank(tabName))tabName=str(tab.get('developerName'));
                if(!String.isBlank(tabName)&&tab.get('custom')==true)scope.components.add(component('CustomTab',tabName,str(tab.get('id'))));
                // Old API responses and test fixtures can expose apiName directly.
                else if(tab.containsKey('apiName'))scope.components.add(component('CustomTab',tabName,str(tab.get('id'))));
            }
            if(tab.get('pageReference') instanceof Map<String,Object>){
                Map<String,Object> page=(Map<String,Object>)tab.get('pageReference');
                if(page.get('attributes') instanceof Map<String,Object>){
                    Map<String,Object> attrs=(Map<String,Object>)page.get('attributes');
                    String direct=str(attrs.get('componentName'));
                    if(direct!=null&&direct.startsWith('c__'))scope.components.add(component('LightningComponentBundle',direct.substring(3),null));
                    String flow=str(attrs.get('flowApiName'));if(flow!=null)scope.components.add(component('Flow',flow,null));
                }
            }
        }
        if(includeUsage==true){
            List<Field_Usage_Run__c> runs=[SELECT Id,Completed_At__c,Object_Scan_Version__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];
            if(runs.isEmpty()||runs[0].Object_Scan_Version__c!=5)throw new AuraHandledException('Run a successful V5 org scan first to include Flow, LWC and Apex object usage. Existing V4 field snapshots do not contain object-level evidence.');
            scope.runId=runs[0].Id;scope.scannedAt=runs[0].Completed_At__c;
            scope.warnings.add('Static evidence only. Dynamic object names, dynamic component loading, managed-package source, excluded Apex classes and unsupported Salesforce dependency types may be missing.');
            scope.warnings.add('App membership follows the dependencies Salesforce exposes. Shared component references and object automation indicate potential use, not proof that a user executed a path.');
        }
        return scope;
    }
    @AuraEnabled public static Expansion expandScope(Id runId,List<Component> components,String cursor,Boolean includeAutomation) {
        if(components==null||components.isEmpty()||components.size()>40)throw new AuraHandledException('Expand between 1 and 40 components per request.');
        if(runId!=null){List<Field_Usage_Run__c> runs=[SELECT Id FROM Field_Usage_Run__c WHERE Id=:runId AND Status__c='Completed' AND Object_Scan_Version__c=5 LIMIT 1];if(runs.isEmpty())throw new AuraHandledException('The selected V5 snapshot is no longer available. Run the org scan again.');}
        Expansion result=new Expansion();Set<String> names=new Set<String>(),objectNames=new Set<String>(),sourceKeys=new Set<String>(),sourceIds=new Set<String>();
        for(Component c:components){
            if(c==null||String.isBlank(c.name)||c.name.length()>255||Pattern.compile('[\\r\\n]').matcher(c.name).find())continue;
            if(c.type=='Object'){objectNames.add(c.name);continue;}
            names.add(c.name);sourceKeys.add(key(c.type,c.name));if(!String.isBlank(c.id)&&Pattern.matches('^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$',c.id))sourceIds.add(c.id.substring(0,15));
        }
        // Persisted scanner evidence is scoped to reached components, never every
        // component in the org that happens to mention the same object.
        if(cursor==null&&runId!=null){
            List<Object_Usage_Evidence__c> evidence=[SELECT Source_Type__c,Component_Name__c,Component_Id__c,Target_Type__c,Target_Name__c,Entry_Object__c,Evidence__c FROM Object_Usage_Evidence__c WHERE Run__c=:runId AND (Component_Name__c IN :names OR Entry_Object__c IN :objectNames) LIMIT 2001];
            if(evidence.size()>2000)throw new AuraHandledException('This expansion exceeds 2,000 evidence rows. Generate a smaller model; no partial diagram was created.');
            for(Object_Usage_Evidence__c row:evidence){
                Boolean reached=sourceKeys.contains(key(row.Source_Type__c,row.Component_Name__c));
                Boolean entry=includeAutomation==true&&!String.isBlank(row.Entry_Object__c)&&objectNames.contains(row.Entry_Object__c);
                if(!reached&&!entry)continue;
                if(entry)result.components.add(component(row.Source_Type__c,row.Component_Name__c,row.Component_Id__c));
                result.components.add(component(row.Target_Type__c,row.Target_Name__c,null));
                result.reasons.add(row.Source_Type__c+' '+row.Component_Name__c+' → '+row.Target_Name__c+': '+row.Evidence__c);
            }
        }
        if(names.isEmpty())return result;
        try{
            String path;
            if(cursor!=null){
                if(!Pattern.matches('^/services/data/v60\\.0/tooling/query/[A-Za-z0-9-]+$',cursor))throw new AuraHandledException('Invalid dependency page cursor.');
                path=cursor.substring('/services/data/v60.0'.length());
            }else{
                List<String> quoted=new List<String>();for(String name:names)quoted.add('\''+String.escapeSingleQuotes(name)+'\'');
                String whereClause='MetadataComponentName IN ('+String.join(quoted,',')+')';
                if(!sourceIds.isEmpty()){List<String> quotedIds=new List<String>();for(String id:sourceIds)quotedIds.add('\''+id+'\'');whereClause+=' OR MetadataComponentId IN ('+String.join(quotedIds,',')+')';}
                String soql='SELECT MetadataComponentId,MetadataComponentName,MetadataComponentType,RefMetadataComponentId,RefMetadataComponentName,RefMetadataComponentType FROM MetadataComponentDependency WHERE '+whereClause;
                path='/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');
            }
            Map<String,Object> payload=get(path);
            for(Object raw:items(payload.get('records'))){
                Map<String,Object> edge=(Map<String,Object>)raw;
                String sourceId=str(edge.get('MetadataComponentId'));
                Boolean matchedId=sourceId!=null&&sourceIds.contains(sourceId.substring(0,15));
                if(!matchedId&&!sourceKeys.contains(key(str(edge.get('MetadataComponentType')),str(edge.get('MetadataComponentName')))))continue;
                String type=str(edge.get('RefMetadataComponentType')),name=str(edge.get('RefMetadataComponentName'));
                if(type=='CustomObject'||type=='StandardEntity'||type=='EntityDefinition')type='Object';
                if(type=='CustomField'||type=='StandardField'){name=name==null?null:name.substringBefore('.');type='Object';}
                if(type=='Object'){name=ObjectUsageScanner.canonical(name);if(name==null)continue;}
                if(!new Set<String>{'Object','ApexClass','ApexTrigger','Flow','FlowDefinition','LightningComponentBundle','AuraDefinitionBundle','FlexiPage','CustomTab','CustomApplication','UtilityBar'}.contains(type))continue;
                if(type=='FlowDefinition')type='Flow';
                result.components.add(component(type,name,str(edge.get('RefMetadataComponentId'))));
                result.reasons.add(str(edge.get('MetadataComponentName'))+' → '+name+' (Salesforce metadata dependency)');
            }
            result.nextCursor=str(payload.get('nextRecordsUrl'));
            if(payload.get('done')==false&&String.isBlank(result.nextCursor))throw new AuraHandledException('Salesforce returned an incomplete dependency page without a continuation cursor.');
        }catch(Exception ex){result.warnings.add('Salesforce component dependency coverage is unavailable for this expansion: '+ex.getMessage().left(400)+'. App-only component links may be missing.');}
        return result;
    }
    private static String key(String type,String name){if(type=='FlowDefinition')type='Flow';return String.valueOf(type).toLowerCase()+'|'+String.valueOf(name).toLowerCase();}
    private static Component component(String type,String name,String id){Component c=new Component();c.type=type;c.name=name;c.id=id;return c;}
    private static String str(Object value){return value instanceof String?(String)value:null;}
    private static List<Object> items(Object value){return value instanceof List<Object>?(List<Object>)value:new List<Object>();}
    private static Map<String,Object> get(String path){
        HttpRequest request=new HttpRequest();request.setEndpoint(ROOT+path);request.setMethod('GET');request.setHeader('Accept','application/json');request.setTimeout(120000);
        HttpResponse response=new Http().send(request);
        if(response.getStatusCode()<200||response.getStatusCode()>=300)throw new AuraHandledException('Salesforce metadata request failed (HTTP '+response.getStatusCode()+'). Check the Salesforce_Tooling_API Named Credential and API permissions.');
        return (Map<String,Object>)JSON.deserializeUntyped(response.getBody());
    }
}
