/**
 * Bulk Tooling API client used only by the asynchronous Field Usage scanner.
 * The Named Credential must be configured as Salesforce_Tooling_API.
 *
 * @author Vikas Cohen
 */
public without sharing class FieldUsageToolingApiClient {
    public class ToolingApiException extends Exception {}

    public class SourceComponent {
        public String id;
        public String name;
        public String body;
        public String sourceType;
        public Object metadata;
    }

    public class FlowDiagnosticResult {
        public Boolean success;
        public String flowDefinitionId;
        public String flowName;
        public String activeVersionId;
        public Boolean metadataReceived;
        public Integer metadataJsonLength;
        public Integer evidenceRows;
        public List<String> fieldKeys;
        public String message;
    }

    private static final String API_VERSION = 'v60.0';
    private static final String NAMED_CREDENTIAL = 'callout:Salesforce_Tooling_API';

    public static void assertConnectionReady() {
        String soql = 'SELECT Id FROM ApexClass LIMIT 1';
        try {
            HttpRequest request = new HttpRequest();
            request.setEndpoint(NAMED_CREDENTIAL + '/services/data/' + API_VERSION + '/tooling/query/?q=' + EncodingUtil.urlEncode(soql, 'UTF-8'));
            request.setMethod('GET');
            HttpResponse response = new Http().send(request);
            if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
                throw new ToolingApiException('Tooling API connection check failed with HTTP ' + response.getStatusCode() + ': ' + safeBody(response).left(1000));
            }
        } catch (Exception ex) {
            throw new ToolingApiException('Field Usage requires the Salesforce_Tooling_API Named Credential to be configured and authenticated in this org. Connection check: ' + ex.getMessage());
        }
    }

    public static List<SourceComponent> getApexClassIndex() { return queryComponents('ApexClass', 'Apex Class', false, null); }
    public static List<SourceComponent> getApexTriggerIndex() { return queryComponents('ApexTrigger', 'Apex Trigger', false, null); }
    public static List<SourceComponent> getApexClasses(Set<String> componentIds) { return queryComponents('ApexClass', 'Apex Class', true, componentIds); }
    public static List<SourceComponent> getApexTriggers(Set<String> componentIds) { return queryComponents('ApexTrigger', 'Apex Trigger', true, componentIds); }

    public static List<SourceComponent> getFlowIndex() {
        String soql = 'SELECT Id, DeveloperName, MasterLabel, ActiveVersionId FROM FlowDefinition WHERE ActiveVersionId != null ORDER BY DeveloperName';
        String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');
        List<SourceComponent> out=new List<SourceComponent>();
        while(nextUrl!=null){
            HttpResponse response=send(nextUrl);
            Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
            List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();
            for(Object raw:records){
                Map<String,Object> record=(Map<String,Object>)raw;
                SourceComponent c=new SourceComponent();
                c.id=(String)record.get('Id');
                c.name=(String)record.get('MasterLabel');
                if(String.isBlank(c.name)) c.name=(String)record.get('DeveloperName');
                c.sourceType='Flow';
                out.add(c);
            }
            nextUrl=(String)payload.get('nextRecordsUrl');
        }
        return out;
    }

    public static List<Field_Usage_Evidence__c> scanFlow(Id runId,String flowDefinitionId) {
        FlowPayload payload=loadActiveFlow(flowDefinitionId);
        if(payload==null || payload.metadata==null) return new List<Field_Usage_Evidence__c>();
        return FieldUsageFlowScanner.scan(runId,payload.flowName,payload.flowId,payload.metadata);
    }

    /** Diagnostic only: no DML and no full scan. Call from Execute Anonymous. */
    public static FlowDiagnosticResult diagnoseFlow(String flowDefinitionId) {
        FlowDiagnosticResult result=new FlowDiagnosticResult();
        result.flowDefinitionId=flowDefinitionId;
        result.fieldKeys=new List<String>();
        try {
            FlowPayload payload=loadActiveFlow(flowDefinitionId);
            if(payload==null){
                result.success=false; result.message='FlowDefinition was not found or has no active version.'; return result;
            }
            result.flowName=payload.flowName;
            result.activeVersionId=payload.activeVersionId;
            result.metadataReceived=payload.metadata!=null;
            result.metadataJsonLength=payload.metadata==null?0:JSON.serialize(payload.metadata).length();
            if(payload.metadata==null){result.success=false;result.message='Active Flow version was retrieved but Metadata was missing.';return result;}
            List<Field_Usage_Evidence__c> rows=FieldUsageFlowScanner.scan(null,payload.flowName,payload.flowId,payload.metadata);
            result.evidenceRows=rows.size();
            for(Field_Usage_Evidence__c row:rows) result.fieldKeys.add(row.Field_Key__c+' ('+String.valueOf(row.Occurrence_Count__c)+')');
            result.success=true;
            result.message=rows.isEmpty()?'Metadata retrieved successfully, but the Flow parser produced zero field-usage evidence.':'Flow metadata and parser both succeeded.';
            return result;
        } catch(Exception ex) {
            result.success=false; result.message=ex.getTypeName()+': '+ex.getMessage(); return result;
        }
    }

    private class FlowPayload {
        String flowName; String flowId; String activeVersionId; Object metadata;
    }

    private static FlowPayload loadActiveFlow(String flowDefinitionId) {
        if(String.isBlank(flowDefinitionId)) return null;
        String quotedDefinitionId='\''+String.escapeSingleQuotes(flowDefinitionId)+'\'';
        String definitionSoql='SELECT Id, DeveloperName, MasterLabel, ActiveVersionId FROM FlowDefinition WHERE Id = '+quotedDefinitionId+' LIMIT 1';
        String definitionUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(definitionSoql,'UTF-8');
        HttpResponse definitionResponse=send(definitionUrl);
        Map<String,Object> definitionPayload=(Map<String,Object>)JSON.deserializeUntyped(definitionResponse.getBody());
        List<Object> definitions=definitionPayload.get('records') instanceof List<Object>?(List<Object>)definitionPayload.get('records'):new List<Object>();
        if(definitions.isEmpty()) return null;
        Map<String,Object> definition=(Map<String,Object>)definitions[0];
        String activeVersionId=(String)definition.get('ActiveVersionId');
        if(String.isBlank(activeVersionId)) return null;
        String flowName=(String)definition.get('MasterLabel');
        if(String.isBlank(flowName)) flowName=(String)definition.get('DeveloperName');
        String flowUrl='/services/data/'+API_VERSION+'/tooling/sobjects/Flow/'+EncodingUtil.urlEncode(activeVersionId,'UTF-8');
        HttpResponse flowResponse=send(flowUrl);
        Map<String,Object> flowRecord=(Map<String,Object>)JSON.deserializeUntyped(flowResponse.getBody());
        FlowPayload payload=new FlowPayload();
        payload.flowName=flowName; payload.activeVersionId=activeVersionId; payload.metadata=flowRecord.get('Metadata');
        payload.flowId=(String)flowRecord.get('Id'); if(String.isBlank(payload.flowId))payload.flowId=activeVersionId;
        String returnedLabel=(String)flowRecord.get('MasterLabel'); if(!String.isBlank(returnedLabel))payload.flowName=returnedLabel;
        return payload;
    }

    private static HttpResponse send(String relativeUrl) {
        HttpResponse response=sendAllowNotFound(relativeUrl);
        if(response.getStatusCode()<200||response.getStatusCode()>=300) throw new ToolingApiException('Tooling API request failed with HTTP '+response.getStatusCode()+': '+safeBody(response).left(1000));
        return response;
    }
    private static HttpResponse sendAllowNotFound(String relativeUrl) {
        HttpRequest request=new HttpRequest(); request.setEndpoint(NAMED_CREDENTIAL+relativeUrl); request.setMethod('GET'); request.setHeader('Accept','application/json'); request.setTimeout(120000); return new Http().send(request);
    }
    private static String safeBody(HttpResponse response){String body=response==null?null:response.getBody();return body==null?'':body;}

    private static List<SourceComponent> queryComponents(String toolingObject,String sourceType,Boolean includeBody,Set<String> componentIds) {
        String fields=includeBody?'Id, Name, Body':'Id, Name'; String whereClause='Id != null';
        if(componentIds!=null&&!componentIds.isEmpty()){List<String> escapedIds=new List<String>();for(String componentId:componentIds)escapedIds.add('\''+String.escapeSingleQuotes(componentId)+'\'');whereClause+=' AND Id IN ('+String.join(escapedIds,',')+')';}
        String soql='SELECT '+fields+' FROM '+toolingObject+' WHERE '+whereClause+' ORDER BY Name';
        String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8'); List<SourceComponent> components=new List<SourceComponent>();
        while(nextUrl!=null){HttpResponse response=send(nextUrl);Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();for(Object rawRecord:records){Map<String,Object> record=(Map<String,Object>)rawRecord;SourceComponent component=new SourceComponent();component.id=(String)record.get('Id');component.name=(String)record.get('Name');component.body=includeBody?(String)record.get('Body'):null;component.sourceType=sourceType;components.add(component);}nextUrl=(String)payload.get('nextRecordsUrl');}
        return components;
    }
}
