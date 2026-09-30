/**
 * Generic Flow metadata field-usage extractor.
 * Resolves record symbols first, then recursively interprets Flow metadata.
 * It intentionally does not branch on Flow process type: record-triggered,
 * autolaunched, screen, scheduled and event-triggered flows share the same
 * evidence engine when their metadata exposes resolvable object/field context.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageFlowScanner {
    private static Map<String,Schema.SObjectType> globalDescribe;
    private static final Set<String> OBJECT_KEYS=new Set<String>{'object','objectName','sObjectType','recordObject','objectType'};
    private static final Set<String> FIELD_KEYS=new Set<String>{'field','fieldName','fieldApiName','queriedField','displayField','valueField','sortField','objectFieldReference'};
    private static final Set<String> REFERENCE_KEYS=new Set<String>{'inputReference','recordReference','targetReference','assignToReference','elementReference'};

    public static List<Field_Usage_Evidence__c> scan(Id runId,String flowName,String flowId,Object metadata){
        globalDescribe=Schema.getGlobalDescribe();
        Map<String,Integer> counts=new Map<String,Integer>();
        Map<String,Set<String>> locations=new Map<String,Set<String>>();
        Map<String,String> symbols=new Map<String,String>();
        String rootObject=findStartObject(metadata);
        if(!String.isBlank(rootObject)){
            symbols.put('$Record',rootObject);
            symbols.put('$Record__Prior',rootObject);
        }
        discoverSymbols(metadata,symbols);
        walk(metadata,counts,locations,'Flow',null,rootObject,rootObject,symbols);

        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        for(String key:counts.keySet()){
            Integer dot=key.indexOf('.'); if(dot<=0)continue;
            String objectName=key.substring(0,dot), fieldName=key.substring(dot+1);
            out.add(new Field_Usage_Evidence__c(
                Run__c=runId,Field_Key__c=key,Object_API_Name__c=objectName,Field_API_Name__c=fieldName,
                Source_Type__c='Flow',Component_Name__c=flowName,Component_Id__c=flowId,
                Evidence_Type__c='Flow Metadata',Confidence__c='High',Observed_At__c=System.now(),
                Occurrence_Count__c=counts.get(key),Location__c='Flow metadata',Evidence__c=formatLocations(locations.get(key))
            ));
        }
        return out;
    }

    private static String findStartObject(Object node){
        if(node==null)return null;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            if(m.containsKey('start') && m.get('start') instanceof Map<String,Object>){
                String o=objectFrom((Map<String,Object>)m.get('start')); if(isObject(o))return canonicalObject(o);
            }
            for(String key:m.keySet()){String found=findStartObject(m.get(key));if(!String.isBlank(found))return found;}
        }else if(node instanceof List<Object>){for(Object child:(List<Object>)node){String found=findStartObject(child);if(!String.isBlank(found))return found;}}
        return null;
    }

    private static void discoverSymbols(Object node,Map<String,String> symbols){
        if(node==null)return;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            String name=firstString(m,new List<String>{'name','developerName'});
            String objectName=objectFrom(m);
            if(!String.isBlank(name)&&isObject(objectName))symbols.put(name,canonicalObject(objectName));
            // Some Flow record resources expose object through dataType/objectType variants.
            String dataType=firstString(m,new List<String>{'dataType'});
            String objectType=firstString(m,new List<String>{'objectType'});
            if(!String.isBlank(name)&&dataType=='SObject'&&isObject(objectType))symbols.put(name,canonicalObject(objectType));
            for(String key:m.keySet())discoverSymbols(m.get(key),symbols);
        }else if(node instanceof List<Object>){for(Object child:(List<Object>)node)discoverSymbols(child,symbols);}
    }

    private static void walk(Object node,Map<String,Integer> counts,Map<String,Set<String>> locations,String path,String context,String rootObject,String inheritedObject,Map<String,String> symbols){
        if(node==null)return;
        if(node instanceof Map<String,Object>){
            Map<String,Object> m=(Map<String,Object>)node;
            String localContext=firstString(m,new List<String>{'label','name','developerName'}); if(String.isBlank(localContext))localContext=context;
            String localObject=resolveLocalObject(m,rootObject,inheritedObject,symbols);
            String location=flowLocation(path,localContext);

            // Explicit/contextual field properties, including queriedFields and choice-set fields.
            for(String key:m.keySet()){
                Object raw=m.get(key);
                if(FIELD_KEYS.contains(key) && raw instanceof String){
                    String value=(String)raw;
                    if(key=='objectFieldReference')resolveReference(value,counts,locations,location,rootObject,symbols);
                    else addIfValid(localObject,value,counts,locations,location);
                } else if(key=='queriedFields' && raw instanceof List<Object>){
                    for(Object q:(List<Object>)raw)if(q instanceof String)addIfValid(localObject,(String)q,counts,locations,location+' · queriedFields');
                }
            }

            // References that can establish a record context or directly reference a field.
            for(String key:REFERENCE_KEYS)if(m.containsKey(key)&&m.get(key) instanceof String)resolveReference((String)m.get(key),counts,locations,location,rootObject,symbols);

            for(String key:m.keySet())walk(m.get(key),counts,locations,path+'.'+key,localContext,rootObject,localObject,symbols);
        }else if(node instanceof List<Object>){
            Integer i=0;for(Object child:(List<Object>)node){walk(child,counts,locations,path+'['+i+']',context,rootObject,inheritedObject,symbols);i++;}
        }else if(node instanceof String){
            resolveReferencesInText((String)node,counts,locations,flowLocation(path,context),rootObject,symbols);
        }
    }

    private static String resolveLocalObject(Map<String,Object> m,String rootObject,String inheritedObject,Map<String,String> symbols){
        String explicitObject=objectFrom(m); if(isObject(explicitObject))return canonicalObject(explicitObject);
        for(String key:new List<String>{'inputReference','recordReference','targetReference','assignToReference'}){
            String ref=firstString(m,new List<String>{key});
            String resolved=objectForReference(ref,rootObject,symbols); if(!String.isBlank(resolved))return resolved;
        }
        return !String.isBlank(inheritedObject)?inheritedObject:rootObject;
    }

    private static void resolveReferencesInText(String value,Map<String,Integer> counts,Map<String,Set<String>> locations,String location,String rootObject,Map<String,String> symbols){
        if(String.isBlank(value)||value.length()>10000)return;
        // Handles plain references and merge/formula text such as {!$Record.Name}.
        Matcher m=Pattern.compile('(?:\\{!)?([\\$A-Za-z_][A-Za-z0-9_$]*(?:__Prior)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c|__r)?(?:\\.[A-Za-z_][A-Za-z0-9_]*(?:__c|__r)?)*)').matcher(value);
        while(m.find())resolveReference(m.group(1)+'.'+m.group(2),counts,locations,location,rootObject,symbols);
        // Explicit Object.Field strings are useful in formulas and metadata values.
        Matcher qualified=Pattern.compile('\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b').matcher(value);
        while(qualified.find())addIfValid(qualified.group(1),qualified.group(2),counts,locations,location);
    }

    private static void resolveReference(String ref,Map<String,Integer> counts,Map<String,Set<String>> locations,String location,String rootObject,Map<String,String> symbols){
        if(String.isBlank(ref))return;
        String clean=ref.trim(); if(clean.startsWith('{!'))clean=clean.substring(2); if(clean.endsWith('}'))clean=clean.substring(0,clean.length()-1);
        List<String> parts=clean.split('\\.'); if(parts.size()<2)return;
        String objectName=objectForReference(parts[0],rootObject,symbols); if(String.isBlank(objectName)&&isObject(parts[0]))objectName=canonicalObject(parts[0]);
        if(String.isBlank(objectName))return;
        resolvePath(objectName,parts,1,counts,locations,location);
    }

    private static void resolvePath(String objectName,List<String> parts,Integer index,Map<String,Integer> counts,Map<String,Set<String>> locations,String location){
        if(index>=parts.size()||!isObject(objectName))return;
        String token=parts[index];
        Map<String,Schema.SObjectField> fields=globalDescribe.get(objectName).getDescribe().fields.getMap();
        if(fields.containsKey(token)){
            addIfValid(objectName,token,counts,locations,location);
            if(index+1<parts.size()){
                Schema.DescribeFieldResult d=fields.get(token).getDescribe();
                List<Schema.SObjectType> refs=d.getReferenceTo();
                if(refs.size()==1)resolvePath(refs[0].getDescribe().getName(),parts,index+1,counts,locations,location);
            }
            return;
        }
        // Relationship name (Account -> AccountId, Parent__r -> Parent__c). Emit the lookup field and continue when unambiguous.
        for(String fieldApi:fields.keySet()){
            Schema.DescribeFieldResult d=fields.get(fieldApi).getDescribe();
            String rel=d.getRelationshipName();
            if(!String.isBlank(rel)&&rel.equalsIgnoreCase(token)){
                addIfValid(objectName,fieldApi,counts,locations,location+' · relationship '+token);
                List<Schema.SObjectType> refs=d.getReferenceTo();
                if(index+1<parts.size()&&refs.size()==1)resolvePath(refs[0].getDescribe().getName(),parts,index+1,counts,locations,location);
                return;
            }
        }
    }

    private static String objectForReference(String ref,String rootObject,Map<String,String> symbols){
        if(String.isBlank(ref))return null;
        String base=ref.contains('.')?ref.substring(0,ref.indexOf('.')):ref;
        if(base=='$Record'||base=='$Record__Prior')return rootObject;
        return symbols.containsKey(base)?symbols.get(base):null;
    }

    private static String objectFrom(Map<String,Object> m){for(String key:OBJECT_KEYS)if(m.containsKey(key)&&m.get(key) instanceof String)return (String)m.get(key);return null;}
    private static String firstString(Map<String,Object> m,List<String> keys){for(String key:keys)if(m.containsKey(key)&&m.get(key) instanceof String)return (String)m.get(key);return null;}
    private static String flowLocation(String path,String context){return String.isBlank(context)?path:context+' · '+path;}
    private static String formatLocations(Set<String> values){if(values==null||values.isEmpty())return null;List<String> ordered=new List<String>(values);ordered.sort();List<String> lines=new List<String>();Integer max=Math.min(ordered.size(),12);for(Integer i=0;i<max;i++)lines.add('Flow · '+ordered[i]);if(ordered.size()>max)lines.add('… '+(ordered.size()-max)+' more locations');return String.join(lines,'\n');}
    private static Boolean isObject(String objectName){return !String.isBlank(objectName)&&globalDescribe!=null&&globalDescribe.containsKey(objectName);}
    private static String canonicalObject(String objectName){return isObject(objectName)?globalDescribe.get(objectName).getDescribe().getName():objectName;}
    private static void addIfValid(String objectName,String fieldName,Map<String,Integer> counts,Map<String,Set<String>> locations,String location){
        if(String.isBlank(objectName)||String.isBlank(fieldName)||!isObject(objectName))return;
        Map<String,Schema.SObjectField> fields=globalDescribe.get(objectName).getDescribe().fields.getMap();if(!fields.containsKey(fieldName))return;
        String canonicalObject=globalDescribe.get(objectName).getDescribe().getName(),canonicalField=fields.get(fieldName).getDescribe().getName(),key=canonicalObject+'.'+canonicalField;
        counts.put(key,(counts.containsKey(key)?counts.get(key):0)+1);if(!locations.containsKey(key))locations.put(key,new Set<String>());if(!String.isBlank(location))locations.get(key).add(location);
    }
}
