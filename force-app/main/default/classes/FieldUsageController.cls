/**
 * @author Vikas Cohen
 */
public with sharing class FieldUsageController {
    public class StatusDTO {
        @AuraEnabled public Field_Usage_Run__c run;
        @AuraEnabled public List<Field_Usage_Schedule__c> schedules;
        @AuraEnabled public Integer jobTotal;
        @AuraEnabled public Integer jobProcessed;
        @AuraEnabled public Integer jobErrors;
        @AuraEnabled public String jobStatus;
        @AuraEnabled public String jobType;
    }
    public class SnapshotDTO { @AuraEnabled public Boolean available; @AuraEnabled public Datetime completedAt; @AuraEnabled public Integer dependencyCount; }
    public class ScheduledJobDTO {
        @AuraEnabled public Id scheduleId;
        @AuraEnabled public String scheduleName;
        @AuraEnabled public Boolean enabled;
        @AuraEnabled public Decimal hour;
        @AuraEnabled public Decimal minute;
        @AuraEnabled public Id cronTriggerId;
        @AuraEnabled public String jobName;
        @AuraEnabled public String state;
        @AuraEnabled public Datetime nextFireTime;
        @AuraEnabled public Datetime previousFireTime;
        @AuraEnabled public String cronExpression;
    }
    @AuraEnabled(cacheable=true) public static SnapshotDTO getSnapshotAvailability(){
        SnapshotDTO dto=new SnapshotDTO(); List<Field_Usage_Run__c> rows=[SELECT Completed_At__c,Dependency_Count__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];
        dto.available=!rows.isEmpty(); if(dto.available){dto.completedAt=rows[0].Completed_At__c;dto.dependencyCount=rows[0].Dependency_Count__c==null?0:rows[0].Dependency_Count__c.intValue();} return dto;
    }
    @AuraEnabled(cacheable=true) public static List<String> getSnapshotObjects(){
        return getObjects();
    }
    @AuraEnabled(cacheable=true) public static List<String> getSnapshotFields(String objectApiName){
        return String.isBlank(objectApiName)?new List<String>():getFields(objectApiName);
    }
    @AuraEnabled(cacheable=true) public static List<String> getObjects(){
        List<String> names=new List<String>();Map<String,Schema.SObjectType> globalDescribe=Schema.getGlobalDescribe();
        for(String n:globalDescribe.keySet()){Schema.DescribeSObjectResult describe=globalDescribe.get(n).getDescribe();if(describe.isAccessible())names.add(describe.getName());}
        names.sort(); return names;
    }
    @AuraEnabled(cacheable=true) public static List<String> getFields(String objectApiName){
        Schema.SObjectType t=Schema.getGlobalDescribe().get(objectApiName); if(t==null) throw new AuraHandledException('Unknown object.');
        List<String> names=new List<String>();for(Schema.SObjectField field:t.getDescribe().fields.getMap().values())names.add(field.getDescribe().getName());names.sort();return names;
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
        String raw=String.isBlank(searchText)?null:searchText.trim();Integer lim=Math.max(1,Math.min(rowLimit==null?250:rowLimit,500));
        String exactKey=raw!=null&&raw.contains('.')?raw:null;String prefix=raw==null?null:raw+'%';
        if(exactKey!=null&&!String.isBlank(sourceType))
            return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Source_Type__c=:sourceType AND Field_Key__c=:exactKey ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim];
        if(exactKey!=null)
            return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Field_Key__c=:exactKey ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim];
        if(prefix!=null&&!String.isBlank(sourceType))
            return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Source_Type__c=:sourceType AND (Field_Key__c LIKE :prefix OR Object_API_Name__c LIKE :prefix OR Field_API_Name__c LIKE :prefix OR Component_Name__c LIKE :prefix OR Location__c LIKE :prefix) ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim];
        if(prefix!=null)
            return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND (Field_Key__c LIKE :prefix OR Object_API_Name__c LIKE :prefix OR Field_API_Name__c LIKE :prefix OR Component_Name__c LIKE :prefix OR Location__c LIKE :prefix) ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim];
        if(!String.isBlank(sourceType))
            return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Source_Type__c=:sourceType ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim];
        return [SELECT Field_Key__c,Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Observed_At__c,Occurrence_Count__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true ORDER BY Object_API_Name__c,Field_API_Name__c,Source_Type__c,Component_Name__c LIMIT :lim];
    }
    @AuraEnabled(cacheable=true) public static List<String> getSourceTypes(){
        return new List<String>{'Apex Class','Apex Trigger','Flow','Formula Field'};
    }
    @AuraEnabled public static Id runNow(){ try{return FieldUsageOrchestrator.start('Manual');}catch(FieldUsageOrchestrator.ScanAlreadyRunningException ex){throw new AuraHandledException(ex.getMessage());}catch(FieldUsageToolingApiClient.ToolingApiException ex){throw new AuraHandledException(ex.getMessage());} }
    @AuraEnabled public static void bootstrap(){ FieldUsageScheduleService.ensureDefaults(); }
    @AuraEnabled public static StatusDTO getStatus(Id runId){
        StatusDTO dto=new StatusDTO();
        String fields='Id,Name,Status__c,Started_At__c,Completed_At__c,Heartbeat_At__c,Dependency_Count__c,Error_Count__c,Is_Current__c,Progress_Percent__c,Progress_Phase__c,Progress_Log__c,Objects_Total__c,Objects_Processed__c,Job_Id__c';

        if(runId!=null){
            List<Field_Usage_Run__c> exact=Database.query('SELECT '+fields+' FROM Field_Usage_Run__c WHERE Id=:runId LIMIT 1');
            dto.run=exact.isEmpty()?null:exact[0];
        }else{
            // Opening/reopening the console attaches to the durable active run.
            // Job_Id__c is written from Database.executeBatch() and by every
            // chained batch, so there is no heuristic AsyncApexJob discovery.
            List<Field_Usage_Run__c> active=Database.query(
                'SELECT '+fields+' FROM Field_Usage_Run__c WHERE Status__c IN (\'Queued\',\'Running\') ORDER BY CreatedDate DESC LIMIT 1'
            );
            if(!active.isEmpty()) dto.run=active[0];
            else{
                List<Field_Usage_Run__c> latest=Database.query(
                    'SELECT '+fields+' FROM Field_Usage_Run__c ORDER BY CreatedDate DESC LIMIT 1'
                );
                dto.run=latest.isEmpty()?null:latest[0];
            }
        }

        populateJobStatus(dto);

        // Last-resort runtime truth: if the durable run record is missing,
        // stale, or not yet linked, discover *our* currently active Batch Apex
        // job directly from AsyncApexJob. This is deliberately restricted to
        // the Field Usage batch classes, so the console can never attach to an
        // unrelated org batch.
        if(dto.run==null || String.isBlank(dto.jobStatus) ||
           !new Set<String>{'Holding','Queued','Preparing','Processing'}.contains(dto.jobStatus)){
            Set<String> fieldUsageBatchClasses=new Set<String>{
                'FieldUsageDiscoveryBatch',
                'FieldUsageToolingDiscoveryBatch',
                'FieldUsageWorkUnitBatch'
            };
            List<AsyncApexJob> liveJobs=[
                SELECT Id,Status,JobType,TotalJobItems,JobItemsProcessed,NumberOfErrors,ExtendedStatus,ApexClass.Name,CreatedDate
                FROM AsyncApexJob
                WHERE ApexClass.Name IN :fieldUsageBatchClasses
                  AND Status IN ('Holding','Queued','Preparing','Processing')
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];
            if(!liveJobs.isEmpty()){
                AsyncApexJob live=liveJobs[0];
                List<Field_Usage_Run__c> linked=Database.query(
                    'SELECT '+fields+' FROM Field_Usage_Run__c WHERE Job_Id__c=:live.Id ORDER BY CreatedDate DESC LIMIT 1'
                );
                if(!linked.isEmpty()) dto.run=linked[0];
                if(dto.run==null){
                    dto.run=new Field_Usage_Run__c(
                        Status__c='Running',
                        Job_Id__c=String.valueOf(live.Id),
                        Progress_Phase__c='Batch Apex job is '+live.Status
                    );
                }else{
                    dto.run.Status__c=live.Status=='Queued' || live.Status=='Holding'?'Queued':'Running';
                    if(String.isBlank(dto.run.Progress_Phase__c)) dto.run.Progress_Phase__c='Batch Apex job is '+live.Status;
                }
                copyJobStatus(dto,live);
            }
        }

        dto.schedules=[SELECT Id,Name,Enabled__c,Hour__c,Minute__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c ORDER BY Hour__c,Minute__c];
        return dto;
    }

    private static void populateJobStatus(StatusDTO dto){
        if(dto==null || dto.run==null || String.isBlank(dto.run.Job_Id__c)) return;
        try{
            Id asyncId=(Id)dto.run.Job_Id__c;
            List<AsyncApexJob> jobs=[
                SELECT Id,Status,JobType,TotalJobItems,JobItemsProcessed,NumberOfErrors,ExtendedStatus
                FROM AsyncApexJob WHERE Id=:asyncId LIMIT 1
            ];
            if(!jobs.isEmpty()){
                copyJobStatus(dto,jobs[0]);
                // AsyncApexJob is authoritative for whether the current stage
                // is active. This mutation is display-only; lifecycle DML
                // remains owned by the batches/finalizer.
                if(new Set<String>{'Holding','Queued','Preparing','Processing'}.contains(jobs[0].Status)){
                    dto.run.Status__c=jobs[0].Status=='Queued' || jobs[0].Status=='Holding' ? 'Queued' : 'Running';
                    if(String.isBlank(dto.run.Progress_Phase__c)) dto.run.Progress_Phase__c='Batch Apex job is '+jobs[0].Status;
                }
            }
        }catch(Exception ignored){}
    }

    private static void copyJobStatus(StatusDTO dto,AsyncApexJob job){
        dto.jobStatus=job.Status;
        dto.jobType=String.valueOf(job.JobType);
        dto.jobTotal=job.TotalJobItems;
        dto.jobProcessed=job.JobItemsProcessed;
        dto.jobErrors=job.NumberOfErrors;
    }
    @AuraEnabled public static void saveSchedules(List<Field_Usage_Schedule__c> rows){ FieldUsageScheduleService.save(rows); }

    @AuraEnabled(cacheable=true) public static List<ScheduledJobDTO> getScheduledJobs(){
        String pattern=FieldUsageScheduleService.PREFIX+'%';
        Map<String,CronTrigger> jobsByName=new Map<String,CronTrigger>();
        for(CronTrigger job:[SELECT Id,State,NextFireTime,PreviousFireTime,CronExpression,CronJobDetail.Name FROM CronTrigger WHERE CronJobDetail.Name LIKE :pattern]){
            jobsByName.put(job.CronJobDetail.Name,job);
        }
        List<ScheduledJobDTO> out=new List<ScheduledJobDTO>();
        for(Field_Usage_Schedule__c row:[SELECT Id,Name,Enabled__c,Hour__c,Minute__c,Cron_Job_Name__c FROM Field_Usage_Schedule__c ORDER BY Hour__c,Minute__c]){
            ScheduledJobDTO dto=new ScheduledJobDTO();
            dto.scheduleId=row.Id; dto.scheduleName=row.Name; dto.enabled=row.Enabled__c; dto.hour=row.Hour__c; dto.minute=row.Minute__c; dto.jobName=row.Cron_Job_Name__c;
            CronTrigger job=String.isBlank(row.Cron_Job_Name__c)?null:jobsByName.get(row.Cron_Job_Name__c);
            if(job!=null){dto.cronTriggerId=job.Id;dto.state=job.State;dto.nextFireTime=job.NextFireTime;dto.previousFireTime=job.PreviousFireTime;dto.cronExpression=job.CronExpression;}
            else dto.state=row.Enabled__c?'Not Scheduled':'Paused';
            out.add(dto);
        }
        return out;
    }

    @AuraEnabled public static void pauseSchedule(Id scheduleId){ FieldUsageScheduleService.setEnabled(scheduleId,false); }
    @AuraEnabled public static void resumeSchedule(Id scheduleId){ FieldUsageScheduleService.setEnabled(scheduleId,true); }
    @AuraEnabled public static void deleteSchedule(Id scheduleId){ if(scheduleId==null) return; delete [SELECT Id FROM Field_Usage_Schedule__c WHERE Id=:scheduleId LIMIT 1]; FieldUsageScheduleService.apply(); }
}