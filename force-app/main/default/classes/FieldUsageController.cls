/**
 * @author Vikas Cohen
 */
public with sharing class FieldUsageController {
    public class StatusDTO { @AuraEnabled public Field_Usage_Run__c run; @AuraEnabled public List<Field_Usage_Schedule__c> schedules; }
    public class SnapshotDTO { @AuraEnabled public Boolean available; @AuraEnabled public Datetime completedAt; @AuraEnabled public Integer dependencyCount; }
    @AuraEnabled(cacheable=true) public static SnapshotDTO getSnapshotAvailability(){
        SnapshotDTO dto=new SnapshotDTO(); List<Field_Usage_Run__c> rows=[SELECT Completed_At__c,Dependency_Count__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];
        dto.available=!rows.isEmpty(); if(dto.available){dto.completedAt=rows[0].Completed_At__c;dto.dependencyCount=rows[0].Dependency_Count__c==null?0:rows[0].Dependency_Count__c.intValue();} return dto;
    }
    @AuraEnabled(cacheable=true) public static List<String> getSnapshotObjects(){
        Id runId=getCurrentRunId();if(runId==null)return new List<String>();Set<String> uniqueNames=new Set<String>();
        for(Field_Usage_Evidence__c row:[SELECT Object_API_Name__c FROM Field_Usage_Evidence__c WHERE Run__c=:runId AND Object_API_Name__c!=null LIMIT 50000])uniqueNames.add(row.Object_API_Name__c);
        List<String> names=new List<String>(uniqueNames);names.sort();return names;
    }
    @AuraEnabled(cacheable=true) public static List<String> getSnapshotFields(String objectApiName){
        if(String.isBlank(objectApiName))return new List<String>();Id runId=getCurrentRunId();if(runId==null)return new List<String>();Set<String> uniqueNames=new Set<String>();
        for(Field_Usage_Evidence__c row:[SELECT Field_API_Name__c FROM Field_Usage_Evidence__c WHERE Run__c=:runId AND Object_API_Name__c=:objectApiName AND Field_API_Name__c!=null LIMIT 50000])uniqueNames.add(row.Field_API_Name__c);
        List<String> names=new List<String>(uniqueNames);names.sort();return names;
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
    public class EvidenceSummaryDTO { @AuraEnabled public String fieldApiName; @AuraEnabled public String sourceType; @AuraEnabled public Integer evidenceRows; @AuraEnabled public Decimal occurrences; }
    @AuraEnabled(cacheable=true) public static List<EvidenceSummaryDTO> getEvidenceSummary(String objectApiName,List<String> fieldApiNames){
        List<EvidenceSummaryDTO> out=new List<EvidenceSummaryDTO>(); if(String.isBlank(objectApiName)||fieldApiNames==null||fieldApiNames.isEmpty())return out;
        Set<String> keys=new Set<String>();for(String f:fieldApiNames)if(!String.isBlank(f))keys.add(objectApiName+'.'+f);if(keys.isEmpty())return out;
        if(keys.size()>100)throw new AuraHandledException('Select no more than 100 fields at a time for Field Usage analysis.');
        Id currentRunId=getCurrentRunId();if(currentRunId==null)return out;
        Map<String,EvidenceSummaryDTO> summaries=new Map<String,EvidenceSummaryDTO>();
        Id afterId=null;
        while(true){
            List<Field_Usage_Evidence__c> page=afterId==null
                ? [SELECT Id,Field_API_Name__c,Source_Type__c,Occurrence_Count__c FROM Field_Usage_Evidence__c WHERE Run__c=:currentRunId AND Field_Key__c IN :keys ORDER BY Id LIMIT 2000]
                : [SELECT Id,Field_API_Name__c,Source_Type__c,Occurrence_Count__c FROM Field_Usage_Evidence__c WHERE Run__c=:currentRunId AND Field_Key__c IN :keys AND Id>:afterId ORDER BY Id LIMIT 2000];
            if(page.isEmpty())break;
            for(Field_Usage_Evidence__c row:page){
                String summaryKey=row.Field_API_Name__c+'|'+row.Source_Type__c;
                EvidenceSummaryDTO dto=summaries.get(summaryKey);
                if(dto==null){dto=new EvidenceSummaryDTO();dto.fieldApiName=row.Field_API_Name__c;dto.sourceType=row.Source_Type__c;dto.evidenceRows=0;dto.occurrences=0;summaries.put(summaryKey,dto);}
                dto.evidenceRows++;
                dto.occurrences+=(row.Occurrence_Count__c==null?0:row.Occurrence_Count__c);
            }
            afterId=page[page.size()-1].Id;
            if(Limits.getHeapSize()>(Limits.getLimitHeapSize()*75/100))throw new AuraHandledException('The selected fields contain too much dependency evidence to summarise safely in one request. Select fewer fields.');
            if(page.size()<2000)break;
        }
        out.addAll(summaries.values());
        out.sort(new EvidenceSummaryComparator());
        return out;
    }
    private static Id getCurrentRunId(){List<Field_Usage_Run__c> runs=[SELECT Id FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];return runs.isEmpty()?null:runs[0].Id;}
    public class EvidenceSummaryComparator implements Comparator<EvidenceSummaryDTO>{public Integer compare(EvidenceSummaryDTO a,EvidenceSummaryDTO b){String ak=(a.fieldApiName==null?'':a.fieldApiName)+'|'+(a.sourceType==null?'':a.sourceType);String bk=(b.fieldApiName==null?'':b.fieldApiName)+'|'+(b.sourceType==null?'':b.sourceType);return ak.compareTo(bk);}}
    @AuraEnabled(cacheable=true) public static List<Field_Usage_Evidence__c> getEvidence(String objectApiName,List<String> fieldApiNames){
        if(String.isBlank(objectApiName)||fieldApiNames==null||fieldApiNames.isEmpty()) return new List<Field_Usage_Evidence__c>();
        Set<String> keys=new Set<String>(); for(String f:fieldApiNames) keys.add(objectApiName+'.'+f);
        return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c
                FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Field_Key__c IN :keys ORDER BY Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT 5000];
    }
    public class EvidenceDetailPageDTO { @AuraEnabled public List<Field_Usage_Evidence__c> rows; @AuraEnabled public Boolean hasMore; @AuraEnabled public Id nextCursor; }
    @AuraEnabled(cacheable=true) public static EvidenceDetailPageDTO getEvidenceDetail(String objectApiName,String fieldApiName,String sourceType,Integer rowLimit,Id afterId){
        EvidenceDetailPageDTO dto=new EvidenceDetailPageDTO();dto.rows=new List<Field_Usage_Evidence__c>();dto.hasMore=false;dto.nextCursor=null;
        if(String.isBlank(objectApiName)||String.isBlank(fieldApiName)||String.isBlank(sourceType))return dto;
        Integer lim=Math.max(1,Math.min(rowLimit==null?250:rowLimit,500));String key=objectApiName+'.'+fieldApiName;
        List<Field_Usage_Evidence__c> page;
        if(afterId==null)page=[SELECT Id,Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Field_Key__c=:key AND Source_Type__c=:sourceType ORDER BY Id LIMIT :lim+1];
        else page=[SELECT Id,Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Field_Key__c=:key AND Source_Type__c=:sourceType AND Id>:afterId ORDER BY Id LIMIT :lim+1];
        dto.hasMore=page.size()>lim;if(dto.hasMore)page.remove(page.size()-1);dto.rows=page;if(!page.isEmpty())dto.nextCursor=page[page.size()-1].Id;return dto;
    }
    @AuraEnabled(cacheable=true) public static List<Field_Usage_Evidence__c> searchEvidence(String searchText,String sourceType,Integer rowLimit){
        String raw=String.isBlank(searchText)?null:searchText.trim(); Integer lim=Math.max(1,Math.min(rowLimit==null?250:rowLimit,500));
        String exactKey=raw!=null&&raw.contains('.')?raw:null; String prefix=raw==null?null:raw+'%';
        String fields='SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true';
        if(!String.isBlank(sourceType)) fields+=' AND Source_Type__c = :sourceType';
        if(exactKey!=null) fields+=' AND Field_Key__c = :exactKey';
        else if(prefix!=null) fields+=' AND (Field_Key__c LIKE :prefix OR Object_API_Name__c LIKE :prefix OR Field_API_Name__c LIKE :prefix OR Component_Name__c LIKE :prefix OR Location__c LIKE :prefix)';
        fields+=' ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim';
        return Database.queryWithBinds(fields,new Map<String,Object>{'sourceType'=>sourceType,'exactKey'=>exactKey,'prefix'=>prefix,'lim'=>lim},AccessLevel.USER_MODE);
    }
    @AuraEnabled(cacheable=true) public static List<String> getSourceTypes(){
        Id runId=getCurrentRunId();if(runId==null)return new List<String>();Set<String> uniqueTypes=new Set<String>();
        for(Field_Usage_Evidence__c row:[SELECT Source_Type__c FROM Field_Usage_Evidence__c WHERE Run__c=:runId AND Source_Type__c!=null LIMIT 50000])uniqueTypes.add(row.Source_Type__c);
        List<String> out=new List<String>(uniqueTypes);out.sort();return out;
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