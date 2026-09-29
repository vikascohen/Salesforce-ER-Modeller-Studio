/**
 * Discovers Apex classes and triggers through Tooling API and checkpoints them
 * as durable Field Usage work units.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageToolingDiscoveryBatch
    implements Database.Batchable<String>, Database.AllowsCallouts {

    // 12 x 18-character Salesforce IDs plus commas stays within Target_Key__c (255).
    private static final Integer CHUNK_SIZE = 12;
    @TestVisible private static Boolean suppressWorkerChainForTest = false;

    private final Id runId;

    public FieldUsageToolingDiscoveryBatch(Id runId) {
        this.runId = runId;
    }

    public Iterable<String> start(Database.BatchableContext context) {
        return new List<String>{ 'ApexClass', 'ApexTrigger', 'Flow' };
    }

    public void execute(Database.BatchableContext context, List<String> sourceTypes) {
        List<Field_Usage_Work_Unit__c> allUnits = new List<Field_Usage_Work_Unit__c>();
        for (String sourceType : sourceTypes) {
            List<FieldUsageToolingApiClient.SourceComponent> components =
                sourceType == 'ApexClass'
                    ? FieldUsageToolingApiClient.getApexClassIndex()
                    : sourceType == 'ApexTrigger'
                        ? FieldUsageToolingApiClient.getApexTriggerIndex()
                        : FieldUsageToolingApiClient.getFlowIndex();

            String scannerType =
                sourceType == 'ApexClass' ? 'Apex Class Bulk' :
                sourceType == 'ApexTrigger' ? 'Apex Trigger Bulk' : 'Flow Bulk';

            List<Field_Usage_Work_Unit__c> units = new List<Field_Usage_Work_Unit__c>();
            Integer chunkSize = sourceType == 'Flow' ? 1 : CHUNK_SIZE;
            for (Integer offset = 0; offset < components.size(); offset += chunkSize) {
                Integer chunkEnd = Math.min(offset + chunkSize, components.size());
                List<String> componentIds = new List<String>();
                List<String> componentNames = new List<String>();

                for (Integer index = offset; index < chunkEnd; index++) {
                    componentIds.add(components[index].id);
                    componentNames.add(components[index].name);
                }

                units.add(new Field_Usage_Work_Unit__c(
                    Run__c = runId,
                    Work_Key__c =
                        String.valueOf(runId) + '|' + scannerType + '|' +
                        String.valueOf(offset / chunkSize),
                    Scanner_Type__c = scannerType,
                    Target_Key__c = String.join(componentIds, ','),
                    Status__c = 'Pending'
                ));
            }

            allUnits.addAll(units);
        }

        // All Tooling callouts must finish before the first DML in this transaction.
        if (!allUnits.isEmpty()) {
            Database.SaveResult[] results = Database.insert(allUnits, false);
            for (Database.SaveResult result : results) {
                if (!result.isSuccess()) {
                    throw new FieldUsageToolingApiClient.ToolingApiException(
                        'Could not checkpoint bulk Tooling API discovery: ' +
                        result.getErrors()[0].getMessage()
                    );
                }
            }
        }

        update new Field_Usage_Run__c(
            Id = runId,
            Heartbeat_At__c = System.now(),
            Progress_Phase__c = 'Discovered Apex, Trigger and Flow work'
        );
    }

    public void finish(Database.BatchableContext context) {
        AsyncApexJob discoveryJob=[SELECT NumberOfErrors FROM AsyncApexJob WHERE Id=:context.getJobId()];
        if(discoveryJob.NumberOfErrors>0){
            FieldUsageSnapshotFinalizer.finish(runId,Integer.valueOf(discoveryJob.NumberOfErrors),new List<String>{'Tooling discovery batch reported platform or callout errors.'});
            return;
        }
        Integer total = [
            SELECT COUNT()
            FROM Field_Usage_Work_Unit__c
            WHERE Run__c = :runId
        ];

        update new Field_Usage_Run__c(
            Id = runId,
            Objects_Total__c = total,
            Progress_Percent__c = 5,
            Progress_Phase__c = 'Queued resumable work units'
        );

        if (total == 0) {
            FieldUsageSnapshotFinalizer.finish(runId, 0, new List<String>());
            return;
        }

        if(Test.isRunningTest() && suppressWorkerChainForTest) return;
        Id workerJobId = Database.executeBatch(new FieldUsageWorkUnitBatch(runId), 1);
        update new Field_Usage_Run__c(
            Id = runId,
            Job_Id__c = String.valueOf(workerJobId)
        );
    }
}
