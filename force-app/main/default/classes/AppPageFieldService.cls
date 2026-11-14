/** Read-only, navigation-scoped UI configuration evidence. Never substitutes object schema. */
public with sharing class AppPageFieldService {
    private static final String ROOT='callout:Salesforce_Tooling_API/services/data/v60.0';
    public class Result {
        public List<AppModelController.FieldUse> fields=new List<AppModelController.FieldUse>();
        public List<AppModelController.Component> pages=new List<AppModelController.Component>();
        public List<String> warnings=new List<String>();
    }
    public class PageEvidenceException extends Exception {}
    public static Result discover(String appLabel,String appMetadataId,List<AppModelController.Component> components){
        Result result=new Result();String readAt=String.valueOf(System.now());Set<String> objects=new Set<String>();
        for(AppModelController.Component c:components)if(c.type=='Object'){
            String name=ObjectUsageScanner.canonical(c.name);if(name!=null)objects.add(name);
        }
        if(objects.isEmpty())return result;
        if(objects.size()>25)throw new PageEvidenceException('App page discovery exceeds 25 navigation objects. No partial page model was accepted.');
        if(String.isBlank(appMetadataId)||!Pattern.matches('^02u[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$',appMetadataId)){
            result.warnings.add('App assignment metadata identity is unavailable. Default layouts were not assumed.');return result;
        }
        Map<String,Object> app;
        try{
            Map<String,Object> response=get('/tooling/query/?q='+EncodingUtil.urlEncode('SELECT Metadata FROM CustomApplication WHERE Id=\''+appMetadataId+'\'','UTF-8'));
            List<Object> records=listValue(response.get('records'));
            if(response.get('done')==false||records.size()!=1)throw new PageEvidenceException('App assignment metadata is incomplete or ambiguous.');
            app=mapValue(mapValue(records[0]).get('Metadata'));
            if(!(app.get('actionOverrides') instanceof List<Object>)||!(app.get('profileActionOverrides') instanceof List<Object>))throw new PageEvidenceException('App page assignment lists are unavailable.');
        }catch(Exception ex){result.warnings.add('App page configuration could not be read; no default page layouts were assumed: '+ex.getMessage().left(250));return result;}
        Set<String> pageNames=new Set<String>(),overridden=new Set<String>();Boolean assignmentsUnknown=false;
        List<Object> assignments=new List<Object>();assignments.addAll(listValue(app.get('actionOverrides')));assignments.addAll(listValue(app.get('profileActionOverrides')));
        for(Object raw:assignments){
            Map<String,Object> assignment=mapValue(raw);String action=str(assignment.get('actionName')),form=str(assignment.get('formFactor')),type=str(assignment.get('type'));
            if(action!='View'||(form!=null&&form!='Large')||type==null||type.equalsIgnoreCase('Default'))continue;
            String objectName=ObjectUsageScanner.canonical(str(assignment.get('pageOrSobjectType')));
            String recordType=str(assignment.get('recordType'));
            if(objectName==null&&recordType!=null&&recordType.contains('.'))objectName=ObjectUsageScanner.canonical(recordType.substringBefore('.'));
            if(objectName!=null)overridden.add(objectName);
            String page=str(assignment.get('content'));
            if(type.equalsIgnoreCase('Flexipage')&&!String.isBlank(page))pageNames.add(page);
            else {if(objectName==null)assignmentsUnknown=true;result.warnings.add('A View override is not a readable Lightning record page; its default layout was not substituted.');}
        }
        if(pageNames.size()>20)throw new PageEvidenceException('App page discovery exceeds 20 assigned pages. No partial page model was accepted.');
        Set<String> seenFields=new Set<String>();Set<String> needsLayout=new Set<String>();
        for(String pageName:pageNames){
            try{
                Map<String,Object> payload=get('/tooling/query/?q='+EncodingUtil.urlEncode('SELECT Id,DeveloperName,Metadata FROM FlexiPage WHERE DeveloperName=\''+String.escapeSingleQuotes(pageName)+'\' LIMIT 2','UTF-8'));
                List<Object> records=listValue(payload.get('records'));
                if(payload.get('done')==false||records.size()!=1)throw new PageEvidenceException('Assigned page identity is missing or ambiguous.');
                Map<String,Object> row=mapValue(records[0]),metadata=mapValue(row.get('Metadata'));
                String objectName=ObjectUsageScanner.canonical(str(metadata.get('sobjectType')));
                if(objectName==null){assignmentsUnknown=true;result.warnings.add('Assigned page '+pageName+' has no readable record-object context; default layouts were not assumed.');continue;}
                overridden.add(objectName);if(!objects.contains(objectName))continue;
                AppModelController.Component page=new AppModelController.Component();page.type='FlexiPage';page.name=str(row.get('DeveloperName'));page.id=str(row.get('Id'));result.pages.add(page);
                if(walk(metadata,objectName,'App-assigned Lightning page',pageName,'App '+appLabel+'; desktop page configuration; union of readable app assignments; read live at '+readAt,result.fields,seenFields,0))needsLayout.add(objectName);
            }catch(Exception ex){
                if(ex instanceof PageEvidenceException)throw ex;
                assignmentsUnknown=true;result.warnings.add('Assigned Lightning page '+pageName+' is unavailable; default layouts were not substituted: '+ex.getMessage().left(200));
            }
        }
        for(String objectName:objects){
            if(!needsLayout.contains(objectName)&&(assignmentsUnknown||overridden.contains(objectName)))continue;
            try{
                Map<String,Object> layout=get('/ui-api/layout/'+EncodingUtil.urlEncode(objectName,'UTF-8')+'?formFactor=Large&layoutType=Full&mode=View');
                if(str(layout.get('objectApiName'))!=objectName||layout.get('sections')==null)throw new PageEvidenceException('UI API layout did not identify the requested object and sections.');
                String location='App '+appLabel+' navigation; layout '+str(layout.get('id'))+'; record type '+str(layout.get('recordTypeId'))+'; View/Large; Tooling API principal; read live at '+readAt;
                walk(layout.get('sections'),objectName,'Navigation page layout',appLabel+' / '+objectName,location,result.fields,seenFields,0);
            }catch(Exception ex){
                if(ex instanceof PageEvidenceException)throw ex;
                result.warnings.add('Readable View layout unavailable for '+objectName+': '+ex.getMessage().left(180));
            }
        }
        if(!result.fields.isEmpty())result.warnings.add('UI configuration was read live at '+readAt+' (separate from the scan snapshot). UI fields are readable configured fields, not runtime observations. Navigation layouts use the Tooling API principal and its default record type and may be shared across apps; app-assigned Dynamic Forms use explicit field items. Other profiles/record types and conditional runtime visibility are not inferred.');
        return result;
    }
    // Only recognised field nodes are evidence; labels, arbitrary strings and object-info fields are not.
    @TestVisible private static Boolean walk(Object node,String objectName,String source,String componentName,String location,List<AppModelController.FieldUse> fields,Set<String> seen,Integer depth){
        if(depth>30)throw new PageEvidenceException('App page configuration nesting exceeds 30 levels.');
        Boolean detail=false;
        if(node instanceof List<Object>){for(Object child:(List<Object>)node)detail=walk(child,objectName,source,componentName,location,fields,seen,depth+1)||detail;}
        else if(node instanceof Map<String,Object>){
            Map<String,Object> item=(Map<String,Object>)node;
            if(str(item.get('componentType'))=='Field')addField(str(item.get('apiName')),objectName,source,componentName,location,fields,seen);
            String fieldItem=str(item.get('fieldItem'));if(fieldItem!=null&&fieldItem.startsWith('Record.'))addField(fieldItem.substring(7),objectName,source,componentName,location,fields,seen);
            if(str(item.get('componentName'))=='force:recordDetail')detail=true;
            for(Object child:item.values())if(child instanceof List<Object>||child instanceof Map<String,Object>)detail=walk(child,objectName,source,componentName,location,fields,seen,depth+1)||detail;
        }
        return detail;
    }
    private static void addField(String candidate,String objectName,String source,String componentName,String location,List<AppModelController.FieldUse> fields,Set<String> seen){
        if(candidate==null||!Pattern.matches('^[A-Za-z_][A-Za-z0-9_]*$',candidate))return;
        Schema.SObjectField field=Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap().get(candidate);
        if(field==null||!field.getDescribe().isAccessible())return;
        String name=field.getDescribe().getName(),key=objectName+'.'+name+'|'+componentName;
        if(!seen.add(key))return;
        if(fields.size()>=2000)throw new PageEvidenceException('App page evidence exceeds 2,000 fields. No partial page model was accepted.');
        AppModelController.FieldUse usage=new AppModelController.FieldUse();usage.objectApiName=objectName;usage.fieldApiName=name;usage.sourceType=source;usage.componentName=componentName;usage.location=location;fields.add(usage);
    }
    private static Map<String,Object> get(String path){
        HttpRequest request=new HttpRequest();request.setEndpoint((path.startsWith('/ui-api/') ? 'callout:Salesforce_Tooling_API/services/data/v66.0' : ROOT)+path);request.setMethod('GET');request.setHeader('Accept','application/json');request.setTimeout(30000);
        HttpResponse response=new Http().send(request);
        if(response.getStatusCode()<200||response.getStatusCode()>=300){
            String reason='UI configuration request failed';
            // Decode only known error codes; never expose arbitrary response bodies.
            try{
                List<Object> errors=listValue(JSON.deserializeUntyped(response.getBody()));
                String code=errors.isEmpty()?null:str(mapValue(errors[0]).get('errorCode'));
                if(code=='INVALID_TYPE')reason='Salesforce does not expose a readable UI API layout for this object';
                else if(code=='UNSUPPORTED_API_VERSION')reason='This object requires a newer UI API version';
                else if(response.getStatusCode()==401||response.getStatusCode()==403)reason='The UI configuration principal is not authenticated or lacks access';
            }catch(Exception ignored){}
            throw new CalloutException(reason+' (HTTP '+response.getStatusCode()+').');
        }
        if(response.getBody().length()>500000)throw new PageEvidenceException('App page metadata response exceeds 500,000 characters.');
        return (Map<String,Object>)JSON.deserializeUntyped(response.getBody());
    }
    private static String str(Object value){return value instanceof String?(String)value:null;}
    private static List<Object> listValue(Object value){return value instanceof List<Object>?(List<Object>)value:new List<Object>();}
    private static Map<String,Object> mapValue(Object value){return value instanceof Map<String,Object>?(Map<String,Object>)value:new Map<String,Object>();}
}
