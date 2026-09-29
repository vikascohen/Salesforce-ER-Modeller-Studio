/**
 * Read-only system information and lightweight application diagnostics for ER Modeller Studio.
 * Diagnostics never start a Field Usage scan. The only external request is the existing
 * Tooling API connection preflight, executed only when the user explicitly runs diagnostics.
 * @author Vikas Cohen
 */
public with sharing class StudioDiagnosticsController {
    public static final String STUDIO_VERSION = '3';
    public static final String TOOLING_API_VERSION = 'v60.0';

    public class SystemInfoDTO {
        @AuraEnabled public String studioVersion;
        @AuraEnabled public String toolingApiVersion;
        @AuraEnabled public String salesforceApiVersion;
        @AuraEnabled public String organisationId;
        @AuraEnabled public String namespacePrefix;
        @AuraEnabled public String environmentType;
        @AuraEnabled public String runningUser;
        @AuraEnabled public String generatedAt;
    }
    public class CheckDTO {
        @AuraEnabled public String key;
        @AuraEnabled public String label;
        @AuraEnabled public String status;
        @AuraEnabled public String detail;
        @AuraEnabled public String remediation;
        public CheckDTO(String k,String l,String s,String d,String r){key=k;label=l;status=s;detail=d;remediation=r;}
    }
    public class DiagnosticDTO {
        @AuraEnabled public String overallStatus;
        @AuraEnabled public String summary;
        @AuraEnabled public String completedAt;
        @AuraEnabled public List<CheckDTO> checks=new List<CheckDTO>();
    }

    @AuraEnabled(cacheable=true)
    public static SystemInfoDTO getSystemInfo(){
        SystemInfoDTO dto=new SystemInfoDTO();
        dto.studioVersion=STUDIO_VERSION;
        dto.toolingApiVersion=TOOLING_API_VERSION;
        dto.salesforceApiVersion='60.0';
        dto.organisationId=UserInfo.getOrganizationId();
        dto.runningUser=UserInfo.getUserName();
        dto.generatedAt=String.valueOf(System.now());
        dto.namespacePrefix=resolveNamespace();
        Organization org=[SELECT IsSandbox,OrganizationType FROM Organization LIMIT 1];
        dto.environmentType=org.IsSandbox?'Sandbox':String.valueOf(org.OrganizationType);
        return dto;
    }

    @AuraEnabled
    public static DiagnosticDTO runDiagnostics(){
        DiagnosticDTO dto=new DiagnosticDTO();
        dto.checks.add(new CheckDTO('runtime','Studio Runtime','Passed','ER Modeller Studio Version '+STUDIO_VERSION+' diagnostics are running successfully.',null));

        Boolean fieldUsageReadable=Schema.sObjectType.Field_Usage_Run__c.isAccessible()
            && Schema.sObjectType.Field_Usage_Evidence__c.isAccessible()
            && Schema.sObjectType.Field_Usage_Schedule__c.isAccessible();
        dto.checks.add(fieldUsageReadable
            ? new CheckDTO('data','Field Usage Data Model','Passed','Required Field Usage objects are accessible to the running user.',null)
            : new CheckDTO('data','Field Usage Data Model','Failed','One or more required Field Usage objects are not accessible.','Review the Diagram Studio permission set and Field Usage object access.'));

        List<Field_Usage_Run__c> latest=[SELECT Id,Status__c,Completed_At__c,Dependency_Count__c,Error_Count__c FROM Field_Usage_Run__c ORDER BY CreatedDate DESC LIMIT 1];
        if(latest.isEmpty()){
            dto.checks.add(new CheckDTO('snapshot','Field Usage Snapshot','Information','No Field Usage run exists yet.','Run the first Field Usage scan when you are ready to build dependency evidence.'));
        }else{
            Field_Usage_Run__c r=latest[0];
            String d='Latest run status: '+r.Status__c;
            if(r.Completed_At__c!=null)d+=' · completed '+String.valueOf(r.Completed_At__c);
            if(r.Dependency_Count__c!=null)d+=' · '+String.valueOf(r.Dependency_Count__c.intValue())+' dependencies';
            dto.checks.add(new CheckDTO('snapshot','Field Usage Snapshot',r.Status__c=='Failed'?'Attention':'Passed',d,r.Status__c=='Failed'?'Open the Field Usage activity console and review the latest run errors.':null));
        }

        Set<String> batchNames=new Set<String>{'FieldUsageDiscoveryBatch','FieldUsageToolingDiscoveryBatch','FieldUsageWorkUnitBatch'};
        List<AsyncApexJob> active=[SELECT Id,Status,ApexClass.Name,JobItemsProcessed,TotalJobItems,NumberOfErrors FROM AsyncApexJob WHERE ApexClass.Name IN :batchNames AND Status IN ('Holding','Queued','Preparing','Processing') ORDER BY CreatedDate DESC LIMIT 1];
        if(active.isEmpty()) dto.checks.add(new CheckDTO('batch','Batch Engine','Passed','No Field Usage batch is currently active. The batch engine is available.',null));
        else{
            AsyncApexJob j=active[0];
            dto.checks.add(new CheckDTO('batch','Batch Engine','Passed',j.ApexClass.Name+' is '+j.Status+' · '+j.JobItemsProcessed+' of '+j.TotalJobItems+' batches processed · '+j.NumberOfErrors+' errors.',null));
        }

        Integer enabledSchedules=[SELECT count() FROM Field_Usage_Schedule__c WHERE Enabled__c=true];
        dto.checks.add(new CheckDTO('scheduler','Scheduler','Passed',enabledSchedules==0?'No automatic Field Usage schedules are enabled.':enabledSchedules+' automatic Field Usage schedule(s) enabled.',null));

        try{
            FieldUsageToolingApiClient.assertConnectionReady();
            dto.checks.add(new CheckDTO('tooling','Tooling API Connection','Passed','Salesforce Tooling API '+TOOLING_API_VERSION+' authenticated successfully through Salesforce_Tooling_API.',''));
        }catch(Exception ex){
            dto.checks.add(new CheckDTO('tooling','Tooling API Connection','Failed',safeMessage(ex),'Open Help → Configuration and verify the Named Credential, External Credential authentication and External Credential Principal Access.'));
        }

        Integer failed=0,attention=0;
        for(CheckDTO c:dto.checks){if(c.status=='Failed')failed++;else if(c.status=='Attention')attention++;}
        dto.overallStatus=failed>0?'Configuration Required':(attention>0?'Attention Required':'Application Ready');
        dto.summary=failed>0?failed+' diagnostic check(s) failed. Resolve the failed checks before relying on all Studio features.':(attention>0?attention+' item(s) need attention. Core diagnostics completed.':'All required diagnostic checks passed. ER Modeller Studio is ready to work.');
        dto.completedAt=String.valueOf(System.now());
        return dto;
    }

    private static String resolveNamespace(){
        String n=StudioDiagnosticsController.class.getName();
        Integer dot=n.indexOf('.');
        return dot>0?n.substring(0,dot):'Unmanaged / no namespace';
    }
    private static String safeMessage(Exception ex){
        String m=ex==null?'Unknown diagnostic error.':ex.getMessage();
        if(String.isBlank(m))return 'The Tooling API connection could not be verified.';
        return m.length()>500?m.substring(0,500):m;
    }
}