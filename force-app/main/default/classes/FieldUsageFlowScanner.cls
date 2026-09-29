/**
 * Extracts provable Salesforce field references from Flow Metadata JSON.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageFlowScanner {
    public static List<Field_Usage_Evidence__c> scan(Id runId,String flowName,String flowId,Object metadata){
        Map<String,Integer> counts=new Map<String,Integer>();
        walk(metadata,counts);
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        for(String key:counts.keySet()){
            List<String> parts=key.split('\\.');
            if(parts.size()!=2)continue;
            out.add(new Field_Usage_Evidence__c(
                Run__c=runId,Field_Key__c=key,Object_API_Name__c=parts[0],Field_API_Name__c=parts[1],
                Source_Type__c='Flow',Component_Name__c=flowName,Component_Id__c=flowId,
                Evidence_Type__c='Flow Metadata',Confidence__c='High',Observed_At__c=System.now(),
                Occurrence_Count__c=counts.get(key),Location__c='Flow metadata'
            ));
        }
        return out;
    }
    private static void walk(Object node,Map<String,Integer> counts){
        if(node==null)return;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            detectPair(m,counts);
            for(Object v:m.values())walk(v,counts);
        }else if(node instanceof List<Object>){
            for(Object v:(List<Object>)node)walk(v,counts);
        }else if(node instanceof String){
            detectQualified((String)node,counts);
        }
    }
    private static void detectPair(Map<String,Object> m,Map<String,Integer> counts){
        String objectName=firstString(m,new List<String>{'object','objectName','sObjectType','recordObject'});
        String fieldName=firstString(m,new List<String>{'field','fieldName','fieldApiName'});
        addIfValid(objectName,fieldName,counts);
    }
    private static String firstString(Map<String,Object> m,List<String> keys){
        for(String key:keys)if(m.containsKey(key)&&m.get(key) instanceof String)return (String)m.get(key);
        return null;
    }
    private static void detectQualified(String value,Map<String,Integer> counts){
        if(String.isBlank(value)||value.length()>500)return;
        Matcher matcher=Pattern.compile('\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b').matcher(value);
        while(matcher.find())addIfValid(matcher.group(1),matcher.group(2),counts);
    }
    private static void addIfValid(String objectName,String fieldName,Map<String,Integer> counts){
        if(String.isBlank(objectName)||String.isBlank(fieldName))return;
        Map<String,Schema.SObjectType> gd=Schema.getGlobalDescribe();
        if(!gd.containsKey(objectName))return;
        Map<String,Schema.SObjectField> fields=gd.get(objectName).getDescribe().fields.getMap();
        if(!fields.containsKey(fieldName))return;
        String canonicalObject=gd.get(objectName).getDescribe().getName();
        String canonicalField=fields.get(fieldName).getDescribe().getName();
        String key=canonicalObject+'.'+canonicalField;
        counts.put(key,(counts.containsKey(key)?counts.get(key):0)+1);
    }
}
