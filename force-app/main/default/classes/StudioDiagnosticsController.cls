/**
 * Read-only system information and lightweight application diagnostics for ER Modeller Studio.
 * @author Vikas Cohen
 */
public with sharing class StudioDiagnosticsController {
    public static final String STUDIO_VERSION='3';
    public static final String TOOLING_API_VERSION='v60.0';

    public class SystemInfoDTO {
        @AuraEnabled public String studioVersion; @AuraEnabled public String toolingApiVersion; @AuraEnabled public String salesforceApiVersion;
        @AuraEnabled public String organisationId; @AuraEnabled public String organisationName; @AuraEnabled public String organisationType; @AuraEnabled public String instanceName; @AuraEnabled public Boolean sandbox; @AuraEnabled public String namespacePrefix; @AuraEnabled public String environmentType;
        @AuraEnabled public String runningUser; @AuraEnabled public String runningUserName; @AuraEnabled public String userType; @AuraEnabled public String profileName; @AuraEnabled public String timeZone; @AuraEnabled public String locale; @AuraEnabled public String language; @AuraEnabled public String generatedAt;
        @AuraEnabled public Integer accessibleObjects; @AuraEnabled public Integer standardObjects; @AuraEnabled public Integer customObjects; @AuraEnabled public Integer accessibleFields; @AuraEnabled public Integer customFields; @AuraEnabled public Integer relationshipFields; @AuraEnabled public Integer formulaFields;
        @AuraEnabled public Boolean snapshotAvailable; @AuraEnabled public String snapshotStatus; @AuraEnabled public Datetime snapshotCompletedAt; @AuraEnabled public Integer dependencyCount; @AuraEnabled public Integer snapshotErrors; @AuraEnabled public Boolean scanRunning; @AuraEnabled public Integer scanProgressPercent; @AuraEnabled public String scanPhase; @AuraEnabled public Integer enabledSchedules;
    }

    public class CheckDTO {
        @AuraEnabled public String key; @AuraEnabled public String label; @AuraEnabled public String status; @AuraEnabled public String detail; @AuraEnabled public String remediation; @AuraEnabled public String diagnosis; @AuraEnabled public List<String> actions=new List<String>();
        public CheckDTO(String k,String l,String s,String d,String r){key=k;label=l;status=s;detail=d;remediation=r;}
        public CheckDTO withDiagnosis(String v){diagnosis=v;return this;}
        public CheckDTO withActions(List<String> v){actions=v==null?new List<String>():v;return this;}
    }
    public class DiagnosticDTO {@AuraEnabled public String overallStatus;@AuraEnabled public String summary;@AuraEnabled public String completedAt;@AuraEnabled public List<CheckDTO> checks=new List<CheckDTO>();}

    // Deliberately NOT cacheable. System Information is a live operational view and
    // must not return a stale scan percentage/status when the LWC refreshes it.
    @AuraEnabled
    public static SystemInfoDTO getSystemInfo(){
        SystemInfoDTO d=new SystemInfoDTO();
        d.studioVersion=STUDIO_VERSION;
        d.toolingApiVersion=TOOLING_API_VERSION;
        d.salesforceApiVersion='60.0';
        d.organisationId=UserInfo.getOrganizationId();
        d.runningUser=UserInfo.getUserName();
        d.generatedAt=String.valueOf(System.now());
        d.namespacePrefix=resolveNamespace();

        try {
            Organization o=[SELECT Name,IsSandbox,OrganizationType,InstanceName FROM Organization LIMIT 1];
            d.organisationName=o.Name; d.organisationType=String.valueOf(o.OrganizationType); d.instanceName=o.InstanceName; d.sandbox=o.IsSandbox;
            d.environmentType=o.IsSandbox?'Sandbox':String.valueOf(o.OrganizationType);
        } catch(Exception ignored) { d.environmentType='Salesforce'; }

        try {
            User u=[SELECT Name,UserType,TimeZoneSidKey,LocaleSidKey,LanguageLocaleKey,Profile.Name FROM User WHERE Id=:UserInfo.getUserId() LIMIT 1];
            d.runningUserName=u.Name; d.userType=u.UserType; d.profileName=u.Profile==null?null:u.Profile.Name; d.timeZone=u.TimeZoneSidKey; d.locale=u.LocaleSidKey; d.language=u.LanguageLocaleKey;
        } catch(Exception ignored) {}

        d.accessibleObjects=0; d.standardObjects=0; d.customObjects=0;
        d.accessibleFields=null; d.customFields=null; d.relationshipFields=null; d.formulaFields=null;
        try {
            for(Schema.SObjectType t:Schema.getGlobalDescribe().values()){
                Schema.DescribeSObjectResult od=t.getDescribe();
                if(!od.isAccessible()) continue;
                d.accessibleObjects++;
                if(od.isCustom()) d.customObjects++; else d.standardObjects++;
            }
        } catch(Exception ignored) {}

        d.snapshotAvailable=false; d.snapshotStatus='Not scanned'; d.dependencyCount=0; d.snapshotErrors=0; d.scanRunning=false; d.scanProgressPercent=0; d.enabledSchedules=0;
        try {
            List<Field_Usage_Run__c> runs=[SELECT Id,Status__c,Completed_At__c,Dependency_Count__c,Error_Count__c,Progress_Percent__c,Progress_Phase__c,Is_Current__c,Objects_Total__c,Objects_Processed__c,Job_Id__c FROM Field_Usage_Run__c ORDER BY CreatedDate DESC LIMIT 1];
            if(!runs.isEmpty()){
                Field_Usage_Run__c r=runs[0];
                d.snapshotStatus=r.Status__c; d.snapshotCompletedAt=r.Completed_At__c; d.dependencyCount=r.Dependency_Count__c==null?0:r.Dependency_Count__c.intValue(); d.snapshotErrors=r.Error_Count__c==null?0:r.Error_Count__c.intValue();
                d.snapshotAvailable=r.Is_Current__c==true&&r.Status__c=='Completed';
                d.scanRunning=new Set<String>{'Queued','Preparing','Processing','Running'}.contains(r.Status__c);
                d.scanProgressPercent=r.Progress_Percent__c==null?0:r.Progress_Percent__c.intValue(); d.scanPhase=r.Progress_Phase__c;

                // While a chained Batch Apex stage is active, use Salesforce's real
                // AsyncApexJob counters rather than a hard-coded checkpoint such as 1%.
                // Once durable work units exist, their processed/total counters remain
                // the authoritative whole-scan progress stored by the worker.
                if(d.scanRunning && !String.isBlank(r.Job_Id__c)){
                    try {
                        Id jobId=(Id)r.Job_Id__c;
                        List<AsyncApexJob> jobs=[SELECT Status,TotalJobItems,JobItemsProcessed,NumberOfErrors,ApexClass.Name FROM AsyncApexJob WHERE Id=:jobId LIMIT 1];
                        if(!jobs.isEmpty()){
                            AsyncApexJob j=jobs[0];
                            Boolean active=new Set<String>{'Holding','Queued','Preparing','Processing'}.contains(j.Status);
                            if(active){
                                Integer total=j.TotalJobItems==null?0:j.TotalJobItems;
                                Integer processed=j.JobItemsProcessed==null?0:j.JobItemsProcessed;
                                if(total>0){
                                    Integer livePct=Math.max(0,Math.min(100,(processed*100)/total));
                                    // Discovery/Tooling are stage progress; worker progress is already
                                    // represented by the durable run's 5-95% whole-scan calculation.
                                    if(r.Objects_Total__c==null || r.Objects_Total__c==0) d.scanProgressPercent=livePct;
                                }
                                String className=j.ApexClass==null?'Batch Apex':j.ApexClass.Name;
                                d.scanPhase=className+' · '+j.Status+(total>0?' · '+processed+' / '+total+' batches processed':'');
                            }
                        }
                    } catch(Exception ignoredJob) {}
                }
            }
        } catch(Exception ignored) {}
        try { d.enabledSchedules=[SELECT count() FROM Field_Usage_Schedule__c WHERE Enabled__c=true]; } catch(Exception ignored) {}
        return d;
    }

    @AuraEnabled
    public static DiagnosticDTO runDiagnostics(){
        DiagnosticDTO d=new DiagnosticDTO();
        d.checks.add(new CheckDTO('runtime','Studio Runtime','Passed','ER Modeller Studio Version '+STUDIO_VERSION+' diagnostics are running successfully.',null));
        Boolean readable=Schema.sObjectType.Field_Usage_Run__c.isAccessible()&&Schema.sObjectType.Field_Usage_Evidence__c.isAccessible()&&Schema.sObjectType.Field_Usage_Schedule__c.isAccessible();
        d.checks.add(readable?new CheckDTO('data','Field Usage Data Model','Passed','Required Field Usage objects are accessible to the running user.',null):new CheckDTO('data','Field Usage Data Model','Failed','One or more required Field Usage objects are not accessible.','Review the Diagram Studio permission set and Field Usage object access.'));
        List<Field_Usage_Run__c> latest=[SELECT Id,Status__c,Completed_At__c,Dependency_Count__c FROM Field_Usage_Run__c ORDER BY CreatedDate DESC LIMIT 1];
        if(latest.isEmpty()) d.checks.add(new CheckDTO('snapshot','Field Usage Snapshot','Information','No Field Usage run exists yet.','Run the first Field Usage scan.'));
        else d.checks.add(new CheckDTO('snapshot','Field Usage Snapshot',latest[0].Status__c=='Failed'?'Attention':'Passed','Latest run status: '+latest[0].Status__c,latest[0].Status__c=='Failed'?'Review the latest Field Usage run errors.':null));
        d.checks.add(new CheckDTO('batch','Batch Engine','Passed','Field Usage Batch Apex engine is installed.',null));
        Integer schedules=[SELECT count() FROM Field_Usage_Schedule__c WHERE Enabled__c=true];
        d.checks.add(new CheckDTO('scheduler','Scheduler','Passed',schedules+' automatic Field Usage schedule(s) enabled.',null));
        try { FieldUsageToolingApiClient.assertConnectionReady(); d.checks.add(new CheckDTO('tooling','Tooling API Connection','Passed','Salesforce Tooling API '+TOOLING_API_VERSION+' authenticated successfully.',null)); }
        catch(Exception ex){ d.checks.add(new CheckDTO('tooling','Tooling API Connection','Failed',safeMessage(ex),'Review Named Credential, External Credential Principal Access and API permissions.').withDiagnosis('Tooling API authentication/configuration issue').withActions(new List<String>{'Confirm Salesforce_Tooling_API exists.','Confirm External Credential Principal Access is assigned.','Confirm the running user has API access.','Re-authenticate the External Credential if required.','Run Diagnostics again.'})); }
        Integer failed=0,attention=0; for(CheckDTO c:d.checks){if(c.status=='Failed')failed++;else if(c.status=='Attention')attention++;}
        d.overallStatus=failed>0?'Configuration Required':attention>0?'Attention Required':'Application Ready';
        d.summary=failed>0?failed+' diagnostic check(s) failed.':attention>0?attention+' item(s) need attention.':'All required diagnostic checks passed.';
        d.completedAt=String.valueOf(System.now()); return d;
    }

    private static String resolveNamespace(){String n=StudioDiagnosticsController.class.getName();Integer dot=n.indexOf('.');return dot>0?n.substring(0,dot):'Unmanaged / no namespace';}
    private static String safeMessage(Exception ex){String m=ex==null?'Unknown diagnostic error.':ex.getMessage();return String.isBlank(m)?'The Tooling API connection could not be verified.':(m.length()>500?m.substring(0,500):m);}
}