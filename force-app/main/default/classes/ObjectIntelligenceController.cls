/**
 * Read-only object metadata intelligence for Data Dictionary.
 * One object is loaded on demand. No DML, no SOQL-in-loop, no per-field callouts.
 * Tooling queries are object-scoped and return only the columns needed by the UI.
 * @author Vikas Cohen
 */
public without sharing class ObjectIntelligenceController {
    private static final String API_VERSION = 'v60.0';
    private static final String NAMED_CREDENTIAL = 'callout:Salesforce_Tooling_API';

    public class NamedItem {
        @AuraEnabled public String name;
        @AuraEnabled public Boolean active;
        public NamedItem(String name, Boolean active) { this.name = name; this.active = active; }
    }

    public class Result {
        @AuraEnabled public List<NamedItem> recordTypes = new List<NamedItem>();
        @AuraEnabled public List<NamedItem> layouts = new List<NamedItem>();
        @AuraEnabled public List<NamedItem> triggers = new List<NamedItem>();
        @AuraEnabled public List<NamedItem> validationRules = new List<NamedItem>();
        @AuraEnabled public List<NamedItem> flows = new List<NamedItem>();
        @AuraEnabled public Boolean toolingLoaded = false;
        @AuraEnabled public Boolean snapshotLoaded = false;
        @AuraEnabled public String toolingMessage;
    }

    @AuraEnabled(cacheable=true)
    public static Result getObjectIntelligence(String objectApiName) {
        Result result = new Result();
        if (String.isBlank(objectApiName)) return result;

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        Schema.SObjectType objectType = globalDescribe.get(objectApiName);
        if (objectType == null) return result;

        // Record Types are available from native Describe and require no callout.
        for (Schema.RecordTypeInfo info : objectType.getDescribe().getRecordTypeInfos()) {
            if (!info.isAvailable() || info.isMaster()) continue;
            result.recordTypes.add(new NamedItem(info.getName(), info.isActive()));
        }

        // Existing successful Field Usage snapshot is the authoritative source for
        // Flow evidence. One selective aggregate query; no rescanning on UI open.
        loadSnapshotAutomation(objectApiName, result);

        try {
            // Resolve the object once, then use its DurableId for object-scoped
            // Tooling queries. This avoids org-wide indexes and per-item requests.
            List<Map<String,Object>> entities = toolingQuery(
                'SELECT DurableId,QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName = \'" +
                String.escapeSingleQuotes(objectApiName) + "\' LIMIT 1"
            );
            if (entities.isEmpty()) {
                result.toolingMessage = 'Object metadata was not returned by Tooling API.';
                return result;
            }
            String durableId = stringValue(entities[0].get('DurableId'));
            String escapedDurableId = String.escapeSingleQuotes(durableId);

            for (Map<String,Object> row : toolingQuery(
                'SELECT Id,Name FROM Layout WHERE TableEnumOrId = \'" + escapedDurableId + "\' ORDER BY Name"
            )) result.layouts.add(new NamedItem(stringValue(row.get('Name')), true));

            for (Map<String,Object> row : toolingQuery(
                'SELECT Id,Name,Status FROM ApexTrigger WHERE TableEnumOrId = \'" + escapedDurableId + "\' ORDER BY Name"
            )) result.triggers.add(new NamedItem(
                stringValue(row.get('Name')),
                'Active'.equalsIgnoreCase(stringValue(row.get('Status')))
            ));

            for (Map<String,Object> row : toolingQuery(
                'SELECT Id,ValidationName,Active FROM ValidationRule WHERE EntityDefinitionId = \'" + escapedDurableId + "\' ORDER BY ValidationName"
            )) result.validationRules.add(new NamedItem(
                stringValue(row.get('ValidationName')),
                booleanValue(row.get('Active'))
            ));

            result.toolingLoaded = true;
        } catch (Exception ex) {
            // Native Describe and snapshot evidence remain useful even if the Named
            // Credential is unavailable. Do not turn a metadata enhancement into a
            // failure of the entire Data Dictionary screen.
            result.toolingMessage = ex.getMessage();
        }
        return result;
    }

    private static void loadSnapshotAutomation(String objectApiName, Result result) {
        if (!Schema.getGlobalDescribe().containsKey('Field_Usage_Evidence__c') ||
            !Schema.getGlobalDescribe().containsKey('Field_Usage_Run__c')) return;
        try {
            List<Field_Usage_Run__c> runs = [
                SELECT Id FROM Field_Usage_Run__c
                WHERE Is_Current__c = true AND Status__c IN ('Completed','Completed With Errors')
                ORDER BY Completed_At__c DESC NULLS LAST LIMIT 1
            ];
            if (runs.isEmpty()) return;
            Set<String> flowNames = new Set<String>();
            for (Field_Usage_Evidence__c evidence : [
                SELECT Component_Name__c
                FROM Field_Usage_Evidence__c
                WHERE Run__c = :runs[0].Id
                  AND Object_API_Name__c = :objectApiName
                  AND Source_Type__c = 'Flow'
                LIMIT 2000
            ]) if (!String.isBlank(evidence.Component_Name__c)) flowNames.add(evidence.Component_Name__c);
            List<String> ordered = new List<String>(flowNames);
            ordered.sort();
            for (String name : ordered) result.flows.add(new NamedItem(name, true));
            result.snapshotLoaded = true;
        } catch (Exception ignored) {
            // Snapshot is optional; absence must not block metadata intelligence.
        }
    }

    private static List<Map<String,Object>> toolingQuery(String soql) {
        List<Map<String,Object>> out = new List<Map<String,Object>>();
        String nextUrl = '/services/data/' + API_VERSION + '/tooling/query/?q=' + EncodingUtil.urlEncode(soql, 'UTF-8');
        Integer pages = 0;
        while (nextUrl != null && pages++ < 10) {
            HttpRequest request = new HttpRequest();
            request.setEndpoint(NAMED_CREDENTIAL + nextUrl);
            request.setMethod('GET');
            request.setHeader('Accept', 'application/json');
            request.setTimeout(20000);
            HttpResponse response = new Http().send(request);
            if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
                throw new ObjectIntelligenceException('Tooling API HTTP ' + response.getStatusCode());
            }
            Map<String,Object> payload = (Map<String,Object>)JSON.deserializeUntyped(response.getBody());
            List<Object> records = payload.get('records') instanceof List<Object>
                ? (List<Object>)payload.get('records') : new List<Object>();
            for (Object raw : records) out.add((Map<String,Object>)raw);
            nextUrl = stringValue(payload.get('nextRecordsUrl'));
        }
        return out;
    }

    private static String stringValue(Object value) { return value == null ? null : String.valueOf(value); }
    private static Boolean booleanValue(Object value) { return value != null && Boolean.valueOf(String.valueOf(value)); }
    public class ObjectIntelligenceException extends Exception {}
}