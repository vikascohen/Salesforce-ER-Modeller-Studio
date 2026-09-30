/**
 * Scans Apex source returned by the Tooling API for Salesforce field references.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageApexScanner {
    @TestVisible
    private static final Pattern QUALIFIED_FIELD_PATTERN =
        Pattern.compile('(?i)\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b');
    private static final Pattern VARIABLE_DECLARATION_PATTERN =
        Pattern.compile('(?i)\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\s+([A-Za-z_][A-Za-z0-9_]*)\\b');
    private static final Pattern SOQL_PATTERN =
        Pattern.compile('(?is)\\bSELECT\\s+(.+?)\\s+FROM\\s+([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\b');

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
        Map<String, List<Integer>> linesByKey = new Map<String, List<Integer>>();
        Map<String, Set<String>> usageTypesByKey = new Map<String, Set<String>>();
        String cleanedBody=stripCommentsAndStrings(body);
        Matcher matcher = QUALIFIED_FIELD_PATTERN.matcher(cleanedBody);

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
            occurrences.put(key,(occurrences.containsKey(key)?occurrences.get(key):0)+1);
            rememberLine(linesByKey,key,lineNumber(cleanedBody,matcher.start()));rememberUsage(usageTypesByKey,key,'Field reference');
        }

        Map<String,String> variableTypes=new Map<String,String>();
        Matcher declarations=VARIABLE_DECLARATION_PATTERN.matcher(cleanedBody);
        while(declarations.find()){
            String objectName=canonicalObjectName(globalDescribe,declarations.group(1));
            if(objectName!=null)variableTypes.put(declarations.group(2).toLowerCase(),objectName);
        }
        for(String variableName:variableTypes.keySet()){
            String objectName=variableTypes.get(variableName);
            Matcher variableReference=Pattern.compile('(?i)\\b'+variableName+'\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b').matcher(cleanedBody);
            Map<String,Schema.SObjectField> fields=globalDescribe.get(objectName).getDescribe().fields.getMap();
            while(variableReference.find()){
                String fieldName=canonicalFieldName(fields,variableReference.group(1));if(fieldName==null)continue;
                String key=objectName+'.'+fieldName;occurrences.put(key,(occurrences.containsKey(key)?occurrences.get(key):0)+1);rememberLine(linesByKey,key,lineNumber(cleanedBody,soql.start()));rememberUsage(usageTypesByKey,key,'SOQL SELECT');rememberLine(linesByKey,key,lineNumber(cleanedBody,variableReference.start()));rememberUsage(usageTypesByKey,key,classifyVariableUsage(cleanedBody,variableReference.start(),variableReference.end()));
            }
        }
        Matcher soql=SOQL_PATTERN.matcher(cleanedBody);
        while(soql.find()){
            String objectName=canonicalObjectName(globalDescribe,soql.group(2));if(objectName==null)continue;
            Map<String,Schema.SObjectField> fields=globalDescribe.get(objectName).getDescribe().fields.getMap();
            for(String expression:soql.group(1).split(',')){
                String candidate=expression.trim();
                if(candidate.contains(' '))candidate=candidate.substringBefore(' ');
                if(candidate.contains('.'))candidate=candidate.substringBefore('.');
                String fieldName=canonicalFieldName(fields,candidate);if(fieldName==null)continue;
                String key=objectName+'.'+fieldName;occurrences.put(key,(occurrences.containsKey(key)?occurrences.get(key):0)+1);
            }
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
                Location__c = sourceType + ': ' + componentName + formatLines(linesByKey.get(fieldKey)),
                Evidence__c = buildEvidence(body, linesByKey.get(fieldKey), usageTypesByKey.get(fieldKey))
            ));
        }

        return evidence;
    }

    private static Integer lineNumber(String source,Integer offset){
        Integer line=1;for(Integer i=0;i<offset&&i<source.length();i++)if(source.substring(i,i+1)=='\n')line++;return line;
    }
    private static void rememberLine(Map<String,List<Integer>> byKey,String key,Integer line){
        if(!byKey.containsKey(key))byKey.put(key,new List<Integer>());
        if(!byKey.get(key).contains(line))byKey.get(key).add(line);
    }
    private static String formatLines(List<Integer> lines){
        if(lines==null||lines.isEmpty())return '';
        List<String> values=new List<String>();for(Integer n:lines)values.add(String.valueOf(n));
        return ' · line'+(lines.size()>1?'s ':' ')+String.join(values,', ');
    }
    private static void rememberUsage(Map<String,Set<String>> byKey,String key,String usage){if(!byKey.containsKey(key))byKey.put(key,new Set<String>());byKey.get(key).add(usage);}
    private static String classifyVariableUsage(String source,Integer start,Integer end){
        Integer lineStart=source.lastIndexOf('\n',Math.max(0,start-1))+1;Integer lineEnd=source.indexOf('\n',end);if(lineEnd<0)lineEnd=source.length();String line=source.substring(lineStart,lineEnd);
        Integer localStart=start-lineStart,localEnd=end-lineStart;String before=line.substring(0,Math.max(0,localStart)),after=line.substring(Math.min(line.length(),localEnd));
        if(after.trim().startsWith('='))return 'Assignment';if(before.toUpperCase().contains('WHERE '))return 'SOQL WHERE';return 'Expression';
    }
    private static String enclosingMethod(String body,Integer lineNumber){
        List<String> ls=body.split('\\n',-1);Pattern p=Pattern.compile('(?i)(?:public|private|protected|global|static|virtual|override|testmethod|webservice|final|transient|\\s)+[A-Za-z0-9_<>,\\[\\].?]+\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\([^;]*\\)\\s*\\{?');
        for(Integer i=Math.min(lineNumber-1,ls.size()-1);i>=0;i--){Matcher m=p.matcher(ls[i]);if(m.find())return m.group(1);}return null;
    }
    private static String buildEvidence(String body,List<Integer> lines,Set<String> usageTypes){
        if(String.isBlank(body)||lines==null||lines.isEmpty())return null;
        List<String> sourceLines=body.split('\\n',-1),snippets=new List<String>();
        Integer max=Math.min(8,lines.size());
        for(Integer i=0;i<max;i++){Integer n=lines[i];if(n>0&&n<=sourceLines.size()){String method=enclosingMethod(body,n);snippets.add('Line '+n+(String.isBlank(method)?'':' · '+method+'()')+': '+sourceLines[n-1].trim());}}
        if(lines.size()>max)snippets.add('… '+(lines.size()-max)+' more occurrence line(s)');
        String types=usageTypes==null||usageTypes.isEmpty()?'':('Usage: '+String.join(new List<String>(usageTypes),', ')+'\n');
        return (types+String.join(snippets,'\n')).left(32000);
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
                return globalDescribe.get(name).getDescribe().getName();
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
                return fields.get(name).getDescribe().getName();
            }
        }
        return null;
    }
}
