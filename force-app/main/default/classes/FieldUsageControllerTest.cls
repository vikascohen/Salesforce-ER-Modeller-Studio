/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageControllerTest {
 @IsTest static void readsCurrentSnapshotOnly(){
  Field_Usage_Run__c oldRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=false);insert oldRun;
  Field_Usage_Run__c currentRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Progress_Percent__c=100,Progress_Phase__c='Snapshot ready');insert currentRun;
  insert new List<Field_Usage_Evidence__c>{
   new Field_Usage_Evidence__c(Run__c=oldRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Formula Field',Component_Name__c='Old',Occurrence_Count__c=1),
   new Field_Usage_Evidence__c(Run__c=currentRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Formula Field',Component_Name__c='Current',Occurrence_Count__c=2,Location__c='Account.Test__c'),
   new Field_Usage_Evidence__c(Run__c=currentRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='AccountService',Occurrence_Count__c=3,Location__c='line 10')
  };
  List<Field_Usage_Evidence__c> rows=FieldUsageController.getEvidence('Account',new List<String>{'Name'});
  System.assertEquals(2,rows.size());System.assertEquals(new Set<String>{'Current','AccountService'},new Set<String>{rows[0].Component_Name__c,rows[1].Component_Name__c});
  System.assertNotEquals(null,FieldUsageController.getStatus(null).run);
  FieldUsageController.SnapshotDTO snapshot=FieldUsageController.getSnapshotAvailability();System.assertEquals(true,snapshot.available);
  System.assert(FieldUsageController.getSnapshotObjects().contains('Account'));
  System.assert(FieldUsageController.getSnapshotFields('Account').contains('Name'));
  List<FieldUsageController.EvidenceSummaryDTO> summary=FieldUsageController.getEvidenceSummary('Account',new List<String>{'Name','Industry'});
  System.assertEquals(2,summary.size());System.assertEquals('Name',summary[0].fieldApiName);System.assertEquals('Apex Class',summary[0].sourceType);System.assertEquals(1,summary[0].evidenceRows);System.assertEquals(3,summary[0].occurrences);
  FieldUsageController.EvidenceDetailPageDTO detail=FieldUsageController.getEvidenceDetail('Account','Name','Apex Class',500,null);
  System.assertEquals(1,detail.rows.size());System.assertEquals('AccountService',detail.rows[0].componentName);System.assertEquals(false,detail.hasMore);System.assertEquals(detail.rows[0].id,detail.nextCursor);
  FieldUsageController.EvidenceDetailPageDTO afterLast=FieldUsageController.getEvidenceDetail('Account','Name','Apex Class',500,detail.nextCursor);System.assertEquals(0,afterLast.rows.size());
  System.assertEquals(0,FieldUsageController.getEvidenceDetail('Account','Industry','Apex Class',500,null).rows.size());
  System.assertEquals(1,FieldUsageController.searchEvidence('Current','Formula Field',50).size());
  System.assertEquals(new List<String>{'Apex Class','Apex Trigger','Flow','Formula Field'},FieldUsageController.getSourceTypes());
 }
 @IsTest static void sparseSnapshotTreatsSchemaFieldWithoutEvidenceAsNoDependency(){
  Field_Usage_Run__c currentRun=new Field_Usage_Run__c(Status__c='Completed',Is_Current__c=true,Progress_Percent__c=100,Progress_Phase__c='Snapshot ready');insert currentRun;
  insert new Field_Usage_Evidence__c(Run__c=currentRun.Id,Field_Key__c='Account.Name',Object_API_Name__c='Account',Field_API_Name__c='Name',Source_Type__c='Apex Class',Component_Name__c='AccountService',Occurrence_Count__c=1);

  List<String> schemaFields=FieldUsageController.getFields('Account');
  String zeroEvidenceField=null;for(String fieldName:schemaFields)if(fieldName!='Name'){zeroEvidenceField=fieldName;break;}
  System.assertNotEquals(null,zeroEvidenceField,'Account must expose at least one schema field other than Name for this sparse-model test.');

  List<Field_Usage_Evidence__c> noDependency=FieldUsageController.getEvidence('Account',new List<String>{zeroEvidenceField});
  System.assertEquals(0,noDependency.size(),'A schema field with no persisted evidence must return zero dependencies.');

  System.assert(FieldUsageController.getSnapshotObjects().contains('Account'));
  System.assert(FieldUsageController.getSnapshotFields('Account').contains(zeroEvidenceField),'Snapshot selectors use schema and must retain zero-dependency fields.');
 }
 @IsTest static void statusCanBePinnedToExactRun(){
  Field_Usage_Run__c older=new Field_Usage_Run__c(Status__c='Running',Progress_Percent__c=25,Progress_Phase__c='Older run');insert older;
  Field_Usage_Run__c newer=new Field_Usage_Run__c(Status__c='Completed',Progress_Percent__c=100,Progress_Phase__c='Newer run');insert newer;
  FieldUsageController.StatusDTO pinned=FieldUsageController.getStatus(older.Id);
  System.assertEquals(older.Id,pinned.run.Id,'Polling by run id must stay attached to the launched scan.');
  System.assertEquals('Running',pinned.run.Status__c);
  FieldUsageController.StatusDTO latest=FieldUsageController.getStatus(null);
  System.assertNotEquals(null,latest.run,'Unpinned callers should still receive a run.');
  System.assert(new Set<Id>{older.Id,newer.Id}.contains(latest.run.Id),'Unpinned status must return one of the runs created in this test; CreatedDate ties are not ordered deterministically inside one test transaction.');
 }
 @IsTest static void unpinnedStatusPrefersActiveRunOverTerminalHistory(){
  Field_Usage_Run__c active=new Field_Usage_Run__c(Status__c='Running',Progress_Percent__c=1,Progress_Phase__c='Discovering scan work');insert active;
  Field_Usage_Run__c terminal=new Field_Usage_Run__c(Status__c='Completed',Progress_Percent__c=100,Progress_Phase__c='Snapshot ready');insert terminal;
  FieldUsageController.StatusDTO status=FieldUsageController.getStatus(null);
  System.assertEquals(active.Id,status.run.Id,'Opening the live console must attach to an active run rather than terminal history.');
  System.assertEquals('Running',status.run.Status__c);
 }
 @IsTest static void validatesUnknownObject(){try{FieldUsageController.getFields('Missing__c');System.assert(false);}catch(AuraHandledException e){System.assert(true);}}
}