/** Snapshot-only object intelligence for Data Dictionary. No API calls occur while browsing. @author Vikas Cohen */
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
        if(String.isBlank(objectApiName)||Schema.getGlobalDescribe().get(objectApiName)==null)return result;
        loadSnapshot(objectApiName,result);
        return result;
    }
    private static void loadSnapshot(String objectApiName,Result result){
        List<Field_Usage_Run__c> runs=[SELECT Id FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c IN ('Completed','Completed With Errors') ORDER BY Completed_At__c DESC NULLS LAST LIMIT 1];
        if(runs.isEmpty()){result.toolingMessage='No successful Field Usage snapshot is available. Run a usage scan to collect metadata intelligence.';return;}
        Map<String,Boolean> flows=new Map<String,Boolean>(),triggers=new Map<String,Boolean>(),rules=new Map<String,Boolean>(),layouts=new Map<String,Boolean>(),recordTypes=new Map<String,Boolean>();
        for(Field_Usage_Evidence__c e:[SELECT Component_Name__c,Source_Type__c,Evidence_Type__c FROM Field_Usage_Evidence__c WHERE Run__c=:runs[0].Id AND Object_API_Name__c=:objectApiName AND Source_Type__c IN ('Flow','Apex Trigger','Trigger','Validation Rule','Page Layout','Record Type') LIMIT 10000]){
            if(String.isBlank(e.Component_Name__c))continue;
            Boolean active=String.isBlank(e.Evidence_Type__c)||!e.Evidence_Type__c.toLowerCase().contains('inactive');
            if(e.Source_Type__c=='Flow')flows.put(e.Component_Name__c,active);
            else if(e.Source_Type__c=='Validation Rule')rules.put(e.Component_Name__c,active);
            else if(e.Source_Type__c=='Page Layout')layouts.put(e.Component_Name__c,true);
            else if(e.Source_Type__c=='Record Type')recordTypes.put(e.Component_Name__c,true);
            else triggers.put(e.Component_Name__c,active);
        }
        result.flows=toNamedItems(flows);result.triggers=toNamedItems(triggers);result.validationRules=toNamedItems(rules);result.layouts=toNamedItems(layouts);result.recordTypes=toNamedItems(recordTypes);
        result.snapshotLoaded=true;result.toolingLoaded=true;result.toolingMessage=null;
    }
    private static List<NamedItem> toNamedItems(Map<String,Boolean> names){List<String> ordered=new List<String>(names.keySet());ordered.sort();List<NamedItem> out=new List<NamedItem>();for(String name:ordered)out.add(new NamedItem(name,names.get(name)));return out;}
}