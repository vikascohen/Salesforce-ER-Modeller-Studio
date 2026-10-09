public with sharing class ErMcpSettingsController {
    private static void requireAdmin() {
        if (!FeatureManagement.checkPermission('ER_MCP_Admin')) throw new AuraHandledException('MCP administrator permission required.');
    }
    @AuraEnabled public static MCP_Settings__c getSettings() {requireAdmin();return ErMcpCore.settings();}
    @AuraEnabled public static void saveSettings(Boolean statusEnabled,Boolean usageEnabled,Boolean changedEnabled,Boolean scanEnabled,Integer cooldownHours,Integer retentionDays) {
        requireAdmin();
        if(cooldownHours==null||cooldownHours<0||cooldownHours>8760||retentionDays==null||retentionDays<1||retentionDays>3650) throw new AuraHandledException('Invalid cooldown or retention range.');
        MCP_Settings__c row=ErMcpCore.settings();
        row.Status_Enabled__c=statusEnabled;row.Usage_Enabled__c=usageEnabled;row.Changed_Enabled__c=changedEnabled;row.Scan_Enabled__c=scanEnabled;
        row.Cooldown_Hours__c=cooldownHours;row.Log_Retention_Days__c=retentionDays;
        upsert row;
    }
    public class LogSummary {
        @AuraEnabled public Integer today;@AuraEnabled public Integer lastSevenDays;@AuraEnabled public List<MCP_Tool_Log__c> rows;
    }
    @AuraEnabled public static LogSummary getLogs(String method,String outcome,Integer limitRows) {
        requireAdmin();
        Integer lim=limitRows==null?100:Math.max(1,Math.min(500,limitRows));
        Datetime todayStart=Datetime.newInstance(Date.today(),Time.newInstance(0,0,0,0));
        Datetime weekStart=System.now().addDays(-7);
        LogSummary summary=new LogSummary();
        summary.today=[SELECT COUNT() FROM MCP_Tool_Log__c WHERE CreatedDate>=:todayStart];
        summary.lastSevenDays=[SELECT COUNT() FROM MCP_Tool_Log__c WHERE CreatedDate>=:weekStart];
        if (String.isBlank(method) && String.isBlank(outcome)) {
            summary.rows=[SELECT Id,CreatedDate,CreatedBy.Name,Tool__c,Requested_Key__c,Outcome__c,Duration_Ms__c,Detail__c FROM MCP_Tool_Log__c ORDER BY CreatedDate DESC LIMIT :lim];
        } else if (String.isBlank(method)) {
            summary.rows=[SELECT Id,CreatedDate,CreatedBy.Name,Tool__c,Requested_Key__c,Outcome__c,Duration_Ms__c,Detail__c FROM MCP_Tool_Log__c WHERE Outcome__c=:outcome ORDER BY CreatedDate DESC LIMIT :lim];
        } else if (String.isBlank(outcome)) {
            summary.rows=[SELECT Id,CreatedDate,CreatedBy.Name,Tool__c,Requested_Key__c,Outcome__c,Duration_Ms__c,Detail__c FROM MCP_Tool_Log__c WHERE Tool__c=:method ORDER BY CreatedDate DESC LIMIT :lim];
        } else {
            summary.rows=[SELECT Id,CreatedDate,CreatedBy.Name,Tool__c,Requested_Key__c,Outcome__c,Duration_Ms__c,Detail__c FROM MCP_Tool_Log__c WHERE Tool__c=:method AND Outcome__c=:outcome ORDER BY CreatedDate DESC LIMIT :lim];
        }
        return summary;
    }
}