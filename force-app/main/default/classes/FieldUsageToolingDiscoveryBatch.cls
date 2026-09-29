/**
 * Discovers Apex classes and triggers through Tooling API and checkpoints them
 * as durable Field Usage work units.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageToolingDiscoveryBatch
    implements Database.Batchable<String>, Database.AllowsCallouts {

    private final Id runId;

    public FieldUsageToolingDiscoveryBatch(Id runId) {
        this.runId = runId;
    }

    public Iterable<String> start(Database.BatchableContext context) {
        return new List<String>{ 'ApexClass', 'ApexTrigger' };
    }

    public void execute(Database.BatchableContext context, List<String> sourceTypes) {
        for (String sourceType : sourceTypes) {
            List<FieldUsageToolingApiClient.SourceComponent> components =
                sourceType == 'ApexClass'
                    ? FieldUsageToolingApiClient.getApexClasses()
                    : FieldUsageToolingApiClient.getApexTriggers();

            List<Field_Usage_Work_Unit__c> units = new List<Field_Usage_Work_Unit__c>();
            for (FieldUsageToolingApiClient.SourceComponent component : components) {
                String scannerType =
                    sourceType == 'ApexClass' ? 'Apex Class' : 'Apex Trigger';

                units.add(new Field_Usage_Work_Unit__c(
                    Run__c = runId,
                    Work_Key__c =
                        String.valueOf(runId) + '|' + scannerType + '|' + component.id,
                    Scanner_Type__c = scannerType,
                    Target_Key__c = component.id + '|' + component.name,
                    Status__c = 'Pending'
                ));
            }

            if (!units.isEmpty()) {
                Database.SaveResult[] results = Database.insert(units, false);
                for (Database.SaveResult result : results) {
                    if (!result.isSuccess()) {
                        throw new FieldUsageToolingApiClient.ToolingApiException(
                            'Could not checkpoint Tooling API discovery: ' +
                            result.getErrors()[0].getMessage()
                        );
                    }
                }
            }
        }

        update new Field_Usage_Run__c(
            Id = runId,
            Heartbeat_At__c = System.now(),
            Progress_Phase__c = 'Discovered Apex classes and triggers'
        );
    }

    public void finish(Database.BatchableContext context) {
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

        Id workerJobId = Database.executeBatch(new FieldUsageWorkUnitBatch(runId), 1);
        update new Field_Usage_Run__c(
            Id = runId,
            Job_Id__c = String.valueOf(workerJobId)
        );
    }
}
