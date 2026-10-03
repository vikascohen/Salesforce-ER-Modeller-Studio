/**
 * Collects page-layout field membership and record-type/layout mappings once during
 * the Field Usage scan. The UI never calls layout APIs directly; it reads the
 * persisted successful snapshot.
 * @author Vikas Cohen
 */
public without sharing class FieldUsageLayoutScanner {
    private static final String API_VERSION='v60.0';
    private static final String NAMED_CREDENTIAL='callout:Salesforce_Tooling_API';
    private static final Integer MAX_RECORD_TYPE_CALLS=90;

    public static List<Field_Usage_Evidence__c> scan(Id runId,String objectApiName){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        if(runId==null||String.isBlank(objectApiName))return out;
        Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectApiName);
        if(typ==null||!typ.getDescribe().isLayoutable())return out;

        Map<String,Set<String>> layoutFields=new Map<String,Set<String>>();
        Map<String,String> layoutNames=new Map<String,String>();
        Map<String,Set<String>> layoutRecordTypes=new Map<String,Set<String>>();
        Map<String,Object> root=get('/services/data/'+API_VERSION+'/sobjects/'+EncodingUtil.urlEncode(objectApiName,'UTF-8')+'/describe/layouts/','Page Layout describe for '+objectApiName);
        harvest(root,layoutFields,layoutNames,layoutRecordTypes,null);

        // REST layout describe can omit layout bodies when an object has multiple
        // record types. Fetch each distinct record type once, still only during scan.
        Set<String> recordTypeIds=recordTypeIds(root);
        if(layoutFields.isEmpty()&&!recordTypeIds.isEmpty()){
            if(recordTypeIds.size()>MAX_RECORD_TYPE_CALLS)throw new LayoutScanException('Object '+objectApiName+' has too many record types for safe layout scanning ('+recordTypeIds.size()+').');
            for(String recordTypeId:recordTypeIds){
                Map<String,Object> detail=get('/services/data/'+API_VERSION+'/sobjects/'+EncodingUtil.urlEncode(objectApiName,'UTF-8')+'/describe/layouts/'+EncodingUtil.urlEncode(recordTypeId,'UTF-8'),'Page Layout describe for '+objectApiName+' record type '+recordTypeId);
                harvest(detail,layoutFields,layoutNames,layoutRecordTypes,recordTypeId);
            }
        }

        Datetime observed=System.now();
        for(String layoutId:layoutFields.keySet()){
            String layoutName=String.isBlank(layoutNames.get(layoutId))?layoutId:layoutNames.get(layoutId);
            Set<String> recordTypes=layoutRecordTypes.get(layoutId);
            for(String fieldName:layoutFields.get(layoutId)){
                out.add(evidence(runId,objectApiName,fieldName,'Page Layout',layoutName,layoutId,'Page Layout Field','Field is present on page layout '+layoutName,layoutName,observed));
                if(recordTypes!=null)for(String recordTypeName:recordTypes)
                    out.add(evidence(runId,objectApiName,fieldName,'Record Type',recordTypeName,null,'Record Type Layout Assignment','Field is exposed through page layout '+layoutName+' for record type '+recordTypeName,layoutName+' → '+recordTypeName,observed));
            }
        }
        return out;
    }

    private static Field_Usage_Evidence__c evidence(Id runId,String objectName,String fieldName,String sourceType,String componentName,String componentId,String evidenceType,String text,String location,Datetime observed){
        return new Field_Usage_Evidence__c(Run__c=runId,Field_Key__c=objectName+'.'+fieldName,Object_API_Name__c=objectName,Field_API_Name__c=fieldName,Source_Type__c=sourceType,Component_Name__c=componentName,Component_Id__c=componentId,Evidence_Type__c=evidenceType,Evidence__c=text,Confidence__c='High',Observed_At__c=observed,Occurrence_Count__c=1,Location__c=location);
    }

    private static void harvest(Map<String,Object> payload,Map<String,Set<String>> layoutFields,Map<String,String> layoutNames,Map<String,Set<String>> layoutRecordTypes,String requestedRecordTypeId){
        Map<String,String> rtNames=new Map<String,String>();
        Object mappingsRaw=payload.get('recordTypeMappings');
        if(mappingsRaw instanceof List<Object>)for(Object raw:(List<Object>)mappingsRaw){
            if(!(raw instanceof Map<String,Object>))continue;Map<String,Object> m=(Map<String,Object>)raw;
            String layoutId=str(m.get('layoutId')),rtId=str(m.get('recordTypeId')),name=str(m.get('name'));
            if(!String.isBlank(rtId)&&!String.isBlank(name))rtNames.put(rtId,name);
            if(!String.isBlank(layoutId)&&!String.isBlank(name)){if(!layoutRecordTypes.containsKey(layoutId))layoutRecordTypes.put(layoutId,new Set<String>());layoutRecordTypes.get(layoutId).add(name);}
        }
        Object layoutsRaw=payload.get('layouts');
        if(!(layoutsRaw instanceof List<Object>))return;
        for(Object raw:(List<Object>)layoutsRaw){
            if(!(raw instanceof Map<String,Object>))continue;Map<String,Object> layout=(Map<String,Object>)raw;
            String id=str(layout.get('id'));if(String.isBlank(id))id=str(layout.get('layoutId'));if(String.isBlank(id))continue;
            String name=firstNonBlank(new List<String>{str(layout.get('name')),str(layout.get('label')),id});layoutNames.put(id,name);
            Set<String> fields=new Set<String>();collectFields(layout,fields);layoutFields.put(id,fields);
            if(!String.isBlank(requestedRecordTypeId)){
                String rtName=rtNames.get(requestedRecordTypeId);if(String.isBlank(rtName))rtName=recordTypeName(requestedRecordTypeId);
                if(!String.isBlank(rtName)){if(!layoutRecordTypes.containsKey(id))layoutRecordTypes.put(id,new Set<String>());layoutRecordTypes.get(id).add(rtName);}
            }
        }
    }

    private static void collectFields(Object node,Set<String> fields){
        if(node instanceof Map<String,Object>){
            Map<String,Object> mapNode=(Map<String,Object>)node;
            if('Field'.equalsIgnoreCase(str(mapNode.get('type')))){String value=str(mapNode.get('value'));if(!String.isBlank(value))fields.add(value);}
            for(Object child:mapNode.values())collectFields(child,fields);
        }else if(node instanceof List<Object>)for(Object child:(List<Object>)node)collectFields(child,fields);
    }
    private static Set<String> recordTypeIds(Map<String,Object> payload){Set<String> ids=new Set<String>();Object raw=payload.get('recordTypeMappings');if(raw instanceof List<Object>)for(Object item:(List<Object>)raw)if(item instanceof Map<String,Object>){String id=str(((Map<String,Object>)item).get('recordTypeId'));if(!String.isBlank(id))ids.add(id);}return ids;}
    private static String recordTypeName(String id){try{List<RecordType> rows=[SELECT Name FROM RecordType WHERE Id=:id LIMIT 1];return rows.isEmpty()?id:rows[0].Name;}catch(Exception ex){return id;}}
    private static Map<String,Object> get(String relativeUrl,String operation){HttpRequest req=new HttpRequest();req.setEndpoint(NAMED_CREDENTIAL+relativeUrl);req.setMethod('GET');req.setHeader('Accept','application/json');req.setTimeout(120000);HttpResponse res=new Http().send(req);if(res.getStatusCode()<200||res.getStatusCode()>=300)throw new LayoutScanException(operation+' failed with HTTP '+res.getStatusCode()+': '+String.valueOf(res.getBody()).left(1000));return (Map<String,Object>)JSON.deserializeUntyped(res.getBody());}
    private static String str(Object value){return value==null?null:String.valueOf(value);}
    private static String firstNonBlank(List<String> values){for(String value:values)if(!String.isBlank(value))return value;return null;}
    public class LayoutScanException extends Exception{}
}