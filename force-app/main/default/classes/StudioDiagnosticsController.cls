/**
 * Read-only system information and lightweight application diagnostics for ER Modeller Studio.
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
        @AuraEnabled public String organisationName;
        @AuraEnabled public String organisationType;
        @AuraEnabled public String instanceName;
        @AuraEnabled public Boolean sandbox;
        @AuraEnabled public String namespacePrefix;
        @AuraEnabled public String environmentType;
        @AuraEnabled public String runningUser;
        @AuraEnabled public String runningUserName;
        @AuraEnabled public String userType;
        @AuraEnabled public String profileName;
        @AuraEnabled public String timeZone;
        @AuraEnabled public String locale;
        @AuraEnabled public String language;
        @AuraEnabled public String generatedAt;
    }
    public class CheckDTO {
        @AuraEnabled public String key; @AuraEnabled public String label; @AuraEnabled public String status;
        @AuraEnabled public String detail; @AuraEnabled public String remediation; @AuraEnabled public String diagnosis;
        @AuraEnabled public List<String> actions = new List<String>();
        public CheckDTO(String k,String l,String s,String d,String r){key=k;label=l;status=s;detail=d;remediation=r;}
        public CheckDTO withDiagnosis(String value){diagnosis=value;return this;}
        public CheckDTO withActions(List<String> value){actions=value==null?new List<String>():value;return this;}
    }
    public class DiagnosticDTO {
        @AuraEnabled public String overallStatus; @AuraEnabled public String summary; @AuraEnabled public String completedAt;
        @AuraEnabled public List<CheckDTO> checks=new List<CheckDTO>();
    }

    @AuraEnabled(cacheable=true)
    public static SystemInfoDTO getSystemInfo(){
        SystemInfoDTO dto=new SystemInfoDTO();
        dto.studioVersion=STUDIO_VERSION; dto.toolingApiVersion=TOOLING_API_VERSION; dto.salesforceApiVersion='60.0';
        dto.organisationId=UserInfo.getOrganizationId(); dto.runningUser=UserInfo.getUserName(); dto.generatedAt=String.valueOf(System.now());
        dto.namespacePrefix=resolveNamespace();
        Organization org=[SELECT Name,IsSandbox,OrganizationType,InstanceName FROM Organization LIMIT 1];
        dto.organisationName=org.Name; dto.organisationType=String.valueOf(org.OrganizationType); dto.instanceName=org.InstanceName; dto.sandbox=org.IsSandbox;
        dto.environmentType=org.IsSandbox?'Sandbox':String.valueOf(org.OrganizationType);
        User u=[SELECT Name,UserType,TimeZoneSidKey,LocaleSidKey,LanguageLocaleKey,Profile.Name FROM User WHERE Id=:UserInfo.getUserId() LIMIT 1];
        dto.runningUserName=u.Name; dto.userType=u.UserType; dto.profileName=u.Profile==null?null:u.Profile.Name;
        dto.timeZone=u.TimeZoneSidKey; dto.locale=u.LocaleSidKey; dto.language=u.LanguageLocaleKey;
        return dto;
    }

    @AuraEnabled public static DiagnosticDTO runDiagnostics(){
        DiagnosticDTO dto=new DiagnosticDTO();
        dto.checks.add(new CheckDTO('runtime','Studio Runtime','Passed','ER Modeller Studio Version '+STUDIO_VERSION+' diagnostics are running successfully.',null));
        Boolean fieldUsageReadable=Schema.sObjectType.Field_Usage_Run__c.isAccessible()&&Schema.sObjectType.Field_Usage_Evidence__c.isAccessible()&&Schema.sObjectType.Field_Usage_Schedule__c.isAccessible();
        dto.checks.add(fieldUsageReadable?new CheckDTO('data','Field Usage Data Model','Passed','Required Field Usage objects are accessible to the running user.',null):new CheckDTO('data','Field Usage Data Model','Failed','One or more required Field Usage objects are not accessible.','Review the Diagram Studio permission set and Field Usage object access.'));
        List<Field_Usage_Run__c> latest=[SELECT Id,Status__c,Completed_At__c,Dependency_Count__c,Error_Count__c FROM Field_Usage_Run__c ORDER BY CreatedDate DESC LIMIT 1];
        if(latest.isEmpty())dto.checks.add(new CheckDTO('snapshot','Field Usage Snapshot','Information','No Field Usage run exists yet.','Run the first Field Usage scan when you are ready to build dependency evidence.'));
        else{Field_Usage_Run__c r=latest[0];String d='Latest run status: '+r.Status__c;if(r.Completed_At__c!=null)d+=' · completed '+String.valueOf(r.Completed_At__c);if(r.Dependency_Count__c!=null)d+=' · '+String.valueOf(r.Dependency_Count__c.intValue())+' dependencies';dto.checks.add(new CheckDTO('snapshot','Field Usage Snapshot',r.Status__c=='Failed'?'Attention':'Passed',d,r.Status__c=='Failed'?'Open the Field Usage activity console and review the latest run errors.':null));}
        Set<String> batchNames=new Set<String>{'FieldUsageDiscoveryBatch','FieldUsageToolingDiscoveryBatch','FieldUsageWorkUnitBatch'};
        List<AsyncApexJob> active=[SELECT Id,Status,ApexClass.Name,JobItemsProcessed,TotalJobItems,NumberOfErrors FROM AsyncApexJob WHERE ApexClass.Name IN :batchNames AND Status IN ('Holding','Queued','Preparing','Processing') ORDER BY CreatedDate DESC LIMIT 1];
        if(active.isEmpty())dto.checks.add(new CheckDTO('batch','Batch Engine','Passed','No Field Usage batch is currently active. The batch engine is available.',null));
        else{AsyncApexJob j=active[0];dto.checks.add(new CheckDTO('batch','Batch Engine','Passed',j.ApexClass.Name+' is '+j.Status+' · '+j.JobItemsProcessed+' of '+j.TotalJobItems+' batches processed · '+j.NumberOfErrors+' errors.',null));}
        Integer enabledSchedules=[SELECT count() FROM Field_Usage_Schedule__c WHERE Enabled__c=true];
        dto.checks.add(new CheckDTO('scheduler','Scheduler','Passed',enabledSchedules==0?'No automatic Field Usage schedules are enabled.':enabledSchedules+' automatic Field Usage schedule(s) enabled.',null));
        try{FieldUsageToolingApiClient.assertConnectionReady();dto.checks.add(new CheckDTO('tooling','Tooling API Connection','Passed','Salesforce Tooling API '+TOOLING_API_VERSION+' authenticated successfully through Salesforce_Tooling_API.',null).withDiagnosis('Authenticated and reachable'));}
        catch(Exception ex){dto.checks.add(buildToolingFailure(ex));}
        Integer failed=0,attention=0;for(CheckDTO c:dto.checks){if(c.status=='Failed')failed++;else if(c.status=='Attention')attention++;}
        dto.overallStatus=failed>0?'Configuration Required':(attention>0?'Attention Required':'Application Ready');
        dto.summary=failed>0?failed+' diagnostic check(s) failed. Resolve the failed checks before relying on all Studio features.':(attention>0?attention+' item(s) need attention. Core diagnostics completed.':'All required diagnostic checks passed. ER Modeller Studio is ready to work.');
        dto.completedAt=String.valueOf(System.now());return dto;
    }

    private static CheckDTO buildToolingFailure(Exception ex){
        String raw=safeMessage(ex),lower=raw.toLowerCase();String diagnosis='Tooling API configuration could not be verified',detail=raw;List<String> actions=new List<String>();
        Boolean principalSignal=lower.contains('external credential')||lower.contains('principal')||lower.contains('user external credential');Boolean namedSignal=lower.contains('named credential')||lower.contains('salesforce_tooling_api')||lower.contains('callout');Boolean authSignal=lower.contains('unauthorized')||lower.contains('authentication')||lower.contains('oauth')||lower.contains('401')||lower.contains('403')||lower.contains('access denied')||lower.contains('not authorized');Boolean endpointSignal=lower.contains('404')||lower.contains('not found')||lower.contains('endpoint');
        if(principalSignal||(authSignal&&namedSignal)){diagnosis='Likely External Credential Principal access or authentication issue';detail='The preflight returned an authentication/access failure. Salesforce does not expose enough protected credential metadata to prove which setting is missing, so check these likely causes first. Evidence: '+raw;actions.add('Open Setup → Permission Sets and open the permission set assigned to the running user.');actions.add('Open External Credential Principal Access and confirm the principal used by Salesforce_Tooling_API is enabled.');actions.add('Confirm that permission set is assigned to the running user. Studio Apex/class access alone does not grant External Credential Principal access.');actions.add('Open Setup → Named Credentials and confirm Salesforce_Tooling_API exists and references the intended External Credential.');actions.add('Open the External Credential and confirm its principal is configured and authentication has been completed where required.');}
        else if(namedSignal){diagnosis='Named Credential configuration issue';actions.add('Open Setup → Named Credentials and confirm Salesforce_Tooling_API exists with that exact API name.');actions.add('Confirm Salesforce_Tooling_API references the intended External Credential and endpoint.');actions.add('Confirm the running user has access through the configured External Credential Principal.');}
        else if(endpointSignal){diagnosis='Tooling API endpoint or API version issue';actions.add('Confirm the Named Credential endpoint targets the correct Salesforce org/domain.');actions.add('Confirm Tooling API '+TOOLING_API_VERSION+' is supported by this org.');}
        else if(authSignal){diagnosis='Tooling API authentication or authorisation issue';actions.add('Confirm the External Credential authentication is valid and has not expired or been revoked.');actions.add('Confirm External Credential Principal Access is granted to the running user through a Permission Set.');actions.add('Confirm the running user has Salesforce API access required by the Tooling API.');}
        else{diagnosis='Tooling API request failed — configuration requires review';actions.add('Review the error evidence shown above, then verify the connection configuration below.');}
        addCommonToolingChecks(actions);return new CheckDTO('tooling','Tooling API Connection','Failed',detail,'Diagnostics identified the most likely failure area. Work through the checks below, then run Diagnostics again.').withDiagnosis(diagnosis).withActions(actions);
    }
    private static void addCommonToolingChecks(List<String> actions){for(String item:new List<String>{'Confirm the ER Modeller Studio permission set is assigned to the running user.','Confirm the running user has External Credential Principal Access for the principal used by Salesforce_Tooling_API.','Confirm the Named Credential and External Credential are active and correctly linked.','Confirm authentication/token state is valid and complete.','Confirm the running user has Salesforce API access required for Tooling API queries.','Confirm the org permits API access and Tooling API '+TOOLING_API_VERSION+' is available.','After correcting configuration, return here and run Diagnostics again.'})if(!actions.contains(item))actions.add(item);}
    private static String resolveNamespace(){String n=StudioDiagnosticsController.class.getName();Integer dot=n.indexOf('.');return dot>0?n.substring(0,dot):'Unmanaged / no namespace';}
    private static String safeMessage(Exception ex){String m=ex==null?'Unknown diagnostic error.':ex.getMessage();if(String.isBlank(m))return 'The Tooling API connection could not be verified.';return m.length()>500?m.substring(0,500):m;}
}
