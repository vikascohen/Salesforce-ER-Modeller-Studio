/** Read-only named access configuration for an app and its reached Apex classes. */
public with sharing class AppAccessService {
    private class AccessException extends Exception {}
    private static String quote(String value){return '\''+String.escapeSingleQuotes(value)+'\'';}
    private static List<Object> rows(String query,Boolean tooling){
        HttpRequest req=new HttpRequest();req.setEndpoint('callout:Salesforce_Tooling_API/services/data/v60.0/'+(tooling?'tooling/':'')+'query/?q='+EncodingUtil.urlEncode(query,'UTF-8'));req.setMethod('GET');req.setTimeout(120000);
        HttpResponse res=new Http().send(req);if(res.getStatusCode()!=200)throw new AccessException('Named app access discovery failed (HTTP '+res.getStatusCode()+'). Check metadata permissions and the Tooling API credential.');
        Map<String,Object> page=(Map<String,Object>)JSON.deserializeUntyped(res.getBody());List<Object> records=(List<Object>)page.get('records');
        if(page.get('done')==false||records.size()>300)throw new AccessException('App access discovery exceeds 300 records. No partial access model was created.');return records;
    }
    private static String identityKey(String value){return value==null?null:value.left(15);}
    private static String str(Object value){return value==null?null:String.valueOf(value);}
    private static void card(List<Object> cards,String type,String id,String label,String apiName,String evidence){
        cards.add(new Map<String,Object>{'type'=>type,'name'=>'Access_'+id,'label'=>label,'id'=>id,'apiName'=>apiName,'evidence'=>evidence});
    }
    private static String selectedAppTarget(String appId,String developerName,String ns,List<String> warnings){
        try{
            HttpRequest req=new HttpRequest();req.setEndpoint('callout:Salesforce_Tooling_API/services/data/v60.0/ui-api/apps/'+appId+'?formFactor=Large&userCustomizations=false');req.setMethod('GET');req.setTimeout(30000);
            HttpResponse res=new Http().send(req);if(res.getStatusCode()!=200)throw new AccessException('Selected app UI metadata is not readable.');
            Map<String,Object> app=(Map<String,Object>)JSON.deserializeUntyped(res.getBody());
            String name=str(app.get('developerName')),returnedId=str(app.get('appId'));
            if(name==null||(!name.equalsIgnoreCase(developerName)&&!name.equalsIgnoreCase(String.valueOf(ns)+'__'+developerName)))throw new AccessException('Selected app identity does not match AppDefinition.');
            if(returnedId!=null&&returnedId.left(15)!=appId.left(15))throw new AccessException('Selected app ID does not match its UI metadata.');
            String start=str(app.get('startUrl'));if(start==null)throw new AccessException('Selected app has no TabSet reference.');
            Matcher match=Pattern.compile('[?&]tsid=(02u[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?)(?:[&#]|$)').matcher(start);
            if(!match.find())throw new AccessException('Selected app TabSet reference is unavailable.');
            return match.group(1);
        }catch(Exception ex){warnings.add('App visibility grants could not be resolved unambiguously; only reached Apex class grants are checked. '+ex.getMessage().left(180));return null;}
    }
    @AuraEnabled public static String discover(String appId,String componentsJson){
        if(String.isBlank(appId)||!Pattern.matches('^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$',appId))throw new AuraHandledException('Select a valid Salesforce app.');
        if(componentsJson==null||componentsJson.length()>64000)throw new AuraHandledException('App access component scope is missing or too large.');
        List<Object> input;try{input=(List<Object>)JSON.deserializeUntyped(componentsJson);}catch(Exception ex){throw new AuraHandledException('App access component scope could not be read.');}
        if(input==null||input.size()>500)throw new AuraHandledException('App access component scope exceeds 500 components.');
        Map<String,String> targetNames=new Map<String,String>(),permissionNames=new Map<String,String>();List<Object> grants=new List<Object>();
        Set<String> targets=new Set<String>();List<Object> cards=new List<Object>();List<String> warnings=new List<String>(),reasons=new List<String>();
        // AppDefinition uses the UI API app ID. AppMenuItem supplies the TabSet ID
        // consumed by SetupEntityAccess; labels are never used to infer ownership.
        List<Object> definitions=rows('SELECT DeveloperName,NamespacePrefix,Label FROM AppDefinition WHERE DurableId='+quote(appId)+' LIMIT 2',false);
        if(definitions.size()!=1)throw new AuraHandledException('The selected app identity could not be resolved for named access discovery.');
        Map<String,Object> app=(Map<String,Object>)definitions[0];String developerName=str(app.get('DeveloperName')),ns=str(app.get('NamespacePrefix'));
        List<Object> menus=rows('SELECT ApplicationId FROM AppMenuItem WHERE Name IN ('+quote(developerName)+(String.isBlank(ns)?'':','+quote(ns+'__'+developerName))+') AND Type=\'TabSet\' LIMIT 2',false);
        if(menus.size()==1){String id=str(((Map<String,Object>)menus[0]).get('ApplicationId'));if(id!=null)targets.add(id);}
        else {String id=selectedAppTarget(appId,developerName,ns,warnings);if(id!=null)targets.add(id);}
        String appName=String.isBlank(str(app.get('Label')))?developerName:str(app.get('Label'));
        String appDisplay=appName+' ['+(String.isBlank(ns)?'':ns+'__')+developerName+']';
        for(String id:targets)targetNames.put(identityKey(id),appDisplay);
        for(Object item:input){
            Map<String,Object> c=(Map<String,Object>)item;String id=str(c.get('id'));
            if(c.get('type')=='ApexClass'&&id!=null&&Pattern.matches('^01p[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$',id)){
                targets.add(id);
                if(!String.isBlank(str(c.get('name'))))targetNames.put(identityKey(id),str(c.get('name')));
            }
        }
        Set<String> permissionIds=new Set<String>(),licenseIds=new Set<String>();
        if(!targets.isEmpty()){
            List<String> quoted=new List<String>();for(String id:targets)quoted.add(quote(id));
            for(Object raw:rows('SELECT ParentId,SetupEntityId,SetupEntityType FROM SetupEntityAccess WHERE SetupEntityId IN ('+String.join(quoted,',')+') AND Parent.IsOwnedByProfile=false LIMIT 301',false)){
                Map<String,Object> grant=(Map<String,Object>)raw;String parent=str(grant.get('ParentId'));permissionIds.add(parent);grants.add(grant);
            }
        }
        if(!permissionIds.isEmpty()){
            List<String> quoted=new List<String>();for(String id:permissionIds)quoted.add(quote(id));
            for(Object raw:rows('SELECT Id,Name,Label,NamespacePrefix,LicenseId FROM PermissionSet WHERE Id IN ('+String.join(quoted,',')+') AND IsOwnedByProfile=false LIMIT 301',false)){
                Map<String,Object> p=(Map<String,Object>)raw;String id=str(p.get('Id')),name=str(p.get('Name')),prefix=str(p.get('NamespacePrefix'));String api=(String.isBlank(prefix)?'':prefix+'__')+name;
                String display=str(p.get('Label'))+' ['+api+']';
                permissionNames.put(identityKey(id),display);
                Set<String> classNames=new Set<String>(),appNames=new Set<String>();
                for(Object rawGrant:grants){
                    Map<String,Object> grant=(Map<String,Object>)rawGrant;
                    if(identityKey(str(grant.get('ParentId')))!=identityKey(id))continue;
                    String targetId=str(grant.get('SetupEntityId')),type=str(grant.get('SetupEntityType'));
                    String targetName=targetNames.get(identityKey(targetId));
                    if(String.isBlank(targetName))targetName='Name unavailable (ID: '+targetId+')';
                    if(type=='TabSet')appNames.add(targetName);
                    else classNames.add(targetName);
                }
                List<String> classes=new List<String>(classNames),apps=new List<String>(appNames),summary=new List<String>();
                classes.sort();apps.sort();
                if(!apps.isEmpty())summary.add('App visibility: '+String.join(apps,', ')+'.');
                if(!classes.isEmpty())summary.add('Apex access ('+classes.size()+'): '+String.join(classes,', ')+'.');
                String evidence=String.join(summary,'\n');
                card(cards,'PermissionSet',id,display,api,evidence);reasons.add('Permission set: '+display+'\n'+evidence);
                if(p.get('LicenseId')!=null)licenseIds.add(str(p.get('LicenseId')));
            }
        }
        for(Object rawGrant:grants){
            Map<String,Object> grant=(Map<String,Object>)rawGrant;
            if(!permissionNames.containsKey(identityKey(str(grant.get('ParentId')))))
                warnings.add('A permission-set grant was found but its name was unavailable (ID: '+str(grant.get('ParentId'))+').');
        }
        if(!licenseIds.isEmpty()){
            Map<String,List<String>> byType=new Map<String,List<String>>{'PermissionSetLicense'=>new List<String>(),'UserLicense'=>new List<String>()};
            String pslPrefix=PermissionSetLicense.SObjectType.getDescribe().getKeyPrefix(),userPrefix=UserLicense.SObjectType.getDescribe().getKeyPrefix();
            for(String id:licenseIds){if(id.startsWith(pslPrefix))byType.get('PermissionSetLicense').add(quote(id));else if(id.startsWith(userPrefix))byType.get('UserLicense').add(quote(id));else warnings.add('An unknown permission-set licence reference could not be resolved.');}
            if(!byType.get('PermissionSetLicense').isEmpty())for(Object raw:rows('SELECT Id,MasterLabel,DeveloperName FROM PermissionSetLicense WHERE Id IN ('+String.join(byType.get('PermissionSetLicense'),',')+') LIMIT 301',false)){Map<String,Object> p=(Map<String,Object>)raw;card(cards,'PermissionSetLicense',str(p.get('Id')),str(p.get('MasterLabel')),str(p.get('DeveloperName')),'Licence bound to a discovered permission set.');}
            if(!byType.get('UserLicense').isEmpty())for(Object raw:rows('SELECT Id,Name FROM UserLicense WHERE Id IN ('+String.join(byType.get('UserLicense'),',')+') LIMIT 301',false)){Map<String,Object> p=(Map<String,Object>)raw;card(cards,'UserLicense',str(p.get('Id')),str(p.get('Name')),str(p.get('Name')),'User licence bound to a discovered permission set.');}
        }
        if(!String.isBlank(ns)&&ns!='standard'){
            List<Object> packages=rows('SELECT Id,NamespacePrefix FROM PackageLicense WHERE NamespacePrefix='+quote(ns)+' LIMIT 2',false);
            if(!packages.isEmpty()){
                String packageName;try{List<Object> installed=rows('SELECT SubscriberPackage.Name FROM InstalledSubscriberPackage WHERE SubscriberPackage.NamespacePrefix='+quote(ns)+' LIMIT 2',true);if(installed.size()==1)packageName=str(((Map<String,Object>)((Map<String,Object>)installed[0]).get('SubscriberPackage')).get('Name'));}catch(Exception ex){warnings.add('Installed package name was inaccessible; package licence namespace is shown explicitly.');}
                for(Object raw:packages){Map<String,Object> p=(Map<String,Object>)raw;card(cards,'PackageLicense',str(p.get('Id')),(packageName==null?'Package namespace: '+ns:packageName+' ['+ns+']'),ns,'Package licence record for the selected app namespace; not a per-user assignment check.');}
            }
        }
        Boolean hasLicence=false;for(Object raw:cards)if(((String)((Map<String,Object>)raw).get('type')).endsWith('License'))hasLicence=true;
        if(!cards.isEmpty()&&!hasLicence)warnings.add('No explicit licence binding was found for the discovered permission sets or selected app package. No licence requirement is inferred.');
        if(cards.isEmpty())warnings.add('No named permission sets or bound licences were resolved for this app. This does not mean that no access configuration is required.');
        warnings.add('Named access coverage: explicit app visibility and reached Apex class grants, bound permission-set/user licences, and selected-app package licences. Profiles, permission-set groups, indirect feature licences and user assignments are not inferred.');
        return JSON.serialize(new Map<String,Object>{'cards'=>cards,'warnings'=>warnings,'reasons'=>reasons});
    }
}
