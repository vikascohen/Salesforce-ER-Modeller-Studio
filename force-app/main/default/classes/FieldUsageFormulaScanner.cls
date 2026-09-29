/**
 * @author Vikas Cohen
 */
public without sharing class FieldUsageFormulaScanner {
    private static final Pattern TOKEN_PATTERN=Pattern.compile('[A-Za-z_][A-Za-z0-9_]*');
    public static List<Field_Usage_Evidence__c> scan(Id runId,String objectName) {
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>(); Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectName); if(typ==null)return out;
        Map<String,Schema.SObjectField> fields=typ.getDescribe().fields.getMap(); Map<String,String> canonical=new Map<String,String>();
        for(String name:fields.keySet()) canonical.put(name.toLowerCase(),name);
        for(String formulaField:fields.keySet()) out.addAll(scanField(runId,objectName,formulaField)); return out;
    }
    public static List<Field_Usage_Evidence__c> scanField(Id runId,String objectName,String formulaField){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectName);if(typ==null)return out;Map<String,Schema.SObjectField> fields=typ.getDescribe().fields.getMap();if(!fields.containsKey(formulaField))return out;
        String formula=fields.get(formulaField).getDescribe().getCalculatedFormula();if(String.isBlank(formula))return out;Map<String,String> canonical=new Map<String,String>();for(String name:fields.keySet())canonical.put(name.toLowerCase(),name);
        String sameObjectFormula=formula.replaceAll('(?i)\\b[A-Za-z_][A-Za-z0-9_]*\\s*\\.\\s*[A-Za-z_][A-Za-z0-9_]*\\b',' ');
        Map<String,Integer> counts=tokenCounts(sameObjectFormula);for(String lowerName:counts.keySet()){String candidate=canonical.get(lowerName);if(candidate==null||candidate.equalsIgnoreCase(formulaField))continue;out.add(new Field_Usage_Evidence__c(Run__c=runId,Field_Key__c=objectName+'.'+candidate,Object_API_Name__c=objectName,Field_API_Name__c=candidate,Source_Type__c='Formula Field',Component_Name__c=formulaField,Evidence_Type__c='Formula Reference',Evidence__c=formula.left(32000),Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=counts.get(lowerName),Location__c=objectName+'.'+formulaField));}return out;
    }
    @TestVisible private static Map<String,Integer> tokenCounts(String source){Map<String,Integer> counts=new Map<String,Integer>();Matcher m=TOKEN_PATTERN.matcher(source);while(m.find()){String k=m.group(0).toLowerCase();counts.put(k,(counts.containsKey(k)?counts.get(k):0)+1);}return counts;}
    @TestVisible private static Integer countToken(String source,String token){Integer n=tokenCounts(source).get(token.toLowerCase());return n==null?0:n;}
    @TestVisible private static Boolean containsToken(String source,String token){return countToken(source,token)>0;}
}