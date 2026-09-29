/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageScheduleServiceTest {
    @IsTest static void bootstrapDoesNotCreateDefaults(){
        FieldUsageScheduleService.ensureDefaults();
        System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Schedule__c]);
    }

    @IsTest static void savesPausesAndResumesAdminSchedule(){
        Field_Usage_Schedule__c row=new Field_Usage_Schedule__c(Name='Morning scan',Enabled__c=true,Hour__c=6,Minute__c=30);
        FieldUsageScheduleService.save(new List<Field_Usage_Schedule__c>{row});
        row=[SELECT Id,Enabled__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c LIMIT 1];
        System.assertEquals(true,row.Enabled__c);
        System.assertNotEquals(null,row.Cron_Job_Name__c);

        FieldUsageScheduleService.setEnabled(row.Id,false);
        row=[SELECT Enabled__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c WHERE Id=:row.Id];
        System.assertEquals(false,row.Enabled__c);
        System.assertEquals(null,row.Cron_Job_Name__c);

        FieldUsageScheduleService.setEnabled(row.Id,true);
        row=[SELECT Enabled__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c WHERE Id=:row.Id];
        System.assertEquals(true,row.Enabled__c);
        System.assertNotEquals(null,row.Cron_Job_Name__c);
    }

    @IsTest static void rejectsInvalidTime(){
        Field_Usage_Schedule__c s=new Field_Usage_Schedule__c(Name='Bad',Enabled__c=true,Hour__c=24,Minute__c=0);
        try{FieldUsageScheduleService.save(new List<Field_Usage_Schedule__c>{s});System.assert(false);}
        catch(AuraHandledException e){System.assert(true);}
    }

    @IsTest static void rejectsDuplicateEnabledTimes(){
        try{
            FieldUsageScheduleService.save(new List<Field_Usage_Schedule__c>{
                new Field_Usage_Schedule__c(Name='One',Enabled__c=true,Hour__c=9,Minute__c=15),
                new Field_Usage_Schedule__c(Name='Two',Enabled__c=true,Hour__c=9,Minute__c=15)
            });
            System.assert(false);
        }catch(AuraHandledException e){System.assert(true);}
    }
}