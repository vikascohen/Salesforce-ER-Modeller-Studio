/** Configurable exact Apex class exclusions. Only indexed classes are skipped; callers remain scanned. */
public without sharing class FieldUsageExclusionService {
    private static final String CONFIG_NAME='Field Usage Apex Exclusions';
    private static final String DEFAULT_NAMES='Logger,Logger_Tests,LogEntryEventBuilder_Tests,LogEntryEventHandler_Tests';
    @AuraEnabled(cacheable=true)
    public static String getExcludedClassNames(){
        List<ER_Diagnostic_Config__c> configs=[SELECT Configuration__c FROM ER_Diagnostic_Config__c WHERE Name=:CONFIG_NAME ORDER BY CreatedDate DESC LIMIT 1];
        return configs.isEmpty()?DEFAULT_NAMES:configs[0].Configuration__c;
    }
    @AuraEnabled
    public static void saveExcludedClassNames(String names){
        if(String.isBlank(names))names='';
        if(names.length()>32000)throw new AuraHandledException('Exclusion list is too long.');
        Map<String,String> uniqueNames=new Map<String,String>();
        for(String raw:names.split('[,\\n;]')){
            String name=raw.trim();if(String.isBlank(name))continue;
            if(!Pattern.matches('[A-Za-z_][A-Za-z0-9_]*',name))throw new AuraHandledException('Use exact Apex class names separated by commas or new lines. Invalid: '+name.left(80));
            uniqueNames.put(name.toLowerCase(),name);
        }
        List<String> sortedNames=new List<String>();sortedNames.addAll(uniqueNames.values());sortedNames.sort();
        List<ER_Diagnostic_Config__c> configs=[SELECT Id,Configuration__c FROM ER_Diagnostic_Config__c WHERE Name=:CONFIG_NAME ORDER BY CreatedDate DESC LIMIT 1];
        ER_Diagnostic_Config__c config=configs.isEmpty()?new ER_Diagnostic_Config__c(Name=CONFIG_NAME):configs[0];
        config.Configuration__c=String.join(sortedNames,',');upsert config;
    }
    public static Set<String> excludedNames(){
        Set<String> names=new Set<String>();
        for(String raw:getExcludedClassNames().split('[,\\n;]'))if(!String.isBlank(raw))names.add(raw.trim().toLowerCase());
        return names;
    }
    public static Boolean shouldExclude(String name,Set<String> names){return !String.isBlank(name)&&names.contains(name.toLowerCase());}
}
