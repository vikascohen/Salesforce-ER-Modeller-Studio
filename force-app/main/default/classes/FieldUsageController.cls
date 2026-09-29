public with sharing class FieldUsageController {
    public class StatusDTO { @AuraEnabled public Field_Usage_Run__c run; @AuraEnabled public List<Field_Usage_Schedule__c> schedules; }
    public class SnapshotDTO { @AuraEnabled public Boolean available; @AuraEnabled public Datetime completedAt; @AuraEnabled public Integer dependencyCount; }
    @AuraEnabled(cacheable=true) public static SnapshotDTO getSnapshotAvailability(){
        SnapshotDTO dto=new SnapshotDTO(); List<Field_Usage_Run__c> rows=[SELECT Completed_At__c,Dependency_Count__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];
        dto.available=!rows.isEmpty(); if(dto.available){dto.completedAt=rows[0].Completed_At__c;dto.dependencyCount=Integer.valueOf(rows[0].Dependency_Count__c==null?0:rows[0].Dependency_Count__c);} return dto;
    }
    @AuraEnabled(cacheable=true) public static List<String> getSnapshotObjects(){
        List<String> names=new List<String>(); for(AggregateResult ar:[SELECT Object_API_Name__c n FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true GROUP BY Object_API_Name__c ORDER BY Object_API_Name__c LIMIT 2000]) names.add((String)ar.get('n')); return names;
    }
    @AuraEnabled(cacheable=true) public static List<String> getSnapshotFields(String objectApiName){
        if(String.isBlank(objectApiName)) return new List<String>(); List<String> names=new List<String>(); for(AggregateResult ar:[SELECT Field_API_Name__c n FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Object_API_Name__c=:objectApiName GROUP BY Field_API_Name__c ORDER BY Field_API_Name__c LIMIT 2000]) names.add((String)ar.get('n')); return names;
    }
    @AuraEnabled(cacheable=true) public static List<String> getObjects(){
        List<String> names=new List<String>();
        for(String n:Schema.getGlobalDescribe().keySet()) if(Schema.getGlobalDescribe().get(n).getDescribe().isAccessible()) names.add(n);
        names.sort(); return names;
    }
    @AuraEnabled(cacheable=true) public static List<String> getFields(String objectApiName){
        Schema.SObjectType t=Schema.getGlobalDescribe().get(objectApiName); if(t==null) throw new AuraHandledException('Unknown object.');
        List<String> names=new List<String>(t.getDescribe().fields.getMap().keySet()); names.sort(); return names;
    }
    @AuraEnabled(cacheable=true) public static List<Field_Usage_Evidence__c> getEvidence(String objectApiName,List<String> fieldApiNames){
        if(String.isBlank(objectApiName)||fieldApiNames==null||fieldApiNames.isEmpty()) return new List<Field_Usage_Evidence__c>();
        Set<String> keys=new Set<String>(); for(String f:fieldApiNames) keys.add(objectApiName+'.'+f);
        return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Evidence__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c
                FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Field_Key__c IN :keys ORDER BY Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT 5000];
    }
    @AuraEnabled public static Id runNow(){ try{return FieldUsageOrchestrator.start('Manual');}catch(FieldUsageOrchestrator.ScanAlreadyRunningException ex){throw new AuraHandledException(ex.getMessage());} }
    @AuraEnabled public static void bootstrap(){ FieldUsageScheduleService.ensureDefaults(); }
    @AuraEnabled(cacheable=true) public static StatusDTO getStatus(){
        StatusDTO dto=new StatusDTO(); List<Field_Usage_Run__c> runs=[SELECT Id,Name,Status__c,Started_At__c,Completed_At__c,Heartbeat_At__c,Dependency_Count__c,Error_Count__c,Is_Current__c,Progress_Percent__c,Progress_Phase__c,Progress_Log__c,Objects_Total__c,Objects_Processed__c FROM Field_Usage_Run__c ORDER BY CreatedDate DESC LIMIT 1];
        dto.run=runs.isEmpty()?null:runs[0]; dto.schedules=[SELECT Id,Name,Enabled__c,Hour__c,Minute__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c ORDER BY Hour__c,Minute__c]; return dto;
    }
    @AuraEnabled public static void saveSchedules(List<Field_Usage_Schedule__c> rows){ FieldUsageScheduleService.save(rows); }
    @AuraEnabled public static void deleteSchedule(Id scheduleId){ if(scheduleId==null) return; delete [SELECT Id FROM Field_Usage_Schedule__c WHERE Id=:scheduleId LIMIT 1]; FieldUsageScheduleService.apply(); }
}