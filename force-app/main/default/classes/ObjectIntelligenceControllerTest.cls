@IsTest
private class ObjectIntelligenceControllerTest {
    @IsTest static void readsAllIntelligenceFromCurrentSnapshot(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Completed_At__c=System.now());insert run;
        insert new List<Field_Usage_Evidence__c>{
            row(run.Id,'Account','Name','Page Layout','Account Layout','Page Layout Field'),
            row(run.Id,'Account','Name','Record Type','Business Account','Record Type Layout Assignment'),
            row(run.Id,'Account','Name','Apex Trigger','AccountTrigger','Apex Reference'),
            row(run.Id,'Account','Name','Flow','Account Flow','Flow Reference'),
            row(run.Id,'Account','Name','Validation Rule','Account_Check','Validation Rule Reference')
        };
        Test.startTest();ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');Test.stopTest();
        System.assertEquals(true,result.snapshotLoaded);System.assertEquals(true,result.toolingLoaded);System.assertEquals(null,result.toolingMessage);
        System.assertEquals('Account Layout',result.layouts[0].name);System.assertEquals('Business Account',result.recordTypes[0].name);
        System.assertEquals('AccountTrigger',result.triggers[0].name);System.assertEquals('Account Flow',result.flows[0].name);System.assertEquals('Account_Check',result.validationRules[0].name);
    }
    @IsTest static void noSnapshotDoesNotCallApi(){
        Test.startTest();ObjectIntelligenceController.Result result=ObjectIntelligenceController.getObjectIntelligence('Account');Test.stopTest();
        System.assertEquals(false,result.snapshotLoaded);System.assertEquals(false,result.toolingLoaded);System.assert(result.toolingMessage.contains('Run a usage scan'));
    }
    @IsTest static void blankAndUnknownAreSafe(){
        System.assertEquals(false,ObjectIntelligenceController.getObjectIntelligence(' ').snapshotLoaded);
        System.assertEquals(false,ObjectIntelligenceController.getObjectIntelligence('Definitely_Not_An_Object__c').snapshotLoaded);
    }
    private static Field_Usage_Evidence__c row(Id runId,String objectName,String fieldName,String source,String component,String type){return new Field_Usage_Evidence__c(Run__c=runId,Field_Key__c=objectName+'.'+fieldName,Object_API_Name__c=objectName,Field_API_Name__c=fieldName,Source_Type__c=source,Component_Name__c=component,Evidence_Type__c=type,Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=1,Location__c=component);}
}