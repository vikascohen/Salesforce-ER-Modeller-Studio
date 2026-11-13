/** Review only skips recorded by the originating manual scan. Scope size is one. */
public with sharing class FieldUsageReadRepairBatch implements Database.Batchable<String>, Database.Stateful, Database.AllowsCallouts {
    public static final String ACTIVE = 'Reviewing skipped Read permissions';
    private Id runId;
    @TestVisible private Integer changed = 0;
    private Integer limitsFound = 0;
    private Integer failures = 0;
    private List<String> details = new List<String>();

    public FieldUsageReadRepairBatch(Id runId) {
        this.runId = runId;
    }

    public static Boolean supportedEnvironment() {
        Organization org = [SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization LIMIT 1];
        return org.IsSandbox || org.OrganizationType == 'Developer Edition' ||
            (org.TrialExpirationDate != null && org.TrialExpirationDate > System.now());
    }

    public Iterable<String> start(Database.BatchableContext context) {
        List<String> pages = new List<String>();
        for (Field_Usage_Skip__c row : [SELECT Id, Entry_Count__c FROM Field_Usage_Skip__c WHERE Run__c = :runId]) {
            for (Integer pageStart = 0; pageStart < row.Entry_Count__c; pageStart += 100) {
                pages.add(row.Id + '/' + pageStart);
            }
        }
        return pages;
    }

    public void execute(Database.BatchableContext context, List<String> pages) {
        for (String page : pages) {
            List<String> parts = page.split('/');
            Id skipId = (Id) parts[0];
            Field_Usage_Skip__c row = [SELECT Object_Name__c, Entries__c FROM Field_Usage_Skip__c
                WHERE Id = :skipId AND Run__c = :runId];
            Map<String,String> recorded = FieldUsageSchemaAccess.unpack(row.Entries__c);
            List<String> keys = new List<String>(recorded.keySet());
            keys.sort();
            Set<String> candidates = new Set<String>();
            Integer first = Integer.valueOf(parts[1]);
            for (Integer i = first; i < Math.min(keys.size(), first + 100); i++) {
                if (recorded.get(keys[i]) == 'Read') candidates.add(keys[i].toLowerCase());
            }
            if (candidates.isEmpty()) continue;
            IndustryAccessController.ObjectReview review = IndustryAccessController.getObjectReview(row.Object_Name__c, runId);
            List<String> fields = new List<String>();
            for (IndustryAccessController.Item field : review.fields) {
                if (field.eligible && candidates.contains(field.name.toLowerCase())) fields.add(field.name);
            }
            if (fields.isEmpty() && !(review.objectOnlyAllowed && candidates.contains('*'))) continue;
            IndustryAccessController.UpdateResult result = IndustryAccessController.applyReadAccess(
                row.Object_Name__c, fields, review.needsObjectRead, runId);
            changed += result.addedPrerequisites.size();
            for (IndustryAccessController.Item item : result.results) {
                if (item.eligible) {
                    if (item.message == 'Read Access added.' || item.message == 'Object Read added.') changed++;
                } else {
                    if (isCoverageLimit(item.name, item.message)) limitsFound++;
                    else failures++;
                    if (details.size() < 40) details.add(item.name + ' — ' + item.message);
                }
            }
        }
    }

    @TestVisible private static Boolean isCoverageLimit(String name, String message) {
        if (String.isBlank(message)) return false;
        if (name.contains('.')) {
            return message.startsWithIgnoreCase('Cannot find Field ' + name + ' for SobjectType ') ||
                message.equalsIgnoreCase('Field Name: bad value for restricted picklist field: ' + name);
        }
        // Salesforce can return a required Read followed by a choice of Read prerequisites.
        // Leave that choice to the admin. Unknown or non-Read clauses still need attention.
        Boolean hasChoice = false;
        for (String clause : message.split(';')) {
            String part = clause.trim();
            if (Pattern.matches('(?i)Read on [A-Za-z0-9_]+ requires Read on at least one of these objects: [A-Za-z0-9_]+(, [A-Za-z0-9_]+)+', part)) {
                hasChoice = true;
            } else if (!Pattern.matches('(?i)Permission Read [A-Za-z0-9_]+ depends on permission\\(s\\): Read [A-Za-z0-9_]+(, Read [A-Za-z0-9_]+)*', part)) {
                return false;
            }
        }
        return hasChoice;
    }

    public void finish(Database.BatchableContext context) {
        AsyncApexJob job = [SELECT NumberOfErrors, ExtendedStatus FROM AsyncApexJob WHERE Id = :context.getJobId()];
        failures += job.NumberOfErrors;
        if (job.NumberOfErrors > 0) details.add('Repair batch errors: ' + job.NumberOfErrors + '. ' + String.valueOf(job.ExtendedStatus));
        completeReview();
    }

    @TestVisible private void completeReview() {
        String phase = failures > 0 ? 'Read repair needs attention' : 'Read access review complete';
        String summary = changed + ' Read grants added. ' + limitsFound + ' unavailable. ' + failures + ' repair errors.';
        if (changed > 0 && failures == 0) {
            try {
                Id verification = FieldUsageOrchestrator.startVerification(runId);
                summary += ' Verification scan ' + verification + '.';
                phase = 'Read repair complete; verification queued';
            } catch (Exception ex) {
                phase = 'Read repair needs attention';
                details.add('Verification could not start: ' + ex.getMessage());
            }
        }
        Field_Usage_Run__c parent = [SELECT Progress_Log__c FROM Field_Usage_Run__c WHERE Id = :runId FOR UPDATE];
        parent.Progress_Phase__c = phase;
        parent.Progress_Log__c = (summary + '\n' + String.join(details, '\n') + '\n' +
            (parent.Progress_Log__c == null ? '' : parent.Progress_Log__c)).left(32000);
        update parent;
        if (phase == 'Read repair needs attention') ErStudioDiagnosticService.error('Field Usage','Read repair',parent.Progress_Log__c.left(3000));
    }
}
