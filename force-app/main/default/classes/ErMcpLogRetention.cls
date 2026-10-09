public without sharing class ErMcpLogRetention implements Schedulable, Database.Batchable<SObject> {
    public void execute(SchedulableContext context) {Database.executeBatch(new ErMcpLogRetention(),200);}
    public Database.QueryLocator start(Database.BatchableContext context) {
        MCP_Settings__c settings=ErMcpCore.settings();
        Integer days=settings.Log_Retention_Days__c==null?30:Math.max(1,settings.Log_Retention_Days__c.intValue());
        Datetime cutoff=System.now().addDays(-days);
        return Database.getQueryLocator([SELECT Id FROM MCP_Tool_Log__c WHERE CreatedDate<:cutoff]);
    }
    public void execute(Database.BatchableContext context,List<SObject> scope) {Database.delete(scope,false);}
    public void finish(Database.BatchableContext context) {}
    public static void scheduleDaily() {
        String name='ER MCP Log Retention';
        List<CronTrigger> existing=[SELECT Id FROM CronTrigger WHERE CronJobDetail.Name=:name AND State IN ('WAITING','ACQUIRED') LIMIT 1];
        if(existing.isEmpty())System.schedule(name,'0 15 2 * * ?',new ErMcpLogRetention());
    }
}