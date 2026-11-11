@IsTest private class IndustryAccessControllerTest {
    private static Id scanId;
    private static PermissionSet setupTarget(){
        PermissionSet p=new PermissionSet(Name='Industry_Read_Test',Label='Industry Read Test');insert p;
        IndustryAccessController.targetOverride=p.Name;
        IndustryAccessController.objectsOverride=new Set<String>{'Account'};
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Completed',Tracks_Skips__c=true);
        System.runAs(new User(Id=UserInfo.getUserId())){
            insert run;scanId=run.Id;
            insert new Field_Usage_Skip__c(Run__c=run.Id,Object_Name__c='Account',Entries__c='phone|Read\n',Entry_Count__c=1,Skip_Key__c=run.Id+'|Account|0');
        }
        return p;
    }
    @IsTest static void noIndustryHasNoAccessReview(){
        IndustryAccessController.objectsOverride=new Set<String>();
        Integer writes=Limits.getDmlStatements();IndustryAccessController.Discovery d=IndustryAccessController.getReview();
        System.assertEquals(false,d.detected);System.assertEquals(0,d.objects.size());System.assertEquals(writes,Limits.getDmlStatements());
        Boolean denied=false;try{IndustryAccessController.applyReadAccess('Account',new List<String>{'Phone'},true,scanId);}catch(Exception ex){denied=true;}System.assert(denied);
        System.assertEquals('Health Cloud',IndustryAccessController.cloudName('Health Cloud','HealthCloud'));
        System.assertEquals('Public Sector',IndustryAccessController.cloudName('Public Sector Solutions','PSS'));
        System.assertEquals('Financial Services',IndustryAccessController.cloudName('Financial Services Cloud','FSC'));
        System.assertEquals(null,IndustryAccessController.cloudName('Sales Cloud','Sales'));
    }
    @IsTest static void reviewIsReadOnlyAndWritesOnlySelectedRead(){
        PermissionSet p=setupTarget();
        PermissionSet other=new PermissionSet(Name='Other_Industry_Access',Label='Other Industry Access');insert other;
        insert new ObjectPermissions(ParentId=other.Id,SobjectType='Account',PermissionsRead=true,PermissionsEdit=true);
        insert new FieldPermissions(ParentId=other.Id,SobjectType='Account',Field='Account.Phone',PermissionsRead=true,PermissionsEdit=true);
        Integer writes=Limits.getDmlStatements();
        IndustryAccessController.ObjectReview review=IndustryAccessController.getObjectReview('Account',scanId);
        System.assert(review.needsObjectRead);System.assertEquals(writes,Limits.getDmlStatements());
        Set<String> missing=new Set<String>();for(IndustryAccessController.Item item:review.fields)if(item.eligible)missing.add(item.name);
        System.assert(missing.contains('Phone'),'A grant in another permission set cannot satisfy Diagram Studio User.');

        IndustryAccessController.UpdateResult result=IndustryAccessController.applyReadAccess('Account',new List<String>{'Phone'},true,scanId);
        System.assert(result.objectSuccess);
        ObjectPermissions op=[SELECT PermissionsRead,PermissionsCreate,PermissionsEdit,PermissionsDelete,PermissionsViewAllRecords,PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId=:p.Id AND SobjectType='Account'];
        System.assert(op.PermissionsRead);System.assert(!op.PermissionsCreate&&!op.PermissionsEdit&&!op.PermissionsDelete&&!op.PermissionsViewAllRecords&&!op.PermissionsModifyAllRecords);
        List<FieldPermissions> fields=[SELECT Field,PermissionsRead,PermissionsEdit FROM FieldPermissions WHERE ParentId=:p.Id];
        System.assertEquals(1,fields.size());System.assertEquals('Account.Phone',fields[0].Field);System.assert(fields[0].PermissionsRead&&!fields[0].PermissionsEdit);
        for(IndustryAccessController.Item item:IndustryAccessController.getObjectReview('Account',scanId).fields)if(item.name=='Phone')System.assert(!item.eligible);
        System.assert(Account.Phone.getDescribe().isAccessible(),'Admin access must not mask a missing target grant.');
        System.assertEquals(1,[SELECT count() FROM FieldPermissions WHERE ParentId=:p.Id]);
    }
    @IsTest static void rejectsTamperingBeforeWritesAndPreservesExistingFlags(){
        PermissionSet p=setupTarget();
        insert new ObjectPermissions(ParentId=p.Id,SobjectType='Account',PermissionsRead=true,PermissionsEdit=true);
        Integer writes=Limits.getDmlStatements();Boolean rejected=false;
        try{IndustryAccessController.applyReadAccess('Contact',new List<String>{'Phone'},true,scanId);}catch(Exception ex){rejected=true;}System.assert(rejected);System.assertEquals(writes,Limits.getDmlStatements());
        rejected=false;try{IndustryAccessController.applyReadAccess('Account',new List<String>{'Id'},true,scanId);}catch(Exception ex){rejected=true;}System.assert(rejected);System.assertEquals(writes,Limits.getDmlStatements());
        IndustryAccessController.applyReadAccess('Account',new List<String>{'Phone'},false,scanId);
        System.assert([SELECT PermissionsEdit FROM ObjectPermissions WHERE ParentId=:p.Id AND SobjectType='Account'].PermissionsEdit);
    }
    @IsTest static void ordinaryUserCannotGrantPermissions(){
        Profile p=[SELECT Id FROM Profile WHERE PermissionsManageProfilesPermissionsets=false AND UserType='Standard' LIMIT 1];
        User u=new User(ProfileId=p.Id,Username='industry.'+System.now().getTime()+'@example.invalid',Email='industry@example.invalid',Alias='industry',LastName='Reviewer',TimeZoneSidKey='Pacific/Auckland',LocaleSidKey='en_US',EmailEncodingKey='UTF-8',LanguageLocaleKey='en_US');insert u;
        System.runAs(u){
            IndustryAccessController.objectsOverride=new Set<String>{'Account'};
            Integer writes=Limits.getDmlStatements();Boolean denied=false;
            try{IndustryAccessController.applyReadAccess('Account',new List<String>{'Phone'},true,scanId);}catch(Exception ex){denied=true;}
            System.assert(denied);System.assertEquals(writes,Limits.getDmlStatements());
        }
    }
}