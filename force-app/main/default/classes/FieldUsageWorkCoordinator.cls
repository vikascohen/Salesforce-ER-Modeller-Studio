public without sharing class FieldUsageWorkCoordinator {
 public static Id start(Id runId){
  update new Field_Usage_Run__c(Id=runId,Status__c='Running',Started_At__c=System.now(),Heartbeat_At__c=System.now(),Progress_Percent__c=1,Progress_Phase__c='Discovering scan work');
  List<Field_Usage_Work_Unit__c> units=new List<Field_Usage_Work_Unit__c>();Map<String,Schema.SObjectType> gd=Schema.getGlobalDescribe();
  for(String apiName:gd.keySet()){Schema.DescribeSObjectResult d=gd.get(apiName).getDescribe();if(d.isAccessible()&&d.isQueryable()&&FieldUsageSnapshotBatch.hasCalculatedField(d.fields.getMap()))units.add(new Field_Usage_Work_Unit__c(Run__c=runId,Work_Key__c=String.valueOf(runId)+'|Formula|'+apiName,Scanner_Type__c='Formula',Target_Key__c=apiName,Status__c='Pending'));}
  if(!units.isEmpty()){for(Integer i=0;i<units.size();i+=500){Integer stop=Math.min(i+500,units.size());Database.insert(units.subList(i,stop),false);}}
  update new Field_Usage_Run__c(Id=runId,Objects_Total__c=units.size(),Progress_Phase__c='Queued resumable work units');
  if(units.isEmpty()){FieldUsageSnapshotFinalizer.finish(runId,0,new List<String>());return null;}
  return Database.executeBatch(new FieldUsageWorkUnitBatch(runId),1);
 }
}