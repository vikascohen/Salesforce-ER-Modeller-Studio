/** Object-scoped intelligence for Data Dictionary. Snapshot dependencies stay persisted; object metadata is fetched only when the user opens an object. @author Vikas Cohen */
public without sharing class ObjectIntelligenceController {
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
        Schema.SObjectType objectType=String.isBlank(objectApiName)?null:Schema.getGlobalDescribe().get(objectApiName);
        if(objectType==null)return result;
        loadSnapshot(objectApiName,result);
        loadRecordTypes(objectType,result);
        loadLayouts(objectApiName,result);
        return result;
    }
    private static void loadRecordTypes(Schema.SObjectType objectType,Result result){
        List<NamedItem> items=new List<NamedItem>();
        for(Schema.RecordTypeInfo info:objectType.getDescribe().getRecordTypeInfos()){
            if(info.isMaster())continue;
            String label=info.getName();
            if(String.isBlank(label))label=info.getDeveloperName();
            items.add(new NamedItem(label,info.isAvailable()));
        }
        result.recordTypes=items;
    }
    private static void loadLayouts(String objectApiName,Result result){
        try{
            List<NamedItem> items=new List<NamedItem>();
            for(FieldUsageUiToolingClient.UiComponent layout:FieldUsageUiToolingClient.getLayoutsForObject(objectApiName))items.add(new NamedItem(layout.name,true));
            result.layouts=items;
            result.toolingLoaded=true;
        }catch(Exception ex){
            result.toolingLoaded=false;
            result.toolingMessage='Page Layout metadata unavailable: '+ex.getMessage();
        }
    }
    private static void loadSnapshot(String objectApiName,Result result){
        List<Field_Usage_Run__c> runs=[SELECT Id FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c IN ('Completed','Completed With Errors') ORDER BY Completed_At__c DESC NULLS LAST LIMIT 1];
        if(runs.isEmpty())return;
        Map<String,Boolean> flows=new Map<String,Boolean>(),triggers=new Map<String,Boolean>(),rules=new Map<String,Boolean>();
        for(Field_Usage_Evidence__c e:[SELECT Component_Name__c,Source_Type__c,Evidence_Type__c FROM Field_Usage_Evidence__c WHERE Run__c=:runs[0].Id AND Object_API_Name__c=:objectApiName AND Source_Type__c IN ('Flow','Apex Trigger','Trigger','Validation Rule') LIMIT 10000]){
            if(String.isBlank(e.Component_Name__c))continue;
            Boolean active=String.isBlank(e.Evidence_Type__c)||!e.Evidence_Type__c.toLowerCase().contains('inactive');
            if(e.Source_Type__c=='Flow')flows.put(e.Component_Name__c,active);
            else if(e.Source_Type__c=='Validation Rule')rules.put(e.Component_Name__c,active);
            else triggers.put(e.Component_Name__c,active);
        }
        result.flows=toNamedItems(flows);result.triggers=toNamedItems(triggers);result.validationRules=toNamedItems(rules);result.snapshotLoaded=true;
    }
    private static List<NamedItem> toNamedItems(Map<String,Boolean> names){List<String> ordered=new List<String>(names.keySet());ordered.sort();List<NamedItem> out=new List<NamedItem>();for(String name:ordered)out.add(new NamedItem(name,names.get(name)));return out;}
}