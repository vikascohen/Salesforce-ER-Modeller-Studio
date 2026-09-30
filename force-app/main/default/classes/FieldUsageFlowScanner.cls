/**
 * Extracts provable Salesforce field references from Flow Metadata JSON.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageFlowScanner {
    private static Map<String,Schema.SObjectType> globalDescribe;
    public static List<Field_Usage_Evidence__c> scan(Id runId,String flowName,String flowId,Object metadata){
        globalDescribe=Schema.getGlobalDescribe();
        Map<String,Integer> counts=new Map<String,Integer>();
        Map<String,Set<String>> locations=new Map<String,Set<String>>();
        walk(metadata,counts,locations,'Flow',null);
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        for(String key:counts.keySet()){
            List<String> parts=key.split('\\.');
            if(parts.size()!=2)continue;
            out.add(new Field_Usage_Evidence__c(
                Run__c=runId,Field_Key__c=key,Object_API_Name__c=parts[0],Field_API_Name__c=parts[1],
                Source_Type__c='Flow',Component_Name__c=flowName,Component_Id__c=flowId,
                Evidence_Type__c='Flow Metadata',Confidence__c='High',Observed_At__c=System.now(),
                Occurrence_Count__c=counts.get(key),Location__c='Flow metadata',
                Evidence__c=formatLocations(locations.get(key))
            ));
        }
        return out;
    }
    private static void walk(Object node,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context){
        if(node==null)return;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            String localContext=firstString(m,new List<String>{'label','name','developerName'});
            if(String.isBlank(localContext))localContext=context;
            detectPair(m,counts,locations,path,localContext);
            for(String key:m.keySet())walk(m.get(key),counts,locations,path+'.'+key,localContext);
        }else if(node instanceof List<Object>){
            Integer i=0;for(Object v:(List<Object>)node){walk(v,counts,locations,path+'['+i+']',context);i++;}
        }else if(node instanceof String){
            detectQualified((String)node,counts,locations,path,context);
        }
    }
    private static void detectPair(Map<String,Object> m,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context){
        String objectName=firstString(m,new List<String>{'object','objectName','sObjectType','recordObject'});
        String fieldName=firstString(m,new List<String>{'field','fieldName','fieldApiName'});
        addIfValid(objectName,fieldName,counts,locations,flowLocation(path,context));
    }
    private static String firstString(Map<String,Object> m,List<String> keys){
        for(String key:keys)if(m.containsKey(key)&&m.get(key) instanceof String)return (String)m.get(key);
        return null;
    }
    private static void detectQualified(String value,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context){
        if(String.isBlank(value)||value.length()>500)return;
        Matcher matcher=Pattern.compile('\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b').matcher(value);
        while(matcher.find())addIfValid(matcher.group(1),matcher.group(2),counts,locations,flowLocation(path,context));
    }
    private static String flowLocation(String path,String context){
        String leaf=String.isBlank(path)?'Flow metadata':path;
        return String.isBlank(context)?leaf:context+' · '+leaf;
    }
    private static String formatLocations(Set<String> values){
        if(values==null||values.isEmpty())return null;
        List<String> ordered=new List<String>(values);ordered.sort();
        List<String> lines=new List<String>();Integer max=Math.min(ordered.size(),12);
        for(Integer i=0;i<max;i++)lines.add('Flow · '+ordered[i]);
        if(ordered.size()>max)lines.add('… '+(ordered.size()-max)+' more locations');
        return String.join(lines,'\n');
    }
    private static void addIfValid(String objectName,String fieldName,Map<String,Integer> counts,Map<String,Set<String>> locations,String location){
        if(String.isBlank(objectName)||String.isBlank(fieldName))return;
        if(globalDescribe==null)globalDescribe=Schema.getGlobalDescribe();
        if(!globalDescribe.containsKey(objectName))return;
        Map<String,Schema.SObjectField> fields=globalDescribe.get(objectName).getDescribe().fields.getMap();
        if(!fields.containsKey(fieldName))return;
        String canonicalObject=globalDescribe.get(objectName).getDescribe().getName();
        String canonicalField=fields.get(fieldName).getDescribe().getName();
        String key=canonicalObject+'.'+canonicalField;
        counts.put(key,(counts.containsKey(key)?counts.get(key):0)+1);
        if(!locations.containsKey(key))locations.put(key,new Set<String>());
        if(!String.isBlank(location))locations.get(key).add(location);
    }
}
