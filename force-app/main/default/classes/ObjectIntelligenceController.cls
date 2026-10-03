/** Read-only, object-scoped metadata intelligence for Data Dictionary. @author Vikas Cohen */
public without sharing class ObjectIntelligenceController {
    private static final String API_VERSION='v60.0';
    private static final String NAMED_CREDENTIAL='callout:Salesforce_Tooling_API';
    public class NamedItem { @AuraEnabled public String name; @AuraEnabled public Boolean active; public NamedItem(String n,Boolean a){name=n;active=a;} }
    public class Result {
        @AuraEnabled public List<NamedItem> recordTypes=new List<NamedItem>();
        @AuraEnabled public List<NamedItem> layouts=new List<NamedItem>();
        @AuraEnabled public List<NamedItem> triggers=new List<NamedItem>();
        @AuraEnabled public List<NamedItem> validationRules=new List<NamedItem>();
        @AuraEnabled public List<NamedItem> flows=new List<NamedItem>();
        @AuraEnabled public Boolean toolingLoaded=false;
        @AuraEnabled public Boolean snapshotLoaded=false;
        @AuraEnabled public String toolingMessage;
    }
    @AuraEnabled(cacheable=true)
    public static Result getObjectIntelligence(String objectApiName){
        Result result=new Result();
        if(String.isBlank(objectApiName))return result;
        Schema.SObjectType objectType=Schema.getGlobalDescribe().get(objectApiName);
        if(objectType==null)return result;
        for(Schema.RecordTypeInfo info:objectType.getDescribe().getRecordTypeInfos()){
            if(!info.isAvailable()||info.isMaster())continue;
            result.recordTypes.add(new NamedItem(info.getName(),info.isActive()));
        }
        loadSnapshotAutomation(objectApiName,result);
        try{
            List<Map<String,Object>> entities=toolingQuery('SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName = '+quote(objectApiName)+' LIMIT 1');
            if(entities.isEmpty()){result.toolingMessage='Object metadata was not returned by Tooling API.';return result;}
            String durableId=stringValue(entities[0].get('DurableId'));
            for(Map<String,Object> row:toolingQuery('SELECT Id,Name FROM Layout WHERE TableEnumOrId = '+quote(durableId)+' ORDER BY Name'))
                result.layouts.add(new NamedItem(stringValue(row.get('Name')),true));
            for(Map<String,Object> row:toolingQuery('SELECT Id,Name,Status FROM ApexTrigger WHERE TableEnumOrId = '+quote(durableId)+' ORDER BY Name'))
                result.triggers.add(new NamedItem(stringValue(row.get('Name')),'Active'.equalsIgnoreCase(stringValue(row.get('Status')))));
            for(Map<String,Object> row:toolingQuery('SELECT Id,ValidationName,Active FROM ValidationRule WHERE EntityDefinitionId = '+quote(durableId)+' ORDER BY ValidationName'))
                result.validationRules.add(new NamedItem(stringValue(row.get('ValidationName')),booleanValue(row.get('Active'))));
            result.toolingLoaded=true;
        }catch(Exception ex){result.toolingMessage=ex.getMessage();}
        return result;
    }
    private static void loadSnapshotAutomation(String objectApiName,Result result){
        try{
            List<Field_Usage_Run__c> runs=[SELECT Id FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c IN ('Completed','Completed With Errors') ORDER BY Completed_At__c DESC NULLS LAST LIMIT 1];
            if(runs.isEmpty())return;
            Set<String> names=new Set<String>();
            for(Field_Usage_Evidence__c e:[SELECT Component_Name__c FROM Field_Usage_Evidence__c WHERE Run__c=:runs[0].Id AND Object_API_Name__c=:objectApiName AND Source_Type__c='Flow' LIMIT 2000])
                if(!String.isBlank(e.Component_Name__c))names.add(e.Component_Name__c);
            List<String> ordered=new List<String>(names);ordered.sort();
            for(String name:ordered)result.flows.add(new NamedItem(name,true));
            result.snapshotLoaded=true;
        }catch(Exception ignored){}
    }
    private static List<Map<String,Object>> toolingQuery(String soql){
        List<Map<String,Object>> out=new List<Map<String,Object>>();
        String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');
        Integer pages=0;
        while(nextUrl!=null&&pages++<10){
            HttpRequest req=new HttpRequest();req.setEndpoint(NAMED_CREDENTIAL+nextUrl);req.setMethod('GET');req.setHeader('Accept','application/json');req.setTimeout(20000);
            HttpResponse res=new Http().send(req);
            if(res.getStatusCode()<200||res.getStatusCode()>=300)throw new ObjectIntelligenceException('Tooling API HTTP '+res.getStatusCode());
            Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(res.getBody());
            List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();
            for(Object raw:records)out.add((Map<String,Object>)raw);
            nextUrl=stringValue(payload.get('nextRecordsUrl'));
        }
        return out;
    }
    private static String quote(String value){return '\''+String.escapeSingleQuotes(value)+'\'';}
    private static String stringValue(Object value){return value==null?null:String.valueOf(value);}
    private static Boolean booleanValue(Object value){return value!=null&&Boolean.valueOf(String.valueOf(value));}
    public class ObjectIntelligenceException extends Exception{}
}