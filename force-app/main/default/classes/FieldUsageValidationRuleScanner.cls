/**
 * Extracts same-object field dependencies from Validation Rule formulas.
 * Metadata retrieval is handled separately and in bulk by FieldUsageUiToolingClient.
 * @author Vikas Cohen
 */
public without sharing class FieldUsageValidationRuleScanner {
    private static final Pattern TOKEN_PATTERN=Pattern.compile('[A-Za-z_][A-Za-z0-9_]*');
    public static List<Field_Usage_Evidence__c> scan(Id runId,String objectName,String ruleName,String ruleId,String formula,Boolean active){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();if(String.isBlank(objectName)||String.isBlank(formula))return out;
        Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectName);if(typ==null)return out;Map<String,Schema.SObjectField> fields=typ.getDescribe().fields.getMap();Map<String,String> canonical=new Map<String,String>();for(String name:fields.keySet())canonical.put(name.toLowerCase(),fields.get(name).getDescribe().getName());
        Map<String,Integer> counts=new Map<String,Integer>();Matcher m=TOKEN_PATTERN.matcher(formula);while(m.find()){String token=m.group(0).toLowerCase();if(canonical.containsKey(token))counts.put(token,(counts.containsKey(token)?counts.get(token):0)+1);}
        for(String token:counts.keySet()){String fieldName=canonical.get(token);out.add(new Field_Usage_Evidence__c(Run__c=runId,Field_Key__c=objectName+'.'+fieldName,Object_API_Name__c=objectName,Field_API_Name__c=fieldName,Source_Type__c='Validation Rule',Component_Name__c=String.isBlank(ruleName)?ruleId:ruleName,Evidence_Type__c=active==false?'Inactive Validation Rule Reference':'Validation Rule Reference',Evidence__c=formula.left(32000),Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=counts.get(token),Location__c=objectName+'.'+(String.isBlank(ruleName)?ruleId:ruleName)));
        }return out;
    }
}
