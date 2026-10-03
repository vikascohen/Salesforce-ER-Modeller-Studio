/**
 * @author Vikas Cohen
 */
public with sharing class FieldUsageScheduleService {
    public static final String PREFIX='ER Modeller Field Usage ';

    // Kept for backwards compatibility with older callers. Settings are now
    // administrator-owned: opening Studio must never invent default schedules.
    public static void ensureDefaults() {
        apply();
    }

    public static void apply() {
        String pattern=PREFIX+'%';
        List<CronTrigger> scheduledJobs=[SELECT Id,CronJobDetail.Name FROM CronTrigger WHERE CronJobDetail.Name LIKE :pattern];
        for(CronTrigger ct:scheduledJobs) System.abortJob(ct.Id);

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
        if(rows==null) rows=new List<Field_Usage_Schedule__c>();
        Set<String> times=new Set<String>();
        for(Field_Usage_Schedule__c row:rows) {
            validate(row);
            String key=String.valueOf(row.Hour__c)+':'+String.valueOf(row.Minute__c);
            if(row.Enabled__c && !times.add(key)) throw new AuraHandledException('Duplicate scan times are not allowed.');
        }
        if(!rows.isEmpty()) upsert rows;
        apply();
    }

    public static void setEnabled(Id scheduleId, Boolean enabled) {
        if(scheduleId==null) throw new AuraHandledException('Schedule Id is required.');
        Field_Usage_Schedule__c row=[SELECT Id,Enabled__c FROM Field_Usage_Schedule__c WHERE Id=:scheduleId LIMIT 1];
        row.Enabled__c=enabled;
        update row;
        apply();
    }

    // Compatibility helpers used by FieldUsageController. Keep scheduling
    // mechanics in this service rather than duplicating CronTrigger logic.
    public static void abortJob(String jobName) {
        if(String.isBlank(jobName)) return;
        List<CronTrigger> jobs=[SELECT Id FROM CronTrigger WHERE CronJobDetail.Name=:jobName];
        for(CronTrigger job:jobs) System.abortJob(job.Id);
    }

    public static void rescheduleEnabled() {
        apply();
    }

    private static void validate(Field_Usage_Schedule__c row) {
        if(row.Hour__c==null || row.Hour__c<0 || row.Hour__c>23 || row.Minute__c==null || row.Minute__c<0 || row.Minute__c>59)
            throw new AuraHandledException('Scan time must use an hour from 0 to 23 and minute from 0 to 59.');
    }
}