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
}
