/** Read-only Health Check: setup metadata and Describe only; never queries business records. */
public with sharing class ScanMetadataAccessCheck {
    public class Gap {
        @AuraEnabled public String objectName; @AuraEnabled public String fieldName;
        @AuraEnabled public String issue; @AuraEnabled public String action;
        public Gap(String o,String f,String i,String a){objectName=o;fieldName=f;issue=i;action=a;}
    }
    public class Result {
        public Boolean detected=false,partial=false; public Integer objects=0,fields=0,totalGaps=0;
        public String note; public List<Gap> gaps=new List<Gap>();
    }
    @TestVisible private static Set<String> objectsOverride;
    @TestVisible private static Map<String,String> issuesOverride=new Map<String,String>();
    private static void add(Result r,String o,String f,String issue){
        r.totalGaps++;
        if(r.gaps.size()>=100){r.partial=true;return;}
        String action=issue=='Object Read missing'?'Diagram Studio User > Object Settings > '+o+': enable Read; review field Read access.':
            issue=='Field Read missing'?'Diagram Studio User > Object Settings > '+o+': enable Read for '+f+'.':
            'Verify applicable licence and Salesforce metadata availability. If configurable, review object Read and field Read in Diagram Studio User.';
        r.gaps.add(new Gap(o,f,issue,action));
    }
    public static Result inspect(){
        Result r=new Result();Set<String> names=new Set<String>();
        if(Test.isRunningTest()&&objectsOverride!=null){names.addAll(objectsOverride);r.detected=!names.isEmpty();}
        else {
            Set<Id> licences=new Set<Id>();
            try {for(PermissionSetLicense licence:[SELECT Id FROM PermissionSetLicense WHERE MasterLabel LIKE '%Public Sector%' OR DeveloperName LIKE '%PublicSector%' OR DeveloperName LIKE 'PSS%' LIMIT 101])licences.add(licence.Id);}
            catch(Exception ex){r.partial=true;r.note='Public Sector licence metadata could not be inspected. Verify setup-metadata access for this diagnostic user.';return r;}
            r.detected=!licences.isEmpty();if(!r.detected)return r;
            if(licences.size()>100)r.partial=true;
            Set<Id> permissions=new Set<Id>();
            try {
                for(PermissionSet permission:[SELECT Id FROM PermissionSet WHERE LicenseId IN :licences AND IsOwnedByProfile=false LIMIT 301])permissions.add(permission.Id);
                if(permissions.size()>300)r.partial=true;
                List<ObjectPermissions> grants=[SELECT SobjectType FROM ObjectPermissions WHERE ParentId IN :permissions LIMIT 2001];
                if(grants.size()>2000)r.partial=true;
                for(ObjectPermissions grant:grants)names.add(grant.SobjectType);
            }catch(Exception ex){r.partial=true;r.note='Some licence-bound object grants were unavailable; available Public Sector schema probes are shown.';}
            names.addAll(new Set<String>{'BenefitDisbursement','BenefitAssignment','Benefit','BenefitSession','IndividualApplication','BusinessLicenseApplication','BusinessLicense','PublicComplaint','RegulatoryCode','RegulatoryAuthority','Program','ProgramEnrollment','ServiceDelivery'});
        }
        Map<String,Schema.SObjectType> globalTypes=Schema.getGlobalDescribe();
        List<String> ordered=new List<String>();
        // Check the reported failing object first, then a stable order.
        if(names.remove('BenefitDisbursement'))ordered.add('BenefitDisbursement');
        List<String> rest=new List<String>(names);rest.sort();ordered.addAll(rest);
        Integer cpuEnd=Limits.getCpuTime()+3500;
        for(String name:ordered){
            if(r.objects>=50||Limits.getCpuTime()>cpuEnd){r.partial=true;break;}
            Schema.SObjectType token=globalTypes.get(name);if(token==null)continue;
            r.objects++;
            try {
                Schema.DescribeSObjectResult objectInfo=token.getDescribe();
                if(!objectInfo.isQueryable())continue;
                if(!objectInfo.isAccessible()){add(r,name,'—','Object Read missing');continue;}
                Map<String,Schema.SObjectField> fields=objectInfo.fields.getMap();List<String> keys=new List<String>(fields.keySet());keys.sort();
                for(String key:keys){
                    if(r.fields>=8000||Limits.getCpuTime()>cpuEnd){r.partial=true;break;}
                    r.fields++;
                    String injected=Test.isRunningTest()?issuesOverride.get((name+'.'+key).toLowerCase()):null;
                    if(injected!=null){add(r,name,key,injected);continue;}
                    try {
                        Schema.DescribeFieldResult fieldInfo=fields.get(key).getDescribe();
                        if(!fieldInfo.isAccessible())add(r,name,fieldInfo.getName(),'Field Read missing');
                        else {fieldInfo.getType();fieldInfo.isCalculated();fieldInfo.getCalculatedFormula();}
                    }catch(System.SObjectException ex){add(r,name,key,'Metadata unavailable');}
                }
            }catch(System.SObjectException ex){add(r,name,'—','Metadata unavailable');}
        }
        return r;
    }
}
