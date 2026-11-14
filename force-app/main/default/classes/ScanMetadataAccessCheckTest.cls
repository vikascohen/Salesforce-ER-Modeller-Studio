@IsTest private class ScanMetadataAccessCheckTest {
    @IsTest static void absentPssDoesNotRequestPermissions(){
        ScanMetadataAccessCheck.objectsOverride=new Set<String>();
        Integer queries=Limits.getQueries(),writes=Limits.getDmlStatements();
        ScanMetadataAccessCheck.Result result=ScanMetadataAccessCheck.inspect();
        System.assertEquals(false,result.detected);System.assertEquals(0,result.gaps.size());
        System.assertEquals(queries,Limits.getQueries());System.assertEquals(writes,Limits.getDmlStatements());
    }
    @IsTest static void gapsAreMetadataOnlyAndRecommendationsAreReadOnly(){
        ScanMetadataAccessCheck.objectsOverride=new Set<String>{'Account','Missing_Industry_Object__c'};
        PermissionSet target=new PermissionSet(Name='Industry_Audit_Test',Label='Industry Audit Test');insert target;IndustryAccessController.targetOverride=target.Name;
        IndustryAccessController.unavailableFields.add('account.phone');
        Integer queries=Limits.getQueries(),writes=Limits.getDmlStatements();
        ScanMetadataAccessCheck.Result result=ScanMetadataAccessCheck.inspect();
        System.assert(result.detected);System.assertEquals(1,result.objects);System.assert(result.fields>0);
        System.assertEquals(writes,Limits.getDmlStatements());
        Boolean readFound=false,unavailableFound=false;
        for(ScanMetadataAccessCheck.Gap gap:result.gaps){
            String action=gap.action.toLowerCase();System.assert(!action.contains('edit'));System.assert(!action.contains('view all'));System.assert(!action.contains('modify'));System.assert(!action.contains('create'));System.assert(!action.contains('delete'));
            if(gap.fieldName.equalsIgnoreCase('Description')){readFound=true;System.assert(action.contains('diagram studio user'));System.assert(action.contains('read'));}
            if(gap.fieldName.equalsIgnoreCase('Phone')){unavailableFound=true;System.assert(action.contains('licence'));}
        }
        System.assert(readFound&&unavailableFound);
    }
}
