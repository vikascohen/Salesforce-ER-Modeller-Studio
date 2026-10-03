/**
 * Provides persisted diagnostic detail for Field Usage scan history.
 * Kept separate from FieldUsageController so operational diagnostics remain modular.
 */
public with sharing class FieldUsageErrorController {
    public class ErrorDetailDTO {
        @AuraEnabled public Id runId;
        @AuraEnabled public String status;
        @AuraEnabled public Integer errorCount;
        @AuraEnabled public String phase;
        @AuraEnabled public String errors;
        @AuraEnabled public String progressLog;
        @AuraEnabled public Integer objectsProcessed;
        @AuraEnabled public Integer objectsTotal;
    }

    @AuraEnabled(cacheable=true)
    public static ErrorDetailDTO getErrorDetail(Id runId) {
        if (runId == null) {
            throw new AuraHandledException('A scan run id is required.');
        }

        Field_Usage_Run__c run = [
            SELECT Id, Status__c, Error_Count__c, Progress_Phase__c,
                   Errors__c, Progress_Log__c, Objects_Processed__c, Objects_Total__c
            FROM Field_Usage_Run__c
            WHERE Id = :runId
            LIMIT 1
        ];

        ErrorDetailDTO dto = new ErrorDetailDTO();
        dto.runId = run.Id;
        dto.status = run.Status__c;
        dto.errorCount = run.Error_Count__c == null ? 0 : run.Error_Count__c.intValue();
        dto.phase = run.Progress_Phase__c;
        dto.errors = run.Errors__c;
        dto.progressLog = run.Progress_Log__c;
        dto.objectsProcessed = run.Objects_Processed__c == null ? 0 : run.Objects_Processed__c.intValue();
        dto.objectsTotal = run.Objects_Total__c == null ? 0 : run.Objects_Total__c.intValue();
        return dto;
    }
}