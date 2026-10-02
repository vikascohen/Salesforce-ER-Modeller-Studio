/** Tooling API access for UI metadata and validation-rule scanning. @author Vikas Cohen */
public without sharing class FieldUsageUiToolingClient {
    private static final String API_VERSION='v60.0';
    private static final String NAMED_CREDENTIAL='callout:Salesforce_Tooling_API';

    public class UiComponent {
        public String id;
        public String name;
        public String body;
        public String sourceType;
        public String objectName;
        public Boolean active;
    }

    public static List<UiComponent> getLwcBundleIndex(){return queryIndex('LightningComponentBundle','DeveloperName','LWC');}
    public static List<UiComponent> getAuraBundleIndex(){return queryIndex('AuraDefinitionBundle','DeveloperName','Aura');}
    public static List<UiComponent> getLwcResources(Set<String> bundleIds){return queryResources('LightningComponentResource','LightningComponentBundleId','FilePath','LightningComponentBundle','LWC',bundleIds);}
    public static List<UiComponent> getAuraResources(Set<String> bundleIds){return queryResources('AuraDefinition','AuraDefinitionBundleId','DefType','AuraDefinitionBundle','Aura',bundleIds);}

    /**
     * Keep ValidationRule discovery deliberately shallow. Relationship traversal from
     * ValidationRule to EntityDefinition is known to produce UNKNOWN_EXCEPTION/HTTP 500
     * in some orgs. Resolve EntityDefinition names in a separate query instead.
     */
    public static List<UiComponent> getValidationRuleIndex(){
        List<Map<String,Object>> records=queryAll('SELECT Id,ValidationName,Active,EntityDefinitionId FROM ValidationRule ORDER BY ValidationName','Validation Rule index');
        Map<String,String> entityNames=resolveEntityNames(records);
        List<UiComponent> out=new List<UiComponent>();
        for(Map<String,Object> record:records){
            UiComponent c=new UiComponent();
            c.id=(String)record.get('Id');
            c.name=(String)record.get('ValidationName');
            c.active=(Boolean)record.get('Active');
            String entityId=record.get('EntityDefinitionId')==null?null:String.valueOf(record.get('EntityDefinitionId'));
            c.objectName=entityNames.get(entityId);
            c.sourceType='Validation Rule';
            out.add(c);
        }
        return out;
    }

    /** Up to 25 single-record Tooling queries are sent in one REST Composite callout. */
    public static List<UiComponent> getValidationRules(Set<String> ids){
        List<UiComponent> out=new List<UiComponent>();
        if(ids==null||ids.isEmpty())return out;
        List<String> ordered=new List<String>(ids);
        Integer cursor=0;
        while(cursor<ordered.size()){
            List<Object> requests=new List<Object>();
            Integer batchEnd=Math.min(cursor+25,ordered.size());
            for(Integer i=cursor;i<batchEnd;i++){
                String id=ordered[i];
                String soql='SELECT Id,ValidationName,Active,EntityDefinitionId,Metadata FROM ValidationRule WHERE Id=\''+String.escapeSingleQuotes(id)+'\'';
                requests.add(new Map<String,Object>{'method'=>'GET','url'=>'/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8'),'referenceId'=>'vr'+String.valueOf(i-cursor)});
            }
            HttpRequest req=new HttpRequest();
            req.setEndpoint(NAMED_CREDENTIAL+'/services/data/'+API_VERSION+'/composite');
            req.setMethod('POST'); req.setHeader('Content-Type','application/json'); req.setHeader('Accept','application/json'); req.setTimeout(120000);
            req.setBody(JSON.serialize(new Map<String,Object>{'allOrNone'=>false,'compositeRequest'=>requests}));
            HttpResponse response=new Http().send(req);
            if(response.getStatusCode()<200||response.getStatusCode()>=300)throw new FieldUsageUiToolingException('Validation Rule composite request failed with HTTP '+response.getStatusCode()+': '+String.valueOf(response.getBody()).left(1000));
            Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
            List<Object> responses=(List<Object>)payload.get('compositeResponse'); if(responses==null)responses=new List<Object>();
            List<Map<String,Object>> successfulRecords=new List<Map<String,Object>>();
            for(Object raw:responses){
                Map<String,Object> item=(Map<String,Object>)raw;
                Integer status=Integer.valueOf(String.valueOf(item.get('httpStatusCode')));
                if(status<200||status>=300)continue;
                Map<String,Object> queryBody=(Map<String,Object>)item.get('body'); if(queryBody==null)continue;
                List<Object> rows=queryBody.get('records') instanceof List<Object>?(List<Object>)queryBody.get('records'):new List<Object>();
                if(!rows.isEmpty())successfulRecords.add((Map<String,Object>)rows[0]);
            }
            Map<String,String> entityNames=resolveEntityNames(successfulRecords);
            for(Map<String,Object> body:successfulRecords){
                UiComponent c=new UiComponent();
                c.id=(String)body.get('Id'); c.name=(String)body.get('ValidationName'); c.active=(Boolean)body.get('Active');
                String entityId=body.get('EntityDefinitionId')==null?null:String.valueOf(body.get('EntityDefinitionId'));
                c.objectName=entityNames.get(entityId);
                Object metadata=body.get('Metadata');
                if(metadata instanceof Map<String,Object>){Map<String,Object> md=(Map<String,Object>)metadata;c.body=md.get('errorConditionFormula')==null?null:String.valueOf(md.get('errorConditionFormula'));}
                c.sourceType='Validation Rule'; out.add(c);
            }
            cursor=batchEnd;
        }
        return out;
    }

    private static Map<String,String> resolveEntityNames(List<Map<String,Object>> records){
        Map<String,String> out=new Map<String,String>(); Set<String> entityIds=new Set<String>();
        for(Map<String,Object> record:records)if(record.get('EntityDefinitionId')!=null)entityIds.add(String.valueOf(record.get('EntityDefinitionId')));
        if(entityIds.isEmpty())return out;
        List<String> quoted=new List<String>(); for(String id:entityIds)quoted.add('\''+String.escapeSingleQuotes(id)+'\'');
        String soql='SELECT DurableId,QualifiedApiName FROM EntityDefinition WHERE DurableId IN ('+String.join(quoted,',')+')';
        for(Map<String,Object> row:queryAll(soql,'Validation Rule entity-name resolution'))out.put(String.valueOf(row.get('DurableId')),String.valueOf(row.get('QualifiedApiName')));
        return out;
    }

    private static List<UiComponent> queryIndex(String toolingObject,String nameField,String sourceType){
        String soql='SELECT Id,'+nameField+' FROM '+toolingObject+' ORDER BY '+nameField; List<UiComponent> out=new List<UiComponent>();
        for(Map<String,Object> record:queryAll(soql,sourceType+' bundle index')){UiComponent c=new UiComponent();c.id=(String)record.get('Id');c.name=(String)record.get(nameField);c.sourceType=sourceType;out.add(c);}return out;
    }

    private static List<UiComponent> queryResources(String toolingObject,String bundleField,String resourceField,String bundleObject,String sourceType,Set<String> bundleIds){
        List<UiComponent> out=new List<UiComponent>(); if(bundleIds==null||bundleIds.isEmpty())return out;
        Map<String,String> bundleNames=new Map<String,String>(); List<String> quoted=new List<String>(); for(String id:bundleIds)quoted.add('\''+String.escapeSingleQuotes(id)+'\'');
        String parentSoql='SELECT Id,DeveloperName FROM '+bundleObject+' WHERE Id IN ('+String.join(quoted,',')+')';
        for(Map<String,Object> parent:queryAll(parentSoql,sourceType+' bundle names'))bundleNames.put(String.valueOf(parent.get('Id')),String.valueOf(parent.get('DeveloperName')));
        for(String bundleId:bundleIds){
            String soql='SELECT Id,'+bundleField+','+resourceField+',Source FROM '+toolingObject+' WHERE '+bundleField+'=\''+String.escapeSingleQuotes(bundleId)+'\' ORDER BY '+resourceField;
            for(Map<String,Object> record:queryAll(soql,sourceType+' resources for bundle '+bundleId)){
                UiComponent c=new UiComponent();c.id=(String)record.get('Id');c.body=(String)record.get('Source');c.sourceType=sourceType;
                String resourceName=String.valueOf(record.get(resourceField));String bundleName=bundleNames.get(bundleId);c.name=(String.isBlank(bundleName)?bundleId:bundleName)+' / '+resourceName;out.add(c);
            }
        }return out;
    }

    private static List<Map<String,Object>> queryAll(String soql,String operation){
        List<Map<String,Object>> out=new List<Map<String,Object>>(); String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');
        while(nextUrl!=null){HttpResponse response=send(nextUrl,operation);Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();for(Object raw:records)out.add((Map<String,Object>)raw);nextUrl=(String)payload.get('nextRecordsUrl');}return out;
    }

    private static HttpResponse send(String relativeUrl,String operation){
        HttpRequest request=new HttpRequest();request.setEndpoint(NAMED_CREDENTIAL+relativeUrl);request.setMethod('GET');request.setHeader('Accept','application/json');request.setTimeout(120000);HttpResponse response=new Http().send(request);
        if(response.getStatusCode()<200||response.getStatusCode()>=300)throw new FieldUsageUiToolingException(operation+' failed with HTTP '+response.getStatusCode()+': '+String.valueOf(response.getBody()).left(1000));return response;
    }

    public class FieldUsageUiToolingException extends Exception {}
}
