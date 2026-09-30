/**
 * Extracts provable Salesforce field references from Flow Metadata JSON.
 * Supports explicit Object.Field references, record-triggered $Record.Field
 * references, and Flow record variables whose object type is declared elsewhere
 * in the metadata.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageFlowScanner {
    private static Map<String,Schema.SObjectType> globalDescribe;

    public static List<Field_Usage_Evidence__c> scan(Id runId,String flowName,String flowId,Object metadata){
        globalDescribe=Schema.getGlobalDescribe();
        Map<String,Integer> counts=new Map<String,Integer>();
        Map<String,Set<String>> locations=new Map<String,Set<String>>();
        Map<String,String> variableObjects=new Map<String,String>();
        String rootObject=discoverFlowContext(metadata,variableObjects);
        walk(metadata,counts,locations,'Flow',null,rootObject,variableObjects);
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        for(String key:counts.keySet()){
            List<String> parts=key.split('\\.');
            if(parts.size()!=2)continue;
            out.add(new Field_Usage_Evidence__c(
                Run__c=runId,Field_Key__c=key,Object_API_Name__c=parts[0],Field_API_Name__c=parts[1],
                Source_Type__c='Flow',Component_Name__c=flowName,Component_Id__c=flowId,
                Evidence_Type__c='Flow Metadata',Confidence__c='High',Observed_At__c=System.now(),
                Occurrence_Count__c=counts.get(key),Location__c='Flow metadata',Evidence__c=formatLocations(locations.get(key))
            ));
        }
        return out;
    }

    private static String discoverFlowContext(Object node,Map<String,String> variableObjects){
        // For record-triggered flows the authoritative root object lives on the
        // start element. Resolve that first instead of requiring every object
        // mentioned anywhere in the flow to be the same object.
        String startObject=findStartObject(node);
        Set<String> rootCandidates=new Set<String>();
        discover(node,variableObjects,rootCandidates,false);
        if(!String.isBlank(startObject))return startObject;
        if(rootCandidates.size()==1)return new List<String>(rootCandidates)[0];
        return null;
    }

    private static String findStartObject(Object node){
        if(node==null)return null;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            if(m.containsKey('start') && m.get('start') instanceof Map<String,Object>){
                Map<String,Object> start=(Map<String,Object>)m.get('start');
                String objectName=firstString(start,new List<String>{'object','objectName','sObjectType','recordObject','objectType'});
                if(isObject(objectName))return canonicalObject(objectName);
            }
            // Some API versions/callout serialisations can wrap the start node.
            String nodeName=firstString(m,new List<String>{'name','developerName'});
            if(nodeName=='start' || nodeName=='Start'){
                String objectName=firstString(m,new List<String>{'object','objectName','sObjectType','recordObject','objectType'});
                if(isObject(objectName))return canonicalObject(objectName);
            }
            for(String key:m.keySet()){
                String found=findStartObject(m.get(key));
                if(!String.isBlank(found))return found;
            }
        }else if(node instanceof List<Object>){
            for(Object child:(List<Object>)node){
                String found=findStartObject(child);
                if(!String.isBlank(found))return found;
            }
        }
        return null;
    }

    private static void discover(Object node,Map<String,String> variableObjects,Set<String> rootCandidates,Boolean insideVariable){
        if(node==null)return;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            String name=firstString(m,new List<String>{'name','developerName'});
            String objectName=firstString(m,new List<String>{'object','objectName','sObjectType','recordObject','objectType'});
            if(isObject(objectName)){
                if(!String.isBlank(name))variableObjects.put(name,canonicalObject(objectName));
                if(!insideVariable)rootCandidates.add(canonicalObject(objectName));
            }
            for(String key:m.keySet()){
                Boolean childVariable=insideVariable||key=='variables'||key=='recordVariables';
                discover(m.get(key),variableObjects,rootCandidates,childVariable);
            }
        }else if(node instanceof List<Object>){
            for(Object v:(List<Object>)node)discover(v,variableObjects,rootCandidates,insideVariable);
        }
    }

    private static void walk(Object node,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context,String rootObject,Map<String,String> variableObjects){
        if(node==null)return;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            String localContext=firstString(m,new List<String>{'label','name','developerName'});
            if(String.isBlank(localContext))localContext=context;
            detectPair(m,counts,locations,path,localContext);
            for(String key:m.keySet())walk(m.get(key),counts,locations,path+'.'+key,localContext,rootObject,variableObjects);
        }else if(node instanceof List<Object>){
            Integer i=0;for(Object v:(List<Object>)node){walk(v,counts,locations,path+'['+i+']',context,rootObject,variableObjects);i++;}
        }else if(node instanceof String){
            detectReferences((String)node,counts,locations,path,context,rootObject,variableObjects);
        }
    }

    private static void detectPair(Map<String,Object> m,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context){
        String objectName=firstString(m,new List<String>{'object','objectName','sObjectType','recordObject','objectType'});
        String fieldName=firstString(m,new List<String>{'field','fieldName','fieldApiName'});
        addIfValid(objectName,fieldName,counts,locations,flowLocation(path,context));
    }

    private static String firstString(Map<String,Object> m,List<String> keys){
        for(String key:keys)if(m.containsKey(key)&&m.get(key) instanceof String)return (String)m.get(key);
        return null;
    }

    private static void detectReferences(String value,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context,String rootObject,Map<String,String> variableObjects){
        if(String.isBlank(value)||value.length()>2000)return;
        String location=flowLocation(path,context);

        Matcher qualified=Pattern.compile('\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b').matcher(value);
        while(qualified.find())addIfValid(qualified.group(1),qualified.group(2),counts,locations,location);

        if(!String.isBlank(rootObject)){
            Matcher recordRef=Pattern.compile('(?:\\{!)?\\$Record\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)').matcher(value);
            while(recordRef.find())addIfValid(rootObject,recordRef.group(1),counts,locations,location+' · $Record.'+recordRef.group(1));
        }

        Matcher variableRef=Pattern.compile('(?:\\{!)?([A-Za-z_][A-Za-z0-9_]*)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)').matcher(value);
        while(variableRef.find()){
            String variableName=variableRef.group(1);
            if(variableObjects.containsKey(variableName))addIfValid(variableObjects.get(variableName),variableRef.group(2),counts,locations,location+' · '+variableName+'.'+variableRef.group(2));
        }
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

    private static Boolean isObject(String objectName){return !String.isBlank(objectName)&&globalDescribe!=null&&globalDescribe.containsKey(objectName);}
    private static String canonicalObject(String objectName){return isObject(objectName)?globalDescribe.get(objectName).getDescribe().getName():objectName;}

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
