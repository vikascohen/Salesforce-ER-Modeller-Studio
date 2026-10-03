/** Discovers Tooling metadata and checkpoints durable Field Usage work units. @author Vikas Cohen */
public without sharing class FieldUsageToolingDiscoveryBatch implements Database.Batchable<String>, Database.AllowsCallouts {
    private static final Integer CHUNK_SIZE=12;
    private static final Integer FLOW_CHUNK_SIZE=4;
    private static final Integer VALIDATION_CHUNK_SIZE=20;
    private static final Integer LAYOUT_OBJECT_CHUNK_SIZE=1;
    @TestVisible private static Boolean suppressWorkerChainForTest=false;
    private final Id runId;
    public FieldUsageToolingDiscoveryBatch(Id runId){this.runId=runId;}

    public Iterable<String> start(Database.BatchableContext context){
        update new Field_Usage_Run__c(Id=runId,Status__c='Running',Heartbeat_At__c=System.now(),Job_Id__c=context==null?null:String.valueOf(context.getJobId()),Progress_Phase__c='Discovering Tooling metadata');
        return new List<String>{'ApexClass','ApexTrigger','Flow','LWC','Aura','ValidationRule','Layout'};
    }

    public void execute(Database.BatchableContext context,List<String> sourceTypes){
        List<Field_Usage_Work_Unit__c> allUnits=new List<Field_Usage_Work_Unit__c>();
        for(String sourceType:sourceTypes){
            if(sourceType=='Layout'){
                List<String> objects=new List<String>();
                for(String apiName:Schema.getGlobalDescribe().keySet()){
                    Schema.SObjectType typ=Schema.getGlobalDescribe().get(apiName);
                    if(typ==null)continue;
                    Schema.DescribeSObjectResult d=typ.getDescribe();
                    if(d.isAccessible()&&d.isLayoutable())objects.add(apiName);
                }
                objects.sort();
                for(Integer offset=0;offset<objects.size();offset+=LAYOUT_OBJECT_CHUNK_SIZE){
                    Integer chunkEnd=Math.min(offset+LAYOUT_OBJECT_CHUNK_SIZE,objects.size());
                    List<String> chunk=new List<String>();for(Integer i=offset;i<chunkEnd;i++)chunk.add(objects[i]);
                    allUnits.add(new Field_Usage_Work_Unit__c(Run__c=runId,Work_Key__c=String.valueOf(runId)+'|Layout Bulk|'+String.valueOf(offset/LAYOUT_OBJECT_CHUNK_SIZE),Scanner_Type__c='Layout Bulk',Target_Key__c=String.join(chunk,','),Status__c='Pending'));
                }
                continue;
            }
            List<String> ids=new List<String>(); String scannerType; Integer chunkSize=CHUNK_SIZE;
            if(sourceType=='LWC'||sourceType=='Aura'){
                List<FieldUsageUiToolingClient.UiComponent> components=sourceType=='LWC'?FieldUsageUiToolingClient.getLwcBundleIndex():FieldUsageUiToolingClient.getAuraBundleIndex();
                for(FieldUsageUiToolingClient.UiComponent c:components)ids.add(c.id);
                scannerType=sourceType=='LWC'?'LWC Bulk':'Aura Bulk';
            } else if(sourceType=='ValidationRule'){
                for(FieldUsageUiToolingClient.UiComponent c:FieldUsageUiToolingClient.getValidationRuleIndex())ids.add(c.id);
                scannerType='Validation Rule Bulk'; chunkSize=VALIDATION_CHUNK_SIZE;
            } else {
                List<FieldUsageToolingApiClient.SourceComponent> components=sourceType=='ApexClass'?FieldUsageToolingApiClient.getApexClassIndex():sourceType=='ApexTrigger'?FieldUsageToolingApiClient.getApexTriggerIndex():FieldUsageToolingApiClient.getFlowIndex();
                for(FieldUsageToolingApiClient.SourceComponent c:components)ids.add(c.id);
                scannerType=sourceType=='ApexClass'?'Apex Class Bulk':sourceType=='ApexTrigger'?'Apex Trigger Bulk':'Flow Bulk';
                if(sourceType=='Flow')chunkSize=FLOW_CHUNK_SIZE;
            }
            for(Integer offset=0;offset<ids.size();offset+=chunkSize){
                Integer chunkEnd=Math.min(offset+chunkSize,ids.size()); List<String> chunkIds=new List<String>();
                for(Integer i=offset;i<chunkEnd;i++)chunkIds.add(ids[i]);
                allUnits.add(new Field_Usage_Work_Unit__c(Run__c=runId,Work_Key__c=String.valueOf(runId)+'|'+scannerType+'|'+String.valueOf(offset/chunkSize),Scanner_Type__c=scannerType,Target_Key__c=String.join(chunkIds,','),Status__c='Pending'));
            }
        }
        if(!allUnits.isEmpty()){Database.SaveResult[] results=Database.insert(allUnits,false);for(Database.SaveResult result:results)if(!result.isSuccess())throw new FieldUsageToolingApiClient.ToolingApiException('Could not checkpoint bulk Tooling API discovery: '+result.getErrors()[0].getMessage());}
        update new Field_Usage_Run__c(Id=runId,Heartbeat_At__c=System.now(),Progress_Phase__c='Discovered Tooling and layout work');
    }

    public void finish(Database.BatchableContext context){
        AsyncApexJob discoveryJob=[SELECT NumberOfErrors FROM AsyncApexJob WHERE Id=:context.getJobId()];
        if(discoveryJob.NumberOfErrors>0){FieldUsageSnapshotFinalizer.finish(runId,Integer.valueOf(discoveryJob.NumberOfErrors),new List<String>{'Tooling discovery batch reported platform or callout errors.'});return;}
        Integer total=[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:runId];
        update new Field_Usage_Run__c(Id=runId,Objects_Total__c=total,Progress_Percent__c=5,Progress_Phase__c='Queued resumable work units');
        if(total==0){FieldUsageSnapshotFinalizer.finish(runId,0,new List<String>());return;}
        if(Test.isRunningTest()&&suppressWorkerChainForTest)return;
        Id workerJobId=Database.executeBatch(new FieldUsageWorkUnitBatch(runId),1);
        update new Field_Usage_Run__c(Id=runId,Job_Id__c=String.valueOf(workerJobId));
    }
}