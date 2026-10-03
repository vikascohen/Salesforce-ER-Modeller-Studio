/** Tooling API access for UI metadata and validation-rule scanning. @author Vikas Cohen */
public without sharing class FieldUsageUiToolingClient {
    private static final String API_VERSION='v60.0';
    private static final String NAMED_CREDENTIAL='callout:Salesforce_Tooling_API';
    public class UiComponent { public String id; public String name; public String body; public String sourceType; public String objectName; public Boolean active; }
    public static List<UiComponent> getLwcBundleIndex(){return queryIndex('LightningComponentBundle','DeveloperName','LWC');}
    public static List<UiComponent> getAuraBundleIndex(){return queryIndex('AuraDefinitionBundle','DeveloperName','Aura');}
    public static List<UiComponent> getLwcResources(Set<String> bundleIds){return queryResources('LightningComponentResource','LightningComponentBundleId','FilePath','LightningComponentBundle','LWC',bundleIds);}
    public static List<UiComponent> getAuraResources(Set<String> bundleIds){return queryResources('AuraDefinition','AuraDefinitionBundleId','DefType','AuraDefinitionBundle','Aura',bundleIds);}
    public static List<UiComponent> getValidationRuleIndex(){
        List<Map<String,Object>> records=queryAll('SELECT Id,ValidationName,Active,EntityDefinition.QualifiedApiName FROM ValidationRule ORDER BY ValidationName','Validation Rule index');
        List<UiComponent> out=new List<UiComponent>();for(Map<String,Object> record:records){UiComponent c=new UiComponent();c.id=stringValue(record.get('Id'));c.name=stringValue(record.get('ValidationName'));c.active=booleanValue(record.get('Active'));c.objectName=relationshipQualifiedApiName(record);c.sourceType='Validation Rule';out.add(c);}return out;
    }
    /** Object-scoped Page Layout lookup used only by Data Dictionary Object Intelligence. */
    public static List<UiComponent> getLayoutsForObject(String objectApiName){
        List<UiComponent> out=new List<UiComponent>();
        if(String.isBlank(objectApiName))return out;
        String tableKey=objectApiName;
        if(objectApiName.endsWith('__c')){
            List<Map<String,Object>> defs=queryAll('SELECT DurableId,QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName=\''+String.escapeSingleQuotes(objectApiName)+'\' LIMIT 1','EntityDefinition for '+objectApiName);
            if(!defs.isEmpty()&&!String.isBlank(stringValue(defs[0].get('DurableId'))))tableKey=stringValue(defs[0].get('DurableId'));
        }
        String soql='SELECT Id,Name,TableEnumOrId FROM Layout WHERE TableEnumOrId=\''+String.escapeSingleQuotes(tableKey)+'\' ORDER BY Name';
        for(Map<String,Object> record:queryAll(soql,'Page Layouts for '+objectApiName)){
            UiComponent c=new UiComponent();c.id=stringValue(record.get('Id'));c.name=stringValue(record.get('Name'));c.objectName=objectApiName;c.sourceType='Page Layout';c.active=true;out.add(c);
        }
        return out;
    }
    /** Retrieve Validation Rule metadata directly through Tooling API. The REST Composite endpoint is a Data API resource and rejects Tooling API subrequests. */
    public static List<UiComponent> getValidationRules(Set<String> ids){
        List<UiComponent> out=new List<UiComponent>();
        if(ids==null||ids.isEmpty())return out;
        List<String> ordered=new List<String>(ids);
        ordered.sort();
        List<String> retrievalErrors=new List<String>();
        for(String id:ordered){
            String soql='SELECT Id,ValidationName,Active,EntityDefinition.QualifiedApiName,Metadata FROM ValidationRule WHERE Id=\''+String.escapeSingleQuotes(id)+'\' LIMIT 1';
            try{
                List<Map<String,Object>> rows=queryAll(soql,'Validation Rule '+id);
                if(rows.isEmpty()){retrievalErrors.add('Validation Rule '+id+' was not returned by Tooling API');continue;}
                Map<String,Object> record=rows[0];
                UiComponent c=new UiComponent();
                c.id=stringValue(record.get('Id'));
                c.name=stringValue(record.get('ValidationName'));
                c.active=booleanValue(record.get('Active'));
                c.objectName=relationshipQualifiedApiName(record);
                Object metadata=record.get('Metadata');
                if(metadata instanceof Map<String,Object>){
                    Map<String,Object> md=(Map<String,Object>)metadata;
                    c.body=firstNonBlank(new List<String>{stringValue(md.get('errorConditionFormula')),stringValue(md.get('ErrorConditionFormula')),stringValue(md.get('formula')),stringValue(md.get('Formula'))});
                }
                if(String.isBlank(c.body))c.body=firstNonBlank(new List<String>{stringValue(record.get('ErrorConditionFormula')),stringValue(record.get('errorConditionFormula'))});
                c.sourceType='Validation Rule';
                if(String.isBlank(c.objectName))retrievalErrors.add('Unable to resolve object for Validation Rule '+c.name);
                else if(String.isBlank(c.body))retrievalErrors.add('No formula metadata returned for Validation Rule '+c.name);
                else out.add(c);
            }catch(FieldUsageUiToolingException ex){retrievalErrors.add(ex.getMessage());}
        }
        if(!retrievalErrors.isEmpty())throw new FieldUsageUiToolingException('Validation Rule retrieval incomplete: '+String.join(retrievalErrors,' | ').left(3500));
        return out;
    }
    private static String relationshipQualifiedApiName(Map<String,Object> record){Object raw=record.get('EntityDefinition');if(raw instanceof Map<String,Object>){String value=stringValue(((Map<String,Object>)raw).get('QualifiedApiName'));if(!String.isBlank(value))return value;}return firstNonBlank(new List<String>{stringValue(record.get('Object_API_Name__c')),stringValue(record.get('QualifiedApiName'))});}
    private static String firstNonBlank(List<String> values){for(String value:values)if(!String.isBlank(value))return value;return null;}
    private static Boolean booleanValue(Object value){return value==null?null:Boolean.valueOf(String.valueOf(value));}
    private static String stringValue(Object value){return value==null?null:String.valueOf(value);}
    private static List<UiComponent> queryIndex(String toolingObject,String nameField,String sourceType){String soql='SELECT Id,'+nameField+' FROM '+toolingObject+' ORDER BY '+nameField;List<UiComponent> out=new List<UiComponent>();for(Map<String,Object> record:queryAll(soql,sourceType+' bundle index')){UiComponent c=new UiComponent();c.id=stringValue(record.get('Id'));c.name=stringValue(record.get(nameField));c.sourceType=sourceType;out.add(c);}return out;}
    private static List<UiComponent> queryResources(String toolingObject,String bundleField,String resourceField,String bundleObject,String sourceType,Set<String> bundleIds){List<UiComponent> out=new List<UiComponent>();if(bundleIds==null||bundleIds.isEmpty())return out;Map<String,String> bundleNames=new Map<String,String>();List<String> quoted=new List<String>();for(String id:bundleIds)quoted.add('\''+String.escapeSingleQuotes(id)+'\'');String parentSoql='SELECT Id,DeveloperName FROM '+bundleObject+' WHERE Id IN ('+String.join(quoted,',')+')';for(Map<String,Object> parent:queryAll(parentSoql,sourceType+' bundle names'))bundleNames.put(stringValue(parent.get('Id')),stringValue(parent.get('DeveloperName')));for(String bundleId:bundleIds){String soql='SELECT Id,'+bundleField+','+resourceField+',Source FROM '+toolingObject+' WHERE '+bundleField+'=\''+String.escapeSingleQuotes(bundleId)+'\' ORDER BY '+resourceField;for(Map<String,Object> record:queryAll(soql,sourceType+' resources for bundle '+bundleId)){UiComponent c=new UiComponent();c.id=stringValue(record.get('Id'));c.body=stringValue(record.get('Source'));c.sourceType=sourceType;String resourceName=stringValue(record.get(resourceField));String bundleName=bundleNames.get(bundleId);c.name=(String.isBlank(bundleName)?'Unknown bundle':bundleName)+' / '+resourceName;out.add(c);}}return out;}
    private static List<Map<String,Object>> querySinglePage(String soql,String operation){HttpResponse response=send('/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8'),operation);Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());List<Map<String,Object>> out=new List<Map<String,Object>>();List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();for(Object raw:records)out.add((Map<String,Object>)raw);return out;}
    private static List<Map<String,Object>> queryAll(String soql,String operation){List<Map<String,Object>> out=new List<Map<String,Object>>();String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');while(nextUrl!=null){HttpResponse response=send(nextUrl,operation);Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();for(Object raw:records)out.add((Map<String,Object>)raw);nextUrl=stringValue(payload.get('nextRecordsUrl'));}return out;}
    private static HttpResponse send(String relativeUrl,String operation){HttpRequest request=new HttpRequest();request.setEndpoint(NAMED_CREDENTIAL+relativeUrl);request.setMethod('GET');request.setHeader('Accept','application/json');request.setTimeout(120000);HttpResponse response=new Http().send(request);if(response.getStatusCode()<200||response.getStatusCode()>=300)throw new FieldUsageUiToolingException(operation+' failed with HTTP '+response.getStatusCode()+': '+String.valueOf(response.getBody()).left(1000));return response;}
    public class FieldUsageUiToolingException extends Exception {}
}