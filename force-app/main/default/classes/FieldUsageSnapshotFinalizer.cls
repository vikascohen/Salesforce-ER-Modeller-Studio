/**
 * @author Vikas Cohen
 */
public without sharing class FieldUsageSnapshotFinalizer {
 public static void finish(Id runId,Integer failures,List<String> errors){
  Savepoint sp=Database.setSavepoint();try{
   Field_Usage_Run__c run=[SELECT Id,Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:runId FOR UPDATE];
   Integer evidence=[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:runId];
   List<Field_Usage_Work_Unit__c> completedUnits=[SELECT Id FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId AND Status__c='Completed' LIMIT 9000];
   if(!completedUnits.isEmpty())delete completedUnits;
   Integer incomplete=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId];
   if(incomplete>failures)failures=incomplete;
   if(failures>0){
    run.Status__c='Completed With Errors';run.Is_Current__c=false;run.Error_Count__c=failures;run.Dependency_Count__c=evidence;run.Completed_At__c=System.now();run.Progress_Percent__c=100;run.Progress_Phase__c='Scan completed with errors';if(errors==null)errors=new List<String>();if(errors.isEmpty())errors.add(String.valueOf(failures)+' scan work item(s) did not complete successfully.');run.Errors__c=String.join(errors,'\n').left(32000);update run;
    List<Field_Usage_Evidence__c> partialEvidence=[SELECT Id FROM Field_Usage_Evidence__c WHERE Run__c=:runId LIMIT 9000];if(!partialEvidence.isEmpty())delete partialEvidence;
    List<Field_Usage_Work_Unit__c> failedUnits=[SELECT Id FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId LIMIT 9000];if(!failedUnits.isEmpty())delete failedUnits;
    return;
   }
   List<Field_Usage_Run__c> old=[SELECT Id,Is_Current__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Id!=:runId];for(Field_Usage_Run__c r:old)r.Is_Current__c=false;if(!old.isEmpty())update old;
   run.Status__c='Completed';run.Is_Current__c=true;run.Error_Count__c=0;run.Dependency_Count__c=evidence;run.Completed_At__c=System.now();run.Heartbeat_At__c=System.now();run.Progress_Percent__c=100;run.Progress_Phase__c='Snapshot ready';run.Errors__c=null;update run;
   // V4: successful snapshots must remain available for five-run change history.
   // A dedicated bounded retention batch will prune snapshots beyond the last ten.
   // Never delete evidence from inside the promotion transaction.
  }catch(Exception ex){Database.rollback(sp);try{update new Field_Usage_Run__c(Id=runId,Status__c='Failed',Is_Current__c=false,Completed_At__c=System.now(),Errors__c=(ex.getTypeName()+': '+ex.getMessage()).left(32000));}catch(Exception ignored){}}
 }
}