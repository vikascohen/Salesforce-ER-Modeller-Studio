/**
 * Metadata-only industry access review. Mutations are explicit, administrator-only,
 * fixed to Diagram_Studio_User and add Read only. No assignments or business queries.
 */
public with sharing class IndustryAccessController {
    public class Discovery {
        @AuraEnabled public Id runId;
        @AuraEnabled public Boolean detected=false;
        @AuraEnabled public Integer recordedObjectCount=0;
        @AuraEnabled public Boolean partial=false;
        @AuraEnabled public Boolean canUpdate=false;
        @AuraEnabled public List<String> clouds=new List<String>();
        @AuraEnabled public List<String> objects=new List<String>();
        @AuraEnabled public String message;
    }
    public class Item {
        @AuraEnabled public String name;
        @AuraEnabled public String label;
        @AuraEnabled public Boolean eligible;
        @AuraEnabled public String message;
        public Item(String n,String l,Boolean e,String m){name=n;label=l;eligible=e;message=m;}
    }
    public class ObjectReview {
        @AuraEnabled public String objectName;
        @AuraEnabled public Boolean needsObjectRead=false;
        @AuraEnabled public Boolean objectOnlyAllowed=false;
        public Integer inspectedFields=0;
        @AuraEnabled public Boolean partial=false;
        @AuraEnabled public List<Item> fields=new List<Item>();
        @AuraEnabled public String message;
    }
    public class UpdateResult {
        @AuraEnabled public String objectName;
        @AuraEnabled public Boolean objectSuccess=false;
        @AuraEnabled public List<String> addedPrerequisites=new List<String>();
        @AuraEnabled public List<Item> results=new List<Item>();
    }
    @TestVisible private static Set<String> objectsOverride;
    @TestVisible private static String targetOverride;
    private static final Map<String,String> CLOUD_TOKENS=new Map<String,String>{
        'publicsector'=>'Public Sector','pss'=>'Public Sector','healthcloud'=>'Health Cloud',
        'healthcare'=>'Health Cloud','financialservices'=>'Financial Services','finserv'=>'Financial Services',
        'manufacturing'=>'Manufacturing','consumergoods'=>'Consumer Goods','energyutilities'=>'Energy and Utilities',
        'communications'=>'Communications','mediacloud'=>'Media','automotive'=>'Automotive',
        'educationcloud'=>'Education','nonprofit'=>'Nonprofit','lifesciences'=>'Life Sciences','insurance'=>'Insurance'
    };
    public static String cloudName(String label,String developerName){
        String text=((label==null?'':label)+(developerName==null?'':developerName)).toLowerCase().replaceAll('[^a-z0-9]','');
        for(String token:CLOUD_TOKENS.keySet())if(text.contains(token))return CLOUD_TOKENS.get(token);
        return null;
    }
    public static Discovery discover(){
        Discovery d=new Discovery();Set<String> names=new Set<String>(),clouds=new Set<String>();
        if(Test.isRunningTest()&&objectsOverride!=null){names.addAll(objectsOverride);if(!names.isEmpty())clouds.add('Test industry');}
        else{
            try{
                List<PermissionSetLicense> rows=[SELECT Id,MasterLabel,DeveloperName FROM PermissionSetLicense LIMIT 1001];
                if(rows.size()>1000)d.partial=true;
                for(PermissionSetLicense row:rows){String cloud=cloudName(row.MasterLabel,row.DeveloperName);if(cloud!=null){clouds.add(cloud);}}
                // Known industry namespaces are capability evidence, not inferred from shared objects.
                for(String name:Schema.getGlobalDescribe().keySet()){
                    if(name.startsWith('healthcloudga__')){clouds.add('Health Cloud');names.add(name);}
                    else if(name.startsWith('finserv__')){clouds.add('Financial Services');names.add(name);}
                    else if(name.startsWith('vlocity_cmt__')){clouds.add('Communications / Media / Utilities');names.add(name);}
                    else if(name.startsWith('vlocity_ins__')){clouds.add('Insurance');names.add(name);}
                }
                // Cloud licences select the schema catalogue. Never use grants on unrelated sets as the inventory.
                Map<String,String> catalogue=new Map<String,String>{
                    'Public Sector'=>'BenefitDisbursement BenefitAssignment Benefit BenefitSession BenefitType BenefitSchedule BenefitDisbursementAdj IndividualApplication BusinessLicenseApplication BusinessLicense PublicComplaint RegulatoryCode RegulatoryAuthority RegulatoryAuthorizationType RegulatoryAuthorization ApplicationReview ApplicationStageDefinition Program ProgramEnrollment ServiceDelivery InspectionType InspectionAssessmentInd InspectionVisit AssessmentIndicatorDefinition CarePlan CaseParticipant',
                    'Health Cloud'=>'CarePlan CareProgram CareProgramEnrollee CareProgramProvider CareProgramEligibilityRule CareProgramProduct HealthcareProvider HealthcareFacility HealthcarePractitionerFacility HealthCondition ClinicalEncounter ClinicalServiceRequest PatientMedicationDosage Identifier',
                    'Financial Services'=>'FinancialAccount FinancialAccountRole FinancialHolding FinancialGoal FinancialTransaction SecuritiesHolding InsurancePolicy',
                    'Insurance'=>'InsurancePolicy InsurancePolicyCoverage InsurancePolicyParticipant Claim ClaimCoverage',
                    'Manufacturing'=>'SalesAgreement SalesAgreementProduct SalesAgreementProductSchedule AccountForecast',
                    'Consumer Goods'=>'RetailStore RetailVisitKpi RetailStoreGroup StoreProduct RetailStoreKpi',
                    'Energy and Utilities'=>'ServicePoint ServiceAccount EnergyServiceAgreement',
                    'Communications'=>'ServiceAccount ServicePoint',
                    'Media'=>'AdSpace AdCreative AdOrderItem',
                    'Automotive'=>'Vehicle VehicleDefinition VehicleAssetEmssnSrc VehicleParticipant',
                    'Education'=>'LearnerProgram LearnerEnrollment LearningProgram LearningCourse AcademicTerm',
                    'Nonprofit'=>'GiftTransaction GiftCommitment GiftDesignation GiftDefaultDesignation GiftTribute',
                    'Life Sciences'=>'ClinicalTrial ClinicalTrialSite ClinicalTrialParticipant'
                };
                for(String cloud:clouds)if(catalogue.containsKey(cloud))names.addAll(catalogue.get(cloud).split(' '));
            }catch(Exception ex){d.partial=true;d.message='Some industry capability metadata could not be inspected.';}
        }
        Map<String,Schema.SObjectType> types=Schema.getGlobalDescribe();Set<String> canonical=new Set<String>();
        for(String name:names){Schema.SObjectType token=types.get(name);if(token!=null){try{Schema.DescribeSObjectResult info=token.getDescribe();if(info.isQueryable()&&!info.isDeprecatedAndHidden())canonical.add(info.getName());}catch(Exception ex){d.partial=true;}}}
        d.clouds.addAll(clouds);d.clouds.sort();d.detected=!clouds.isEmpty();d.objects.addAll(canonical);d.objects.sort();
        if(d.objects.size()>500){d.partial=true;while(d.objects.size()>500)d.objects.remove(d.objects.size()-1);}

        return d;
    }
    public static Boolean canManage(){
        Profile p=[SELECT PermissionsManageProfilesPermissionsets,PermissionsCustomizeApplication FROM Profile WHERE Id=:UserInfo.getProfileId()];
        Boolean manage=p.PermissionsManageProfilesPermissionsets,customize=p.PermissionsCustomizeApplication;
        for(PermissionSetAssignment a:[SELECT PermissionSet.PermissionsManageProfilesPermissionsets,PermissionSet.PermissionsCustomizeApplication FROM PermissionSetAssignment WHERE AssigneeId=:UserInfo.getUserId()]){
            manage=manage||a.PermissionSet.PermissionsManageProfilesPermissionsets;customize=customize||a.PermissionSet.PermissionsCustomizeApplication;
        }
        return manage&&customize;
    }
    private static PermissionSet target(){
        String name=Test.isRunningTest()&&targetOverride!=null?targetOverride:'Diagram_Studio_User';
        List<PermissionSet> rows=[SELECT Id,Name,Label FROM PermissionSet WHERE Name=:name AND IsOwnedByProfile=false AND NamespacePrefix=null LIMIT 1];
        if(rows.isEmpty())throw new AuraHandledException('Diagram Studio User permission set was not found or is not editable in this org.');
        return rows[0];
    }
    // All grant comparisons use the same immutable target. Describe provides only the names and configurability.
    public class Grants {
        public Set<String> objects=new Set<String>();
        public Set<String> fields=new Set<String>();
    }
    public static Grants grantsFor(Set<String> objectNames){
        Grants grants=new Grants();
        PermissionSet destination=target();
        for(ObjectPermissions row:[SELECT SobjectType FROM ObjectPermissions WHERE ParentId=:destination.Id AND SobjectType IN :objectNames AND PermissionsRead=true])
            grants.objects.add(row.SobjectType.toLowerCase());
        for(FieldPermissions row:[SELECT Field FROM FieldPermissions WHERE ParentId=:destination.Id AND SobjectType IN :objectNames AND PermissionsRead=true])
            grants.fields.add(row.Field.toLowerCase());
        return grants;
    }
    private static Set<String> configurableObjects;
    @TestVisible private static Set<String> unavailableFields=new Set<String>();
    public static Boolean supportsObjectRead(String name){
        if(configurableObjects==null){
            configurableObjects=new Set<String>();
            for(Schema.PicklistEntry entry:ObjectPermissions.SobjectType.getDescribe().getPicklistValues())
                if(entry.isActive())configurableObjects.add(entry.getValue().toLowerCase());
        }
        return configurableObjects.contains(name.toLowerCase());
    }
    public static ObjectReview compare(String name,Schema.SObjectType token,Grants grants,Integer maximum,Integer cpuEnd){
        ObjectReview result=new ObjectReview();
        result.objectName=name;
        if(!supportsObjectRead(name)){
            result.fields.add(new Item('—',name,false,'Object Read is unavailable for this object.'));
            return result;
        }
        result.needsObjectRead=!grants.objects.contains(name.toLowerCase());
        result.objectOnlyAllowed=result.needsObjectRead;
        Map<String,Schema.SObjectField> fields=token.getDescribe().fields.getMap();
        List<String> keys=new List<String>(fields.keySet());keys.sort();
        for(String key:keys){
            if(result.inspectedFields>=maximum||Limits.getCpuTime()>cpuEnd){result.partial=true;break;}
            result.inspectedFields++;
            String qualified=(name+'.'+key).toLowerCase();
            if(grants.fields.contains(qualified))continue;
            if(Test.isRunningTest()&&unavailableFields.contains(qualified)){
                result.fields.add(new Item(key,key,false,'Metadata unavailable. Review licence or platform availability.'));continue;
            }
            try{
                Schema.DescribeFieldResult field=fields.get(key).getDescribe();
                if(field.isPermissionable())result.fields.add(new Item(field.getName(),field.getLabel(),true,'Read Access missing from Diagram Studio User'));
            }catch(System.SObjectException unavailable){
                result.fields.add(new Item(key,key,false,'Metadata unavailable. Review licence or platform availability.'));
            }
        }
        result.message=result.partial?'Partial field review.':'Showing missing Read permissions on Diagram Studio User.';
        return result;
    }
    public static Field_Usage_Run__c latest(){
        List<Field_Usage_Run__c> runs=[SELECT Id,Status__c,Tracks_Skips__c FROM Field_Usage_Run__c ORDER BY CreatedDate DESC,Id DESC LIMIT 1];
        return runs.isEmpty()?null:runs[0];
    }
    public static Discovery getReview(){
        Discovery discovery=discover();Field_Usage_Run__c run=latest();discovery.objects.clear();discovery.runId=run?.Id;
        if(run==null||!run.Tracks_Skips__c)return discovery;
        Set<String> names=new Set<String>();
        for(Field_Usage_Skip__c row:[SELECT Object_Name__c FROM Field_Usage_Skip__c WHERE Run__c=:run.Id])names.add(row.Object_Name__c);
        discovery.recordedObjectCount=names.size();
        if(!names.isEmpty()&&discovery.detected){
            Grants grants=grantsFor(names);
            Map<String,Schema.SObjectType> schemaTypes=Schema.getGlobalDescribe();
            Set<String> pending=new Set<String>();
            for(Field_Usage_Skip__c row:[SELECT Object_Name__c,Entries__c FROM Field_Usage_Skip__c WHERE Run__c=:run.Id]){
                String name=row.Object_Name__c;
                if(pending.contains(name)||!supportsObjectRead(name))continue;
                ObjectReview review=reviewSkips(name,FieldUsageSchemaAccess.unpack(row.Entries__c),grants,schemaTypes.get(name));
                if(review.needsObjectRead){pending.add(name);continue;}
                for(Item item:review.fields)if(item.eligible){pending.add(name);break;}
            }
            discovery.objects.addAll(pending);
        }else discovery.objects.addAll(names);
        discovery.objects.sort();
        discovery.canUpdate=discovery.detected&&canManage()&&run.Status__c!='Running'&&run.Status__c!='Queued';
        return discovery;
    }
    private static void requireLatest(Id runId){
        Field_Usage_Run__c run=latest();
        if(runId==null||run==null||run.Id!=runId||!run.Tracks_Skips__c)throw new AuraHandledException('A newer scan is available. Refresh Health Check and review its results.');
    }
    public static ObjectReview getObjectReview(String objectName,Id runId){
        requireLatest(runId);
        Map<String,String> missed=new Map<String,String>();
        for(Field_Usage_Skip__c row:[SELECT Entries__c FROM Field_Usage_Skip__c WHERE Run__c=:runId AND Object_Name__c=:objectName])missed.putAll(FieldUsageSchemaAccess.unpack(row.Entries__c));
        if(missed.isEmpty())throw new AuraHandledException('This object has no recorded skip in the selected scan.');
        return reviewSkips(objectName,missed,grantsFor(new Set<String>{objectName}),Schema.getGlobalDescribe().get(objectName));
    }
    private static ObjectReview reviewSkips(String objectName,Map<String,String> missed,Grants grants,Schema.SObjectType token){
        ObjectReview result=new ObjectReview();result.objectName=objectName;
        Boolean supported=token!=null&&supportsObjectRead(objectName);
        Map<String,Schema.SObjectField> fields=new Map<String,Schema.SObjectField>();
        try{if(supported)fields=token.getDescribe().fields.getMap();}catch(System.SObjectException ex){supported=false;}
        Boolean hasFix=false;
        List<String> names=new List<String>(missed.keySet());names.sort();
        for(String name:names){
            Boolean eligible=false;String display=name;
            String reason=missed.get(name)=='Read'?'Read unavailable at scan time':'Metadata unavailable at scan time';
            if(name=='*'){
                result.objectOnlyAllowed=supported&&missed.get(name)=='Read'&&!grants.objects.contains(objectName.toLowerCase());
                result.fields.add(new Item('*','Entire object',false,reason));continue;
            }
            try{
                Schema.SObjectField f=fields.get(name);
                if(f!=null){
                    Schema.DescribeFieldResult info=f.getDescribe();display=info.getName();
                    eligible=info.isPermissionable()&&missed.get(name)=='Read'&&!grants.fields.contains((objectName+'.'+name).toLowerCase());
                }
            }catch(System.SObjectException ex){eligible=false;}
            result.fields.add(new Item(display,display,eligible,eligible?'Missing Read grant':reason+'; review licensing or existing access.'));
            hasFix=hasFix||eligible;
        }
        result.needsObjectRead=(hasFix||result.objectOnlyAllowed)&&!grants.objects.contains(objectName.toLowerCase());
        return result;
    }
    private class DependencyException extends Exception {}
    @TestVisible private static List<String> requiredObjectReads(String message){
        Matcher rule=Pattern.compile('(?i)^Permission Read [A-Za-z][A-Za-z0-9_]* depends on permission\\(s\\): (.+)$').matcher(message);
        List<String> names=new List<String>();
        if(!rule.matches())return names;
        for(String term:rule.group(1).split(',')){
            Matcher item=Pattern.compile('(?i)^Read ([A-Za-z][A-Za-z0-9_]*)$').matcher(term.trim());
            if(!item.matches()||!supportsObjectRead(item.group(1)))return new List<String>();
            names.add(item.group(1));
        }
        return names;
    }
    private static void ensureRead(Id setId,String name,Set<String> visiting,List<String> added){
        if(visiting.contains(name.toLowerCase()))throw new DependencyException('Circular Object Read prerequisite for '+name+'.');
        if(Limits.getQueries()>=Limits.getLimitQueries()-5)throw new DependencyException('Too many prerequisites to resolve for '+name+'.');
        visiting.add(name.toLowerCase());
        List<ObjectPermissions> rows=[SELECT Id,PermissionsRead FROM ObjectPermissions WHERE ParentId=:setId AND SobjectType=:name];
        if(rows.isEmpty()||!rows[0].PermissionsRead){
            ObjectPermissions row=rows.isEmpty()?new ObjectPermissions(ParentId=setId,SobjectType=name):new ObjectPermissions(Id=rows[0].Id);
            row.PermissionsRead=true;
            Set<String> attempted=new Set<String>();
            while(true){
                if(Limits.getDmlStatements()>=Limits.getLimitDmlStatements()-5)throw new DependencyException('Too many prerequisite updates for '+name+'.');
                Database.SaveResult saved=row.Id==null?Database.insert(row,false,AccessLevel.USER_MODE):Database.update(row,false,AccessLevel.USER_MODE);
                if(saved.isSuccess()){added.add(name);break;}
                List<String> required=new List<String>();
                for(Database.Error error:saved.getErrors()){
                    List<String> parents=requiredObjectReads(error.getMessage());
                    if(error.getStatusCode()!=StatusCode.FIELD_INTEGRITY_EXCEPTION||parents.isEmpty())throw new DependencyException(error.getMessage());
                    required.addAll(parents);
                }
                Boolean advanced=false;
                for(String parent:required){
                    if(attempted.add(parent.toLowerCase())){
                        ensureRead(setId,parent,visiting,added);
                        advanced=true;
                    }
                }
                if(!advanced)throw new DependencyException(saved.getErrors()[0].getMessage());
            }
        }
        visiting.remove(name.toLowerCase());
    }
    public static UpdateResult applyReadAccess(String objectName,List<String> fieldNames,Boolean includeObjectRead,Id runId){
        if(!canManage()||!discover().detected)throw new AuraHandledException('Industry access changes require an authorised administrator in a supported Industry Cloud org.');
        requireLatest(runId);
        Field_Usage_Run__c run=latest();
        if(run.Status__c=='Running'||run.Status__c=='Queued')throw new AuraHandledException('Wait for the scan to finish before applying fixes.');
        ObjectReview approved=getObjectReview(objectName,runId);
        Schema.DescribeSObjectResult info=Schema.getGlobalDescribe().get(objectName).getDescribe();PermissionSet p=target();
        if(fieldNames==null)fieldNames=new List<String>();
        if(fieldNames.size()>100)throw new AuraHandledException('Select at most 100 fields per update batch.');
        Map<String,Schema.SObjectField> fields=info.fields.getMap();Set<String> requested=new Set<String>();
        Set<String> eligible=new Set<String>();
        for(Item item:approved.fields)if(item.eligible)eligible.add(item.name);
        if(fieldNames.isEmpty()&&!approved.objectOnlyAllowed)throw new AuraHandledException('Object Read is already present or unavailable. Refresh the review.');
        for(String name:fieldNames){
            if(!eligible.contains(name))throw new AuraHandledException('This field is no longer an eligible scan gap. Refresh Health Check.');
            Schema.SObjectField token=fields.get(name);
            if(token==null)throw new AuraHandledException('An unrecognised field was selected.');
            try{Schema.DescribeFieldResult f=token.getDescribe();if(!f.isPermissionable())throw new AuraHandledException('A selected field does not support configurable Read access.');requested.add(info.getName()+'.'+f.getName());}
            catch(System.SObjectException ex){throw new AuraHandledException('Selected field metadata is unavailable. Refresh the review.');}
        }
        UpdateResult result=new UpdateResult();result.objectName=objectName;
        List<ObjectPermissions> ops=[SELECT Id,PermissionsRead FROM ObjectPermissions WHERE ParentId=:p.Id AND SobjectType=:objectName];
        Boolean needsRead=ops.isEmpty()||!ops[0].PermissionsRead;
        if(needsRead&&includeObjectRead!=true)throw new AuraHandledException('Object Read is required for the selected fields. Include Object Read in the review.');
        if(needsRead){
            Savepoint checkpoint=Database.setSavepoint();
            try{
                ensureRead(p.Id,objectName,new Set<String>(),result.addedPrerequisites);
                if(!result.addedPrerequisites.isEmpty())result.addedPrerequisites.remove(result.addedPrerequisites.size()-1);
            }catch(DependencyException ex){
                Database.rollback(checkpoint);
                result.addedPrerequisites.clear();
                result.results.add(new Item(objectName,objectName,false,ex.getMessage()));
                return result;
            }
        }
        result.objectSuccess=true;
        result.results.add(new Item(objectName,objectName,true,needsRead?'Object Read added.':'Object Read already present.'));
        Map<String,FieldPermissions> existing=new Map<String,FieldPermissions>();
        for(FieldPermissions f:[SELECT Id,Field,PermissionsRead FROM FieldPermissions WHERE ParentId=:p.Id AND SobjectType=:objectName])existing.put(f.Field.toLowerCase(),f);
        List<FieldPermissions> inserts=new List<FieldPermissions>(),updates=new List<FieldPermissions>();
        for(String field:requested){
            FieldPermissions current=existing.get(field.toLowerCase());
            if(current==null)inserts.add(new FieldPermissions(ParentId=p.Id,SobjectType=objectName,Field=field,PermissionsRead=true,PermissionsEdit=false));
            else if(!current.PermissionsRead)updates.add(new FieldPermissions(Id=current.Id,Field=field,PermissionsRead=true));
            else result.results.add(new Item(field,field,true,'Read Access already present.'));
        }
        List<Database.SaveResult> inserted=Database.insert(inserts,false,AccessLevel.USER_MODE),updated=Database.update(updates,false,AccessLevel.USER_MODE);
        for(Integer i=0;i<inserts.size();i++)result.results.add(new Item(inserts[i].Field,inserts[i].Field,inserted[i].isSuccess(),inserted[i].isSuccess()?'Read Access added.':inserted[i].getErrors()[0].getMessage()));
        for(Integer i=0;i<updates.size();i++)result.results.add(new Item(updates[i].Field,updates[i].Field,updated[i].isSuccess(),updated[i].isSuccess()?'Read Access added.':updated[i].getErrors()[0].getMessage()));
        return result;
    }
}
