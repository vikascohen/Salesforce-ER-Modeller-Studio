/**
 * Scans Apex source returned by the Tooling API for Salesforce field references.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageApexScanner {
    @TestVisible
    private static final Pattern QUALIFIED_FIELD_PATTERN =
        Pattern.compile('(?i)\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b');

    public static List<Field_Usage_Evidence__c> scan(
        Id runId,
        String sourceType,
        String componentName,
        String componentId,
        String body
    ) {
        List<Field_Usage_Evidence__c> evidence = new List<Field_Usage_Evidence__c>();
        if (String.isBlank(body)) {
            return evidence;
        }

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        Map<String, Integer> occurrences = new Map<String, Integer>();
        Matcher matcher = QUALIFIED_FIELD_PATTERN.matcher(stripCommentsAndStrings(body));

        while (matcher.find()) {
            String objectName = canonicalObjectName(globalDescribe, matcher.group(1));
            if (objectName == null) {
                continue;
            }

            Map<String, Schema.SObjectField> fields =
                globalDescribe.get(objectName).getDescribe().fields.getMap();
            String fieldName = canonicalFieldName(fields, matcher.group(2));
            if (fieldName == null) {
                continue;
            }

            String key = objectName + '.' + fieldName;
            occurrences.put(
                key,
                (occurrences.containsKey(key) ? occurrences.get(key) : 0) + 1
            );
        }

        for (String fieldKey : occurrences.keySet()) {
            Integer separator = fieldKey.indexOf('.');
            String objectName = fieldKey.substring(0, separator);
            String fieldName = fieldKey.substring(separator + 1);

            evidence.add(new Field_Usage_Evidence__c(
                Run__c = runId,
                Field_Key__c = fieldKey,
                Object_API_Name__c = objectName,
                Field_API_Name__c = fieldName,
                Source_Type__c = sourceType,
                Component_Name__c = componentName,
                Component_Id__c = componentId,
                Evidence_Type__c = 'Apex Source Reference',
                Confidence__c = 'High',
                Observed_At__c = System.now(),
                Occurrence_Count__c = occurrences.get(fieldKey),
                Location__c = sourceType + ': ' + componentName
            ));
        }

        return evidence;
    }

    @TestVisible
    private static String stripCommentsAndStrings(String source) {
        String cleaned = source.replaceAll('(?s)/\\*.*?\\*/', ' ');
        cleaned = cleaned.replaceAll('(?m)//.*$', ' ');
        cleaned = cleaned.replaceAll('(?s)\'(?:\\\\.|[^\'])*\'', '\'\'');
        return cleaned;
    }

    private static String canonicalObjectName(
        Map<String, Schema.SObjectType> globalDescribe,
        String candidate
    ) {
        for (String name : globalDescribe.keySet()) {
            if (name.equalsIgnoreCase(candidate)) {
                return name;
            }
        }
        return null;
    }

    private static String canonicalFieldName(
        Map<String, Schema.SObjectField> fields,
        String candidate
    ) {
        for (String name : fields.keySet()) {
            if (name.equalsIgnoreCase(candidate)) {
                return name;
            }
        }
        return null;
    }
}
