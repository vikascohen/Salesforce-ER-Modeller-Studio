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
        // Fast local fallback first. A completed Field Usage snapshot must remain useful even
        // when the interactive user cannot access the Tooling Named Credential.
        loadSnapshotAutomation(objectApiName,result);
        try{
            List<Map<String,Object>> entities=toolingQuery('SELECT DurableId FROM EntityDefinition WHERE QualifiedApiName = '+quote(objectApiName)+' LIMIT 1');
            if(entities.isEmpty()){result.toolingMessage='Object metadata was not returned by Tooling API.';return result;}
            String durableId=stringValue(entities[0].get('DurableId'));
            for(Map<String,Object> row:toolingQuery('SELECT Id,Name FROM Layout WHERE TableEnumOrId = '+quote(durableId)+' ORDER BY Name'))
                result.layouts.add(new NamedItem(stringValue(row.get('Name')),true));
            // Tooling is authoritative for trigger/rule inventory when available. Replace the
            // scan fallback rather than merging and risking duplicate names.
            List<NamedItem> toolingTriggers=new List<NamedItem>();
            for(Map<String,Object> row:toolingQuery('SELECT Id,Name,Status FROM ApexTrigger WHERE TableEnumOrId = '+quote(durableId)+' ORDER BY Name'))
                toolingTriggers.add(new NamedItem(stringValue(row.get('Name')),'Active'.equalsIgnoreCase(stringValue(row.get('Status')))));
            List<NamedItem> toolingRules=new List<NamedItem>();
            for(Map<String,Object> row:toolingQuery('SELECT Id,ValidationName,Active FROM ValidationRule WHERE EntityDefinitionId = '+quote(durableId)+' ORDER BY ValidationName'))
                toolingRules.add(new NamedItem(stringValue(row.get('ValidationName')),booleanValue(row.get('Active'))));
            result.triggers=toolingTriggers;
            result.validationRules=toolingRules;
            result.toolingLoaded=true;
        }catch(Exception ex){result.toolingMessage=ex.getMessage();}
        return result;
    }
    private static void loadSnapshotAutomation(String objectApiName,Result result){
        try{
            List<Field_Usage_Run__c> runs=[SELECT Id FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c IN ('Completed','Completed With Errors') ORDER BY Completed_At__c DESC NULLS LAST LIMIT 1];
            if(runs.isEmpty())return;
            Map<String,Boolean> flowNames=new Map<String,Boolean>();
            Map<String,Boolean> triggerNames=new Map<String,Boolean>();
            Map<String,Boolean> ruleNames=new Map<String,Boolean>();
            for(Field_Usage_Evidence__c e:[SELECT Component_Name__c,Source_Type__c,Evidence_Type__c FROM Field_Usage_Evidence__c WHERE Run__c=:runs[0].Id AND Object_API_Name__c=:objectApiName AND Source_Type__c IN ('Flow','Apex Trigger','Trigger','Validation Rule') LIMIT 5000]){
                if(String.isBlank(e.Component_Name__c))continue;
                String source=e.Source_Type__c;
                Boolean active=String.isBlank(e.Evidence_Type__c)||!e.Evidence_Type__c.toLowerCase().contains('inactive');
                if(source=='Flow')flowNames.put(e.Component_Name__c,active);
                else if(source=='Validation Rule')ruleNames.put(e.Component_Name__c,active);
                else triggerNames.put(e.Component_Name__c,active);
            }
            result.flows=toNamedItems(flowNames);
            result.triggers=toNamedItems(triggerNames);
            result.validationRules=toNamedItems(ruleNames);
            result.snapshotLoaded=true;
        }catch(Exception ignored){}
    }
    private static List<NamedItem> toNamedItems(Map<String,Boolean> names){
        List<String> ordered=new List<String>(names.keySet());ordered.sort();
        List<NamedItem> out=new List<NamedItem>();for(String name:ordered)out.add(new NamedItem(name,names.get(name)));return out;
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