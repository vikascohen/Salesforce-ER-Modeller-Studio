/**
 * Tooling API access for Lightning Web Component and Aura field-usage scanning.
 * Kept separate from the Apex/Flow client so UI metadata scanning can evolve independently.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageUiToolingClient {
    private static final String API_VERSION='v60.0';
    private static final String NAMED_CREDENTIAL='callout:Salesforce_Tooling_API';

    public class UiComponent {
        public String id;
        public String name;
        public String body;
        public String sourceType;
    }

    public static List<UiComponent> getLwcBundleIndex(){
        return queryIndex('LightningComponentBundle','DeveloperName','LWC');
    }
    public static List<UiComponent> getAuraBundleIndex(){
        return queryIndex('AuraDefinitionBundle','DeveloperName','Aura');
    }
    public static List<UiComponent> getLwcResources(Set<String> bundleIds){
        return queryResources('LightningComponentResource','LightningComponentBundleId','FilePath','LightningComponentBundle.DeveloperName','LWC',bundleIds);
    }
    public static List<UiComponent> getAuraResources(Set<String> bundleIds){
        return queryResources('AuraDefinition','AuraDefinitionBundleId','DefType','AuraDefinitionBundle.DeveloperName','Aura',bundleIds);
    }

    private static List<UiComponent> queryIndex(String toolingObject,String nameField,String sourceType){
        String soql='SELECT Id,'+nameField+' FROM '+toolingObject+' ORDER BY '+nameField;
        List<UiComponent> out=new List<UiComponent>();
        for(Map<String,Object> record:queryAll(soql)){
            UiComponent c=new UiComponent(); c.id=(String)record.get('Id'); c.name=(String)record.get(nameField); c.sourceType=sourceType; out.add(c);
        }
        return out;
    }

    private static List<UiComponent> queryResources(String toolingObject,String bundleField,String resourceField,String bundleRelationship,String sourceType,Set<String> bundleIds){
        List<UiComponent> out=new List<UiComponent>();
        if(bundleIds==null||bundleIds.isEmpty())return out;
        List<String> quoted=new List<String>();
        for(String id:bundleIds)quoted.add('\''+String.escapeSingleQuotes(id)+'\'');
        String soql='SELECT Id,'+bundleField+','+resourceField+',Source,'+bundleRelationship+' FROM '+toolingObject+' WHERE '+bundleField+' IN ('+String.join(quoted,',')+') ORDER BY '+bundleField+','+resourceField;
        for(Map<String,Object> record:queryAll(soql)){
            UiComponent c=new UiComponent();
            c.id=(String)record.get('Id'); c.body=(String)record.get('Source'); c.sourceType=sourceType;
            String bundleName=relationshipName(record,bundleRelationship.substringBefore('.'));
            String resourceName=String.valueOf(record.get(resourceField));
            c.name=(String.isBlank(bundleName)?'Unknown bundle':bundleName)+' / '+resourceName;
            out.add(c);
        }
        return out;
    }

    private static String relationshipName(Map<String,Object> record,String relationshipKey){
        Object raw=record.get(relationshipKey);
        if(!(raw instanceof Map<String,Object>))return null;
        Map<String,Object> relationship=(Map<String,Object>)raw;
        Object value=relationship.get('DeveloperName');
        return value==null?null:String.valueOf(value);
    }

    private static List<Map<String,Object>> queryAll(String soql){
        List<Map<String,Object>> out=new List<Map<String,Object>>();
        String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');
        while(nextUrl!=null){
            HttpResponse response=send(nextUrl);
            Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
            List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();
            for(Object raw:records)out.add((Map<String,Object>)raw);
            nextUrl=(String)payload.get('nextRecordsUrl');
        }
        return out;
    }

    private static HttpResponse send(String relativeUrl){
        HttpRequest request=new HttpRequest(); request.setEndpoint(NAMED_CREDENTIAL+relativeUrl); request.setMethod('GET'); request.setHeader('Accept','application/json'); request.setTimeout(120000);
        HttpResponse response=new Http().send(request);
        if(response.getStatusCode()<200||response.getStatusCode()>=300)throw new FieldUsageUiToolingException('UI Tooling API request failed with HTTP '+response.getStatusCode()+': '+String.valueOf(response.getBody()).left(1000));
        return response;
    }
    public class FieldUsageUiToolingException extends Exception {}
}
