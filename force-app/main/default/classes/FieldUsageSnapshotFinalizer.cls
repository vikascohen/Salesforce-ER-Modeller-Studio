/**
 * @author Vikas Cohen
 */
public without sharing class FieldUsageSnapshotFinalizer {
 public static void finish(Id runId,Integer failures,List<String> errors){
  Savepoint sp=Database.setSavepoint();try{
   Field_Usage_Run__c run=[SELECT Id,Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:runId FOR UPDATE];
   Integer evidence=[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:runId];
   if(failures>0){run.Status__c='Completed With Errors';run.Is_Current__c=false;run.Error_Count__c=failures;run.Dependency_Count__c=evidence;run.Completed_At__c=System.now();run.Progress_Percent__c=100;run.Progress_Phase__c='Scan completed with errors';run.Errors__c=String.join(errors,'\n');update run;return;}
   List<Field_Usage_Run__c> old=[SELECT Id,Is_Current__c FROM Field_Usage_Run__c WHERE Is_Current__c=true AND Id!=:runId];for(Field_Usage_Run__c r:old)r.Is_Current__c=false;if(!old.isEmpty())update old;
   run.Status__c='Completed';run.Is_Current__c=true;run.Error_Count__c=0;run.Dependency_Count__c=evidence;run.Completed_At__c=System.now();run.Heartbeat_At__c=System.now();run.Progress_Percent__c=100;run.Progress_Phase__c='Snapshot ready';run.Errors__c=null;update run;
  }catch(Exception ex){Database.rollback(sp);try{update new Field_Usage_Run__c(Id=runId,Status__c='Failed',Is_Current__c=false,Completed_At__c=System.now(),Errors__c=(ex.getTypeName()+': '+ex.getMessage()).left(32000));}catch(Exception ignored){}}
 }
}