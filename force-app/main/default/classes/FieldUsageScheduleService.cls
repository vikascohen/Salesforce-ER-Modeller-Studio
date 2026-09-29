/**
 * @author Vikas Cohen
 */
public with sharing class FieldUsageScheduleService {
    private static final String PREFIX='ER Modeller Field Usage ';
    public static void ensureDefaults() {
        if([SELECT COUNT() FROM Field_Usage_Schedule__c]=0) {
            insert new List<Field_Usage_Schedule__c>{
                new Field_Usage_Schedule__c(Name='Early Morning',Enabled__c=true,Hour__c=3,Minute__c=0),
                new Field_Usage_Schedule__c(Name='Night',Enabled__c=true,Hour__c=21,Minute__c=0)
            };
        }
        String pattern=PREFIX+'%';
        if([SELECT COUNT() FROM CronTrigger WHERE CronJobDetail.Name LIKE :pattern]=0) apply();
    }
    public static void apply() {
        String pattern=PREFIX+'%';
        for(CronTrigger ct:[SELECT Id,CronJobDetail.Name FROM CronTrigger WHERE CronJobDetail.Name LIKE :pattern]) System.abortJob(ct.Id);
        List<Field_Usage_Schedule__c> rows=[SELECT Id,Name,Enabled__c,Hour__c,Minute__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c ORDER BY Hour__c,Minute__c];
        for(Field_Usage_Schedule__c row:rows) {
            validate(row);
            if(!row.Enabled__c) { row.Cron_Job_Name__c=null; continue; }
            String jobName=PREFIX+row.Id;
            String cron='0 '+Integer.valueOf(row.Minute__c)+' '+Integer.valueOf(row.Hour__c)+' * * ?';
            System.schedule(jobName,cron,new FieldUsageScheduler());
            row.Cron_Job_Name__c=jobName;
        }
        if(!rows.isEmpty()) update rows;
    }
    public static void save(List<Field_Usage_Schedule__c> rows) {
        Set<String> times=new Set<String>();
        for(Field_Usage_Schedule__c row:rows) {
            validate(row); String key=String.valueOf(row.Hour__c)+':'+String.valueOf(row.Minute__c);
            if(row.Enabled__c && !times.add(key)) throw new AuraHandledException('Duplicate scan times are not allowed.');
        }
        upsert rows; apply();
    }
    private static void validate(Field_Usage_Schedule__c row) {
        if(row.Hour__c==null || row.Hour__c<0 || row.Hour__c>23 || row.Minute__c==null || row.Minute__c<0 || row.Minute__c>59)
            throw new AuraHandledException('Scan time must use an hour from 0 to 23 and minute from 0 to 59.');
    }
}