public with sharing class ErMcpCore {
    public class DisabledException extends Exception {}
    public class InvalidRequestException extends Exception {}
    public static MCP_Settings__c settings() {
        List<MCP_Settings__c> rows = [SELECT Id,Status_Enabled__c,Usage_Enabled__c,Changed_Enabled__c,Scan_Enabled__c,Cooldown_Hours__c,Log_Retention_Days__c FROM MCP_Settings__c WHERE Name='Default' LIMIT 1];
        if (!rows.isEmpty()) return rows[0];
        MCP_Settings__c defaults = new MCP_Settings__c(Name='Default',Status_Enabled__c=true,Usage_Enabled__c=true,Changed_Enabled__c=true,Scan_Enabled__c=true,Cooldown_Hours__c=24,Log_Retention_Days__c=30);
        return defaults;
    }
    public static void requireEnabled(Boolean enabled) {
        if (enabled != true) throw new DisabledException('disabled by administrator');
    }
    public static void logCall(String method, String requested, String outcome, Long started, String detail) {
        try {
            insert new MCP_Tool_Log__c(Tool__c=method,Requested_Key__c=String.isBlank(requested)?null:requested.left(255),Outcome__c=outcome,Duration_Ms__c=System.now().getTime()-started,Detail__c=String.isBlank(detail)?null:detail.left(255));
        } catch (Exception ignored) { /* Logging must not override a successful read. */ }
    }
    public static String snapshotContext() {
        List<Field_Usage_Run__c> runs = [SELECT Id,Completed_At__c,Dependency_Count__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];
        List<Field_Usage_Run__c> active = [SELECT Id,Status__c FROM Field_Usage_Run__c WHERE Status__c IN ('Queued','Running') ORDER BY CreatedDate DESC LIMIT 1];
        Map<String,Object> result = new Map<String,Object>{'snapshotId'=>null,'snapshotDate'=>null,'dependencyCount'=>0,'activeRunId'=>null,'activeRunStatus'=>null,'scannerFamilies'=>new List<String>{'Apex Class','Apex Trigger','Flow','LWC','Aura','Validation Rule','Formula Field'}};
        if (!runs.isEmpty()) {result.put('snapshotId',runs[0].Id);result.put('snapshotDate',runs[0].Completed_At__c);result.put('dependencyCount',runs[0].Dependency_Count__c);}
        if (!active.isEmpty()) {result.put('activeRunId',active[0].Id);result.put('activeRunStatus',active[0].Status__c);}
        return JSON.serialize(result);
    }
}