/**
 * @author Vikas Cohen
 */
public without sharing class FieldUsageFormulaScanner {
    private static final Pattern TOKEN_PATTERN=Pattern.compile('[A-Za-z_][A-Za-z0-9_]*');
    private static final Pattern QUALIFIED_PATTERN=Pattern.compile('(?i)\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*([A-Za-z_][A-Za-z0-9_]*)\\b');

    public static List<Field_Usage_Evidence__c> scan(Id runId,String objectName) {
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectName);if(typ==null)return out;
        for(Schema.SObjectField field:typ.getDescribe().fields.getMap().values())out.addAll(scanField(runId,objectName,field.getDescribe().getName()));return out;
    }

    public static List<Field_Usage_Evidence__c> scanField(Id runId,String objectName,String formulaField){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectName);if(typ==null)return out;
        Map<String,Schema.SObjectField> fields=typ.getDescribe().fields.getMap();Schema.SObjectField formulaFieldToken=fields.get(formulaField);if(formulaFieldToken==null)return out;
        String canonicalFormulaField=formulaFieldToken.getDescribe().getName();String formula=formulaFieldToken.getDescribe().getCalculatedFormula();if(String.isBlank(formula))return out;
        return analyseFormula(runId,objectName,canonicalFormulaField,formula,fields);
    }

    @TestVisible private static List<Field_Usage_Evidence__c> analyseFormula(Id runId,String objectName,String formulaField,String formula,Map<String,Schema.SObjectField> fields){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();if(String.isBlank(formula)||fields==null)return out;
        Map<String,String> canonical=new Map<String,String>();for(String name:fields.keySet())canonical.put(name.toLowerCase(),fields.get(name).getDescribe().getName());
        Map<String,Integer> localCounts=tokenCounts(removeQualifiedReferences(formula));
        for(String lowerName:localCounts.keySet()){String candidate=canonical.get(lowerName);if(candidate==null||candidate.equalsIgnoreCase(formulaField))continue;out.add(evidence(runId,objectName,candidate,objectName,formulaField,formula,localCounts.get(lowerName)));}

        Map<String,String> targets=relationshipTargets(fields);Map<String,Integer> qualifiedCounts=new Map<String,Integer>();Matcher matcher=QUALIFIED_PATTERN.matcher(formula);
        while(matcher.find()){
            String targetObject=targets.get(matcher.group(1).toLowerCase());if(String.isBlank(targetObject))continue;
            Schema.SObjectType targetType=Schema.getGlobalDescribe().get(targetObject);if(targetType==null)continue;
            String referencedField=matcher.group(2);Schema.SObjectField targetField=targetType.getDescribe().fields.getMap().get(referencedField);if(targetField==null)continue;String canonicalField=targetField.getDescribe().getName();
            String key=targetObject+'|'+canonicalField;qualifiedCounts.put(key,(qualifiedCounts.containsKey(key)?qualifiedCounts.get(key):0)+1);
        }
        for(String key:qualifiedCounts.keySet()){List<String> parts=key.split('\\|');out.add(evidence(runId,parts[0],parts[1],objectName,formulaField,formula,qualifiedCounts.get(key)));}
        return out;
    }

    private static Field_Usage_Evidence__c evidence(Id runId,String referencedObject,String referencedField,String ownerObject,String formulaField,String formula,Integer occurrences){
        return new Field_Usage_Evidence__c(Run__c=runId,Field_Key__c=referencedObject+'.'+referencedField,Object_API_Name__c=referencedObject,Field_API_Name__c=referencedField,Source_Type__c='Formula Field',Component_Name__c=ownerObject+'.'+formulaField,Evidence_Type__c='Formula Reference',Evidence__c=formula.left(32000),Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=occurrences,Location__c=ownerObject+'.'+formulaField);
    }

    @TestVisible private static Map<String,String> relationshipTargets(Map<String,Schema.SObjectField> fields){Map<String,String> out=new Map<String,String>();for(Schema.SObjectField field:fields.values()){Schema.DescribeFieldResult d=field.getDescribe();if(d.getType()!=Schema.DisplayType.Reference||String.isBlank(d.getRelationshipName()))continue;List<Schema.SObjectType> targets=d.getReferenceTo();if(targets!=null&&targets.size()==1)out.put(d.getRelationshipName().toLowerCase(),targets[0].getDescribe().getName());}return out;}
    @TestVisible private static Map<String,Integer> tokenCounts(String source){Map<String,Integer> counts=new Map<String,Integer>();Matcher m=TOKEN_PATTERN.matcher(source);while(m.find()){String k=m.group(0).toLowerCase();counts.put(k,(counts.containsKey(k)?counts.get(k):0)+1);}return counts;}
    @TestVisible private static String removeQualifiedReferences(String formula){return String.isBlank(formula)?formula:formula.replaceAll('(?i)\\b[A-Za-z_][A-Za-z0-9_]*\\s*\\.\\s*[A-Za-z_][A-Za-z0-9_]*\\b',' ');}
    @TestVisible private static Integer countToken(String source,String token){Integer n=tokenCounts(source).get(token.toLowerCase());return n==null?0:n;}
    @TestVisible private static Boolean containsToken(String source,String token){return countToken(source,token)>0;}
}