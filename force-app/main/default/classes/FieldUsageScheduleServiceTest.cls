/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageScheduleServiceTest {
 @IsTest static void createsDefaultsAndJobs(){FieldUsageScheduleService.ensureDefaults();System.assertEquals(2,[SELECT COUNT() FROM Field_Usage_Schedule__c]);System.assert([SELECT COUNT() FROM CronTrigger]>0);}
 @IsTest static void rejectsInvalidTime(){Field_Usage_Schedule__c s=new Field_Usage_Schedule__c(Name='Bad',Enabled__c=true,Hour__c=24,Minute__c=0);try{FieldUsageScheduleService.save(new List<Field_Usage_Schedule__c>{s});System.assert(false);}catch(AuraHandledException e){System.assert(true);}}
}