/**
 * @author Vikas Cohen
 */
public with sharing class ErMcpSettingsController {
    private static void requireAdmin() {
        if (!FeatureManagement.checkPermission('ER_MCP_Admin')) throw new AuraHandledException('MCP administrator permission required.');
    }
    @AuraEnabled public static MCP_Settings__c getSettings() {requireAdmin();return ErMcpCore.settings();}
    @AuraEnabled public static void saveSettings(Boolean statusEnabled,Boolean usageEnabled,Boolean changedEnabled,Boolean scanEnabled,Integer cooldownHours) {
        requireAdmin();
        if(cooldownHours==null||cooldownHours<0||cooldownHours>8760) throw new AuraHandledException('Invalid cooldown range.');
        MCP_Settings__c row=ErMcpCore.settings();
        row.Status_Enabled__c=statusEnabled;row.Usage_Enabled__c=usageEnabled;row.Changed_Enabled__c=changedEnabled;row.Scan_Enabled__c=scanEnabled;
        row.Cooldown_Hours__c=cooldownHours;
        upsert row;
    }
    public class RecentCall {
        @AuraEnabled public Datetime occurredAt;
        @AuraEnabled public String message;
    }
    public class RecentCalls {
        @AuraEnabled public Boolean configured;
        @AuraEnabled public List<RecentCall> rows=new List<RecentCall>();
    }
    @AuraEnabled public static RecentCalls getRecentCalls() {
        requireAdmin();
        RecentCalls result=new RecentCalls();
        List<ER_Diagnostic_Config__c> configs=[SELECT Configuration__c FROM ER_Diagnostic_Config__c WHERE Name='Default' LIMIT 1];
        if(configs.isEmpty() || String.isBlank(configs[0].Configuration__c)) return result;
        ErDiagnosticConfigController.Configuration config;
        try {config=(ErDiagnosticConfigController.Configuration)JSON.deserialize(configs[0].Configuration__c,ErDiagnosticConfigController.Configuration.class);}
        catch(Exception ignored) {return result;}
        if(config==null || config.enabled!=true || String.isBlank(config.objectApi) || String.isBlank(config.messageField)) return result;
        Map<String,Schema.SObjectType> objects=Schema.getGlobalDescribe();
        if(!objects.containsKey(config.objectApi)) return result;
        Schema.DescribeSObjectResult description=objects.get(config.objectApi).getDescribe();
        if(!description.isAccessible()) return result;
        Map<String,Schema.SObjectField> fields=description.fields.getMap();
        if(!fields.containsKey(config.messageField) || !fields.get(config.messageField).getDescribe().isAccessible()) return result;
        result.configured=true;
        // Filter on the server, then cap to five; never retrieve the Studio-wide history.
        String prefix='ER_STUDIO_MODELLER_MCP %';
        String query='SELECT CreatedDate,'+config.messageField+' FROM '+config.objectApi+
            ' WHERE '+config.messageField+' LIKE :prefix ORDER BY CreatedDate DESC LIMIT 5';
        try {
            for(SObject item:Database.queryWithBinds(query,new Map<String,Object>{'prefix'=>prefix},AccessLevel.USER_MODE)) {
                RecentCall row=new RecentCall();
                row.occurredAt=(Datetime)item.get('CreatedDate');
                row.message=(String)item.get(config.messageField);
                result.rows.add(row);
            }
        } catch(Exception ignored) {result.configured=false;result.rows.clear();}
        return result;
    }
}
