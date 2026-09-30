/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageSnapshotFinalizerTest {
    @IsTest static void incompleteWorkNeverReplacesCurrentSnapshot(){
        Field_Usage_Run__c oldRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Completed_At__c=System.now().addHours(-1));insert oldRun;
        Field_Usage_Run__c newRun=new Field_Usage_Run__c(Status__c='Running',Is_Current__c=false);insert newRun;
        insert new Field_Usage_Work_Unit__c(Run__c=newRun.Id,Work_Key__c=newRun.Id+'|Flow|1',Scanner_Type__c='Flow Bulk',Target_Key__c='301000000000001',Status__c='Pending');
        Test.startTest();FieldUsageSnapshotFinalizer.finish(newRun.Id,0,new List<String>());Test.stopTest();
        Map<Id,Field_Usage_Run__c> runs=new Map<Id,Field_Usage_Run__c>([SELECT Id,Status__c,Is_Current__c,Errors__c FROM Field_Usage_Run__c WHERE Id IN :new Set<Id>{oldRun.Id,newRun.Id}]);
        System.assertEquals(true,runs.get(oldRun.Id).Is_Current__c);
        System.assertEquals(false,runs.get(newRun.Id).Is_Current__c);
        System.assertEquals('Completed With Errors',runs.get(newRun.Id).Status__c);
        System.assert(!String.isBlank(runs.get(newRun.Id).Errors__c));
    }
    @IsTest static void successfulReplacementDeletesOldSnapshotAndChildren(){
        Field_Usage_Run__c oldRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Completed_At__c=System.now().addHours(-1));insert oldRun;
        insert new Field_Usage_Evidence__c(Run__c=oldRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='OldComponent',Evidence_Type__c='Apex Source Reference',Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=1);
        insert new Field_Usage_Work_Unit__c(Run__c=oldRun.Id,Work_Key__c=oldRun.Id+'|Old|1',Scanner_Type__c='Formula',Target_Key__c='Account|Name',Status__c='Completed');
        Field_Usage_Run__c newRun=new Field_Usage_Run__c(Status__c='Running',Is_Current__c=false);insert newRun;

        Test.startTest();FieldUsageSnapshotFinalizer.finish(newRun.Id,0,new List<String>());Test.stopTest();

        System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Run__c WHERE Id=:oldRun.Id],'Old successful snapshot should be deleted after replacement.');
        System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:oldRun.Id],'Old evidence should cascade-delete with its run.');
        System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:oldRun.Id],'Old work units should cascade-delete with their run.');
        Field_Usage_Run__c current=[SELECT Status__c,Is_Current__c FROM Field_Usage_Run__c WHERE Id=:newRun.Id];
        System.assertEquals('Completed',current.Status__c);System.assertEquals(true,current.Is_Current__c);
    }

    @IsTest static void zeroEvidenceSuccessfulRunCanBecomeCurrent(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        Test.startTest();FieldUsageSnapshotFinalizer.finish(run.Id,0,new List<String>());Test.stopTest();
        run=[SELECT Status__c,Is_Current__c,Dependency_Count__c FROM Field_Usage_Run__c WHERE Id=:run.Id];
        System.assertEquals('Completed',run.Status__c);System.assertEquals(true,run.Is_Current__c);System.assertEquals(0,run.Dependency_Count__c);
    }
}
