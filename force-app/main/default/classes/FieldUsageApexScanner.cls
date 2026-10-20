/**
 * Scans Apex source returned by the Tooling API for Salesforce field references.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageApexScanner {
    // Scan identifier tokens with deterministic character walks, not whole-source regex.
    private class SourceToken {
        String value; Integer start;
        SourceToken(String v,Integer s){value=v;start=s;}
    }
    private static List<SourceToken> tokenize(String source){
        List<SourceToken> tokens=new List<SourceToken>();
        Integer i=0,n=source.length();
        while(i<n){
            String ch=source.substring(i,i+1);
            if(isIdentifierStart(ch)){
                Integer start=i++;while(i<n&&isIdentifierChar(source.substring(i,i+1)))i++;
                tokens.add(new SourceToken(source.substring(start,i),start));
            }else if(ch=='.'){tokens.add(new SourceToken('.',i));i++;}
            else i++;
        }
        return tokens;
    }
    private static Boolean isIdentifierStart(String ch){
        if(String.isBlank(ch))return false;
        Integer c=ch.charAt(0);return (c>=65&&c<=90)||(c>=97&&c<=122)||c==95;
    }
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
        Map<String,String> objectNames=new Map<String,String>();
        // Resolve each identifier once: global describe iteration is expensive in package test orgs.
        Map<String,Map<String,String>> fieldNames=new Map<String,Map<String,String>>();
        List<Integer> lineStarts=new List<Integer>{0};
        for(Integer i=0;i<body.length();i++)if(body.substring(i,i+1)=='\n')lineStarts.add(i+1);
        Map<String, Integer> occurrences = new Map<String, Integer>();
        Map<String, List<Integer>> linesByKey = new Map<String, List<Integer>>();
        Map<String, Set<String>> usageTypesByKey = new Map<String, Set<String>>();
        String cleanedBody=stripCommentsAndStrings(body);
        List<SourceToken> tokens=tokenize(cleanedBody);
        Map<String,String> variableTypes=new Map<String,String>();
        // Discover typed local variables before resolving their field references.
        for(Integer i=0;i+1<tokens.size();i++){
            SourceToken typeToken=tokens[i],nameToken=tokens[i+1];
            if(!isIdentifierStart(nameToken.value))continue;
            String objectName=cachedObjectName(globalDescribe,objectNames,typeToken.value);
            if(objectName!=null)variableTypes.put(nameToken.value.toLowerCase(),objectName);
        }
        for(Integer i=0;i+2<tokens.size();i++){
            SourceToken lhs=tokens[i],dot=tokens[i+1],rhs=tokens[i+2];
            if(dot.value!='.'||!isIdentifierStart(rhs.value))continue;
            // Do not bridge whitespace or operators when matching a qualified reference.
            if(dot.start!=lhs.start+lhs.value.length()||rhs.start!=dot.start+1)continue;
            String objectName=cachedObjectName(globalDescribe,objectNames,lhs.value);
            Boolean typed=false;
            if(objectName==null){objectName=variableTypes.get(lhs.value.toLowerCase());typed=objectName!=null;}
            if(objectName==null)continue;
            Map<String,String> fields=fieldsFor(objectName,globalDescribe,fieldNames);
            String fieldName=cachedFieldName(objectName,rhs.value,globalDescribe,fieldNames);
            if(fieldName==null)continue;
            String key=objectName+'.'+fieldName;
            occurrences.put(key,(occurrences.containsKey(key)?occurrences.get(key):0)+1);
            rememberLine(linesByKey,key,lineNumber(lineStarts,lhs.start));
            rememberUsage(usageTypesByKey,key,typed?classifyVariableUsage(cleanedBody,lhs.start,rhs.start+rhs.value.length()):'Field reference');
        }
        for(SourceToken token:tokens){
            if(!token.value.equalsIgnoreCase('SELECT'))continue;
            Integer selectEnd=token.start+token.value.length();
            Integer maxEnd=Math.min(cleanedBody.length(),selectEnd+12000),boundary=maxEnd;
            for(String stop:new List<String>{';','{','}','[',']'}){
                Integer pos=cleanedBody.indexOf(stop,selectEnd);
                if(pos>=0&&pos<boundary)boundary=pos;
            }
            String clause=cleanedBody.substring(selectEnd,boundary);
            Integer fromAt=clause.toUpperCase().indexOf(' FROM ');
            if(fromAt<0)continue;
            String afterFrom=clause.substring(fromAt+6).trim();
            if(String.isBlank(afterFrom))continue;
            Integer nameEnd=0;
            while(nameEnd<afterFrom.length()&&isIdentifierChar(afterFrom.substring(nameEnd,nameEnd+1)))nameEnd++;
            if(nameEnd==0)continue;
            String objectName=cachedObjectName(globalDescribe,objectNames,afterFrom.substring(0,nameEnd));
            if(objectName==null)continue;
            Map<String,String> fields=fieldsFor(objectName,globalDescribe,fieldNames);
            for(String expression:clause.substring(0,fromAt).split(',')){
                String candidate=expression.trim();
                if(candidate.contains(' '))candidate=candidate.substringBefore(' ');
                if(candidate.contains('.'))candidate=candidate.substringBefore('.');
                String fieldName=cachedFieldName(objectName,candidate,globalDescribe,fieldNames);
                if(fieldName==null)continue;
                String key=objectName+'.'+fieldName;
                occurrences.put(key,(occurrences.containsKey(key)?occurrences.get(key):0)+1);
                rememberLine(linesByKey,key,lineNumber(lineStarts,token.start));
                rememberUsage(usageTypesByKey,key,'SOQL SELECT');
            }
        }

        List<String> sourceLines=body.split('\\n',-1);
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
                Evidence__c = buildEvidence(sourceLines, linesByKey.get(fieldKey), usageTypesByKey.get(fieldKey))
            ));
        }

        return evidence;
    }

    private static Boolean isIdentifierChar(String ch) {
        if (String.isBlank(ch)) return false;
        Integer c = ch.charAt(0);
        return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c == 95;
    }
    private static Integer lineNumber(List<Integer> starts,Integer offset){
        Integer lo=0,hi=starts.size()-1;
        while(lo<=hi){Integer mid=(lo+hi)/2;if(starts[mid]<=offset)lo=mid+1;else hi=mid-1;}
        return hi+1;
    }
    private static String cachedObjectName(Map<String,Schema.SObjectType> describe,Map<String,String> cache,String candidate){
        String key=candidate.toLowerCase();
        if(cache.containsKey(key))return cache.get(key);
        String found=canonicalObjectName(describe,candidate);
        cache.put(key,found);
        return found;
    }
    private static String cachedFieldName(String objectName,String candidate,Map<String,Schema.SObjectType> describe,Map<String,Map<String,String>> cache){
        if(!cache.containsKey(objectName))cache.put(objectName,new Map<String,String>());
        Map<String,String> fields=cache.get(objectName);String key=candidate.toLowerCase();
        if(fields.containsKey(key))return fields.get(key);
        String found=canonicalFieldName(describe.get(objectName).getDescribe().fields.getMap(),candidate);
        fields.put(key,found);
        return found;
    }
    private static Map<String,String> fieldsFor(String objectName,Map<String,Schema.SObjectType> describe,Map<String,Map<String,String>> cache){
        if(!cache.containsKey(objectName)){
            Map<String,String> fields=new Map<String,String>();
            for(String name:describe.get(objectName).getDescribe().fields.getMap().keySet())
                fields.put(name.toLowerCase(),describe.get(objectName).getDescribe().fields.getMap().get(name).getDescribe().getName());
            cache.put(objectName,fields);
        }
        return cache.get(objectName);
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
    private static String classifyVariableUsage(String source,Integer start,Integer endOffset){
        Integer lineStart=source.lastIndexOf('\n',Math.max(0,start-1))+1;Integer lineEnd=source.indexOf('\n',endOffset);if(lineEnd<0)lineEnd=source.length();String line=source.substring(lineStart,lineEnd);
        Integer localStart=start-lineStart,localEnd=endOffset-lineStart;String before=line.substring(0,Math.max(0,localStart)),after=line.substring(Math.min(line.length(),localEnd));
        if(after.trim().startsWith('='))return 'Assignment';if(before.toUpperCase().contains('WHERE '))return 'SOQL WHERE';return 'Expression';
    }
    // Avoid nested-quantifier method-signature regex on long source lines.
    private static String enclosingMethod(List<String> lines,Integer lineNumber){
        for (Integer i = Math.min(lineNumber - 1, lines.size() - 1); i >= 0; i--) {
            String line = lines[i].trim();
            Integer paren = line.indexOf('(');
            if (paren < 0 || line.indexOf(')', paren) < 0) continue;
            String prefix = line.substring(0, paren).trim();
            Integer space = prefix.lastIndexOf(' ');
            if (space < 0) continue;
            String candidate = prefix.substring(space + 1);
            if (String.isBlank(candidate) || !isIdentifierChar(candidate.substring(0, 1))) continue;
            if (new Set<String>{'if','for','while','switch','catch','return','new'}.contains(candidate.toLowerCase())) continue;
            return candidate;
        }
        return null;
    }
    private static String buildEvidence(List<String> sourceLines,List<Integer> lines,Set<String> usageTypes){
        if(lines==null||lines.isEmpty())return null;
        List<String> snippets=new List<String>();
        Integer max=Math.min(8,lines.size());
        for(Integer i=0;i<max;i++){Integer n=lines[i];if(n>0&&n<=sourceLines.size()){String method=enclosingMethod(sourceLines,n);snippets.add('Line '+n+(String.isBlank(method)?'':' · '+method+'()')+': '+sourceLines[n-1].trim());}}
        if(lines.size()>max)snippets.add('… '+(lines.size()-max)+' more occurrence line(s)');
        String types=usageTypes==null||usageTypes.isEmpty()?'':('Usage: '+String.join(new List<String>(usageTypes),', ')+'\n');
        return (types+String.join(snippets,'\n')).left(32000);
    }

    // Linear lexical masking avoids regex engine limits on large Apex sources.
    // Preserve offsets and line breaks so evidence locations remain accurate.
    @TestVisible
    private static String stripCommentsAndStrings(String source) {
        List<String> output = new List<String>();
        Integer state = 0; // 0 code, 1 line comment, 2 block comment, 3 string
        Integer length = source.length();
        for (Integer i = 0; i < length; i++) {
            String ch = source.substring(i, i + 1);
            String next = i + 1 < length ? source.substring(i + 1, i + 2) : '';
            if (state == 0) {
                if (ch == '/' && next == '/') { output.add(' '); output.add(' '); i++; state = 1; }
                else if (ch == '/' && next == '*') { output.add(' '); output.add(' '); i++; state = 2; }
                else if (ch == '\'') { output.add(' '); state = 3; }
                else output.add(ch);
            } else if (state == 1) {
                if (ch == '\n') { output.add(ch); state = 0; }
                else output.add(' ');
            } else if (state == 2) {
                if (ch == '*' && next == '/') { output.add(' '); output.add(' '); i++; state = 0; }
                else output.add(ch == '\n' ? ch : ' ');
            } else {
                if (ch == '\\' && i + 1 < length) { output.add(' '); output.add(next == '\n' ? next : ' '); i++; }
                else if (ch == '\'') { output.add(' '); state = 0; }
                else output.add(ch == '\n' ? ch : ' ');
            }
        }
        return String.join(output, '');
    }

    private static String canonicalObjectName(
        Map<String, Schema.SObjectType> globalDescribe,
        String candidate
    ) {
        // Schema.getGlobalDescribe() supports case-insensitive map lookup.
        // Iterating all object names per source token exhausts CPU in large orgs.
        Schema.SObjectType matched = globalDescribe.get(candidate);
        return matched == null ? null : matched.getDescribe().getName();
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
