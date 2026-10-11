/**
 * @author Vikas Cohen
 */
/** Configurable object logging; no DML is performed until the opt-in has passed validation. */
public without sharing class ErDiagnosticConfigController {
    private static void authorize() {
        if (!FeatureManagement.checkPermission('ER_MCP_Admin')) throw new AuraHandledException('ER Modeller administrator permission required.');
    }
    public class CheckResult {
        @AuraEnabled public Boolean valid;
        @AuraEnabled public String message;
        @AuraEnabled public Integer maxLength;
        @AuraEnabled public String fieldType;
        public CheckResult(Boolean ok, String detail) { valid=ok; message=detail; }
    }
    public class Mapping {
        public String field;
        public String value;
    }
    public class Configuration {
        public Boolean enabled;
        public String provider;
        public String parentObjectApi;
        public String parentLookupField;
        public List<Mapping> parentRequiredFields;
        public String objectApi;
        public String messageField;
        public Boolean severityEnabled;
        public String severityField;
        public String errorValue;
        public String warningValue;
        public List<Mapping> requiredFields;
    }
    @AuraEnabled public static String load() {
        authorize();
        List<ER_Diagnostic_Config__c> rows=[SELECT Configuration__c FROM ER_Diagnostic_Config__c WHERE Name='Default' LIMIT 1];
        return rows.isEmpty() ? '{"enabled":false,"requiredFields":[]}' : rows[0].Configuration__c;
    }
    @AuraEnabled public static CheckResult validateField(String objectApi, String fieldApi, Boolean forMessage) {
        authorize();
        CheckResult obj=validateObject(objectApi);
        if (!obj.valid) return obj;
        if (String.isBlank(fieldApi)) return new CheckResult(false,'Enter the field API name.');
        Schema.DescribeSObjectResult description=Schema.getGlobalDescribe().get(objectApi).getDescribe();
        Map<String,Schema.SObjectField> fields=description.fields.getMap();
        if (!fields.containsKey(fieldApi)) return new CheckResult(false,'Field '+fieldApi+' does not exist on '+objectApi+'.');
        Schema.DescribeFieldResult d=fields.get(fieldApi).getDescribe();
        if (!d.isCreateable()) return new CheckResult(false,'Field '+fieldApi+' is not createable for the current user.');
        CheckResult result=new CheckResult(true,'Field found: '+String.valueOf(d.getType())+'.');
        result.fieldType=String.valueOf(d.getType()); result.maxLength=d.getLength();
        if (forMessage && d.getType()!=Schema.DisplayType.String && d.getType()!=Schema.DisplayType.TextArea) return new CheckResult(false,'Message field must be Text or Text Area.');
        return result;
    }
    @AuraEnabled public static CheckResult validateObject(String objectApi) {
        authorize();
        if (String.isBlank(objectApi)) return new CheckResult(false,'Enter the full object API name.');
        Map<String,Schema.SObjectType> types=Schema.getGlobalDescribe();
        if (!types.containsKey(objectApi)) return new CheckResult(false,'Object '+objectApi+' does not exist in this Salesforce org. Check the API name and namespace.');
        if (!types.get(objectApi).getDescribe().isCreateable()) return new CheckResult(false,'You do not have Create permission on '+objectApi+'.');
        return new CheckResult(true,'Object found; record creation is permitted.');
    }
    private static Configuration parse(String jsonConfig) {
        if (String.isBlank(jsonConfig) || jsonConfig.length()>32000) throw new AuraHandledException('Invalid configuration size.');
        try { return (Configuration)JSON.deserialize(jsonConfig,Configuration.class); }
        catch (Exception e) { throw new AuraHandledException('Invalid configuration format.'); }
    }
    private static void checkConfig(Configuration c) {
        if (c==null) throw new AuraHandledException('Configuration is missing.');
        if (c.enabled!=true) return;
        if (c.provider!='custom' && c.provider!='simple' && !String.isBlank(c.provider)) throw new AuraHandledException('Unknown logging structure.');
        if (c.provider=='custom') {
            CheckResult parentResult=validateObject(c.parentObjectApi);
            if (!parentResult.valid) throw new AuraHandledException(parentResult.message);
            if (String.isBlank(c.parentLookupField)) throw new AuraHandledException('Child relationship field is required.');
            Map<String,Schema.SObjectType> types=Schema.getGlobalDescribe();
            if (!types.containsKey(c.objectApi)) throw new AuraHandledException('Child logging object does not exist.');
            Map<String,Schema.SObjectField> childFields=types.get(c.objectApi).getDescribe().fields.getMap();
            if (!childFields.containsKey(c.parentLookupField)) throw new AuraHandledException('Child relationship field does not exist.');
            Schema.DescribeFieldResult link=childFields.get(c.parentLookupField).getDescribe();
            if (!link.isCreateable() || link.getType()!=Schema.DisplayType.Reference) throw new AuraHandledException('Child relationship must be a writable lookup or master-detail field.');
            Boolean targetsParent=false;
            for (Schema.SObjectType referenceType:link.getReferenceTo()) if (referenceType.getDescribe().getName()==c.parentObjectApi) targetsParent=true;
            if (!targetsParent) throw new AuraHandledException('Child relationship does not reference the configured parent object.');
            Set<String> suppliedParentFields=new Set<String>();
            if(c.parentRequiredFields!=null) for(Mapping m:c.parentRequiredFields) {
                if(m==null || String.isBlank(m.field) || !suppliedParentFields.add(m.field.toLowerCase())) throw new AuraHandledException('Parent field mappings must be unique.');
                CheckResult fieldResult=validateField(c.parentObjectApi,m.field,false);
                if(!fieldResult.valid) throw new AuraHandledException(fieldResult.message);
                validateValue(c.parentObjectApi,m.field,m.value);
            }
            for (Schema.SObjectField parentField:types.get(c.parentObjectApi).getDescribe().fields.getMap().values()) {
                Schema.DescribeFieldResult d=parentField.getDescribe();
                if (d.isCreateable() && !d.isNillable() && !d.isDefaultedOnCreate() && !suppliedParentFields.contains(d.getName().toLowerCase())) throw new AuraHandledException('Parent field '+d.getName()+' requires a default-value mapping.');
            }
        }
        CheckResult objectResult=validateObject(c.objectApi);
        if (!objectResult.valid) throw new AuraHandledException(objectResult.message);
        CheckResult messageResult=validateField(c.objectApi,c.messageField,true);
        if (!messageResult.valid) throw new AuraHandledException(messageResult.message);
        if (c.severityEnabled==true) {
            CheckResult severityResult=validateField(c.objectApi,c.severityField,false);
            if (!severityResult.valid) throw new AuraHandledException(severityResult.message);
            validateValue(c.objectApi,c.severityField,c.errorValue);
            validateValue(c.objectApi,c.severityField,c.warningValue);
        }
        Set<String> used=new Set<String>{c.messageField.toLowerCase()};
        if (c.provider=='custom') used.add(c.parentLookupField.toLowerCase());
        if (c.severityEnabled==true) used.add(c.severityField.toLowerCase());
        if (c.requiredFields!=null) for (Mapping m:c.requiredFields) {
            if (m==null || String.isBlank(m.field) || used.contains(m.field.toLowerCase())) throw new AuraHandledException('Required field mappings must be unique and have an API name.');
            used.add(m.field.toLowerCase());
            CheckResult result=validateField(c.objectApi,m.field,false);
            if (!result.valid) throw new AuraHandledException(result.message);
            validateValue(c.objectApi,m.field,m.value);
        }
        Map<String,Schema.SObjectField> allFields=Schema.getGlobalDescribe().get(c.objectApi).getDescribe().fields.getMap();
        for (String api:allFields.keySet()) {
            Schema.DescribeFieldResult d=allFields.get(api).getDescribe();
            if (d.isCreateable() && !d.isNillable() && !d.isDefaultedOnCreate() && !used.contains(api.toLowerCase())) throw new AuraHandledException('Required field '+api+' needs a default-value mapping.');
        }
    }
    @TestVisible private static Object validateValue(String objectApi,String fieldApi,String value) {
        Schema.DescribeFieldResult d=Schema.getGlobalDescribe().get(objectApi).getDescribe().fields.getMap().get(fieldApi).getDescribe();
        if (String.isBlank(value)) throw new AuraHandledException('Provide a value for '+fieldApi+'.');
        try {
            if (d.getType()==Schema.DisplayType.Boolean) {if(value!='true' && value!='false') throw new TypeException('Boolean must be true or false'); return Boolean.valueOf(value);}
            if (d.getType()==Schema.DisplayType.Integer) return Integer.valueOf(value);
            if (d.getType()==Schema.DisplayType.Double || d.getType()==Schema.DisplayType.Currency || d.getType()==Schema.DisplayType.Percent) return Decimal.valueOf(value);
            if (d.getType()==Schema.DisplayType.Date) return Date.valueOf(value);
            if (d.getType()==Schema.DisplayType.DateTime) return Datetime.valueOf(value);
            if (d.getType()==Schema.DisplayType.Reference || d.getType()==Schema.DisplayType.Id) return Id.valueOf(value);
            if (d.getType()==Schema.DisplayType.Picklist) {
                if (d.isRestrictedPicklist()) {Boolean found=false;for (Schema.PicklistEntry entry:d.getPicklistValues()) if(entry.isActive() && entry.getValue()==value) found=true; if(!found) throw new TypeException('Value not allowed by restricted picklist');}
                return value;
            }
            if (d.getType()!=Schema.DisplayType.String && d.getType()!=Schema.DisplayType.TextArea && d.getType()!=Schema.DisplayType.Email && d.getType()!=Schema.DisplayType.Phone && d.getType()!=Schema.DisplayType.Url) throw new TypeException('Unsupported field type');
            if (value.length()>d.getLength()) throw new TypeException('Value exceeds field length');
            return value;
        } catch(Exception e) {throw new AuraHandledException('Invalid value for '+fieldApi+': '+e.getMessage());}
    }
    @AuraEnabled public static void save(String jsonConfig) {
        authorize();
        Configuration c=parse(jsonConfig);
        checkConfig(c);
        List<ER_Diagnostic_Config__c> rows=[SELECT Id FROM ER_Diagnostic_Config__c WHERE Name='Default' LIMIT 1];
        ER_Diagnostic_Config__c row=rows.isEmpty()?new ER_Diagnostic_Config__c(Name='Default'):rows[0];
        row.Configuration__c=jsonConfig;
        upsert row;
    }
    /** Called by application error capture. Failures never recurse or interrupt the application. */
    @AuraEnabled public static Boolean recordEvent(String message,String severity) {
        try {
            List<ER_Diagnostic_Config__c> rows=[SELECT Configuration__c FROM ER_Diagnostic_Config__c WHERE Name='Default' LIMIT 1];
            if(rows.isEmpty()) return false;
            Configuration c=parse(rows[0].Configuration__c);
            if(c.enabled!=true || String.isBlank(message) || (severity!='ERROR' && severity!='WARN' && severity!='INFO')) return false;
            // Configuration was validated at save time; do not require admin rights to emit an event.
            Schema.SObjectType target=Schema.getGlobalDescribe().get(c.objectApi);
            SObject record=target.newSObject();
            Schema.DescribeFieldResult msg=target.getDescribe().fields.getMap().get(c.messageField).getDescribe();
            Integer length=msg.getLength();
            record.put(c.messageField,message.length()>length?message.substring(0,length):message);
            if(c.severityEnabled==true) record.put(c.severityField,validateValue(c.objectApi,c.severityField,severity=='ERROR'?c.errorValue:c.warningValue));
            if(c.requiredFields!=null) for(Mapping m:c.requiredFields) record.put(m.field,validateValue(c.objectApi,m.field,m.value));
            if (c.provider=='custom') {
                Savepoint checkpoint=Database.setSavepoint();
                try {
                    SObject parent=Schema.getGlobalDescribe().get(c.parentObjectApi).newSObject();
                    if(c.parentRequiredFields!=null) for(Mapping m:c.parentRequiredFields) parent.put(m.field,validateValue(c.parentObjectApi,m.field,m.value));
                    Database.SaveResult parentResult=Database.insert(parent,false,AccessLevel.USER_MODE);
                    if (!parentResult.isSuccess()) {Database.rollback(checkpoint);return false;}
                    record.put(c.parentLookupField,parentResult.getId());
                    Database.SaveResult childResult=Database.insert(record,false,AccessLevel.USER_MODE);
                    if (!childResult.isSuccess()) {Database.rollback(checkpoint);return false;}
                    return true;
                } catch(Exception failed) {Database.rollback(checkpoint);return false;}
            }
            Database.SaveResult result=Database.insert(record,false,AccessLevel.USER_MODE);
            return result.isSuccess();
        } catch(Exception ignored) {return false;}
    }
}
