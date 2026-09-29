/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageControllerTest {
 @IsTest static void readsCurrentSnapshotOnly(){
  Field_Usage_Run__c oldRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=false);insert oldRun;
  Field_Usage_Run__c currentRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Progress_Percent__c=100,Progress_Phase__c='Snapshot ready');insert currentRun;
  insert new List<Field_Usage_Evidence__c>{
   new Field_Usage_Evidence__c(Run__c=oldRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Formula Field',Component_Name__c='Old',Occurrence_Count__c=1),
   new Field_Usage_Evidence__c(Run__c=currentRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Formula Field',Component_Name__c='Current',Occurrence_Count__c=2,Location__c='Account.Test__c')
  };
  List<Field_Usage_Evidence__c> rows=FieldUsageController.getEvidence('Account',new List<String>{'Name'});
  System.assertEquals(1,rows.size());System.assertEquals('Current',rows[0].Component_Name__c);System.assertEquals(2,rows[0].Occurrence_Count__c);
  System.assertNotEquals(null,FieldUsageController.getStatus().run);
  FieldUsageController.SnapshotDTO snapshot=FieldUsageController.getSnapshotAvailability();System.assertEquals(true,snapshot.available);
  System.assertEquals(new List<String>{'Account'},FieldUsageController.getSnapshotObjects());
  System.assertEquals(new List<String>{'Name'},FieldUsageController.getSnapshotFields('Account'));
  System.assertEquals(1,FieldUsageController.searchEvidence('Current','Formula Field',50).size());
  System.assertEquals(new List<String>{'Formula Field'},FieldUsageController.getSourceTypes());
 }
 @IsTest static void sparseSnapshotTreatsSchemaFieldWithoutEvidenceAsNoDependency(){
  Field_Usage_Run__c currentRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Progress_Percent__c=100,Progress_Phase__c='Snapshot ready');insert currentRun;
  insert new Field_Usage_Evidence__c(Run__c=currentRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='AccountService',Occurrence_Count__c=1);

  List<String> schemaFields=FieldUsageController.getFields('Account');
  System.assert(schemaFields.contains('Industry'),'Industry must remain selectable from schema even when sparse snapshot has no evidence row.');

  List<Field_Usage_Evidence__c> noDependency=FieldUsageController.getEvidence('Account',new List<String>{'Industry'});
  System.assertEquals(0,noDependency.size(),'A schema field with no persisted evidence must return zero dependencies.');

  System.assertEquals(new List<String>{'Account'},FieldUsageController.getSnapshotObjects());
  System.assertEquals(new List<String>{'Name'},FieldUsageController.getSnapshotFields('Account'),'Persisted snapshot catalogue must contain only fields with detected evidence.');
 }
 @IsTest static void validatesUnknownObject(){try{FieldUsageController.getFields('Missing__c');System.assert(false);}catch(AuraHandledException e){System.assert(true);}}
}