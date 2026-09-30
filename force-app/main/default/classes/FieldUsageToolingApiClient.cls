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

    private static final String API_VERSION = 'v60.0';
    private static final String NAMED_CREDENTIAL = 'callout:Salesforce_Tooling_API';

    public static void assertConnectionReady() {
        String soql = 'SELECT Id FROM ApexClass LIMIT 1';
        try {
            HttpRequest request = new HttpRequest();
            request.setEndpoint(
                NAMED_CREDENTIAL +
                '/services/data/' + API_VERSION + '/tooling/query/?q=' +
                EncodingUtil.urlEncode(soql, 'UTF-8')
            );
            request.setMethod('GET');

            HttpResponse response = new Http().send(request);
            if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
                throw new ToolingApiException(
                    'Tooling API connection check failed with HTTP ' +
                    response.getStatusCode() + ': ' + safeBody(response).left(1000)
                );
            }
        } catch (Exception ex) {
            throw new ToolingApiException(
                'Field Usage requires the Salesforce_Tooling_API Named Credential to be configured and authenticated in this org. ' +
                'Ask a Salesforce administrator or authorised developer to configure the Tooling API connection, then run the scan again. ' +
                'Connection check: ' + ex.getMessage()
            );
        }
    }

    public static List<SourceComponent> getApexClassIndex() { return queryComponents('ApexClass', 'Apex Class', false, null); }
    public static List<SourceComponent> getApexTriggerIndex() { return queryComponents('ApexTrigger', 'Apex Trigger', false, null); }
    public static List<SourceComponent> getApexClasses(Set<String> componentIds) { return queryComponents('ApexClass', 'Apex Class', true, componentIds); }
    public static List<SourceComponent> getApexTriggers(Set<String> componentIds) { return queryComponents('ApexTrigger', 'Apex Trigger', true, componentIds); }

    public static List<SourceComponent> getFlowIndex() {
        String soql = 'SELECT Id, MasterLabel, Status, VersionNumber FROM Flow WHERE Status = \'Active\' ORDER BY MasterLabel';
        return queryFlowIndex(soql);
    }

    public static List<Field_Usage_Evidence__c> scanFlow(Id runId,String componentId) {
        if(String.isBlank(componentId)) return new List<Field_Usage_Evidence__c>();

        // Build the SOQL literal separately so Apex quoting stays valid and obvious.
        String quotedId = '\'' + String.escapeSingleQuotes(componentId) + '\'';
        String soql = 'SELECT Id, MasterLabel, Metadata FROM Flow WHERE Id = ' + quotedId + ' LIMIT 1';
        String relativeUrl = '/services/data/' + API_VERSION + '/tooling/query/?q=' + EncodingUtil.urlEncode(soql,'UTF-8');

        HttpResponse response=send(relativeUrl);
        Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
        List<Object> records=payload.get('records') instanceof List<Object> ? (List<Object>)payload.get('records') : new List<Object>();
        if(records.isEmpty()) return new List<Field_Usage_Evidence__c>();

        Map<String,Object> record=(Map<String,Object>)records[0];
        String flowId=(String)record.get('Id');
        String flowName=(String)record.get('MasterLabel');
        Object metadata=record.get('Metadata');
        if(metadata==null){
            throw new ToolingApiException('Tooling API returned active Flow ' + String.valueOf(flowName) + ' without Metadata. The Flow cannot be scanned for field usage.');
        }
        return FieldUsageFlowScanner.scan(runId,flowName,flowId,metadata);
    }

    private static List<SourceComponent> queryFlowIndex(String soql) {
        String nextUrl='/services/data/'+API_VERSION+'/tooling/query/?q='+EncodingUtil.urlEncode(soql,'UTF-8');
        List<SourceComponent> out=new List<SourceComponent>();
        while(nextUrl!=null){
            HttpResponse response=send(nextUrl);
            Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
            List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();
            for(Object raw:records){
                Map<String,Object> record=(Map<String,Object>)raw;
                SourceComponent c=new SourceComponent();c.id=(String)record.get('Id');c.name=(String)record.get('MasterLabel');c.sourceType='Flow';out.add(c);
            }
            nextUrl=(String)payload.get('nextRecordsUrl');
        }
        return out;
    }

    private static HttpResponse send(String relativeUrl) {
        HttpResponse response=sendAllowNotFound(relativeUrl);
        if(response.getStatusCode()<200||response.getStatusCode()>=300)throw new ToolingApiException('Tooling API request failed with HTTP '+response.getStatusCode()+': '+safeBody(response).left(1000));
        return response;
    }
    private static HttpResponse sendAllowNotFound(String relativeUrl) {
        HttpRequest request=new HttpRequest();request.setEndpoint(NAMED_CREDENTIAL+relativeUrl);request.setMethod('GET');request.setHeader('Accept','application/json');request.setTimeout(120000);
        return new Http().send(request);
    }
    private static String safeBody(HttpResponse response){String body=response==null?null:response.getBody();return body==null?'':body;}

    private static List<SourceComponent> queryComponents(String toolingObject,String sourceType,Boolean includeBody,Set<String> componentIds) {
        String fields = includeBody ? 'Id, Name, Body' : 'Id, Name';
        String whereClause = 'Id != null';
        if (componentIds != null && !componentIds.isEmpty()) {
            List<String> escapedIds = new List<String>();
            for (String componentId : componentIds) escapedIds.add('\'' + String.escapeSingleQuotes(componentId) + '\'');
            whereClause += ' AND Id IN (' + String.join(escapedIds, ',') + ')';
        }
        String soql = 'SELECT ' + fields + ' FROM ' + toolingObject + ' WHERE ' + whereClause + ' ORDER BY Name';
        String nextUrl = '/services/data/' + API_VERSION + '/tooling/query/?q=' + EncodingUtil.urlEncode(soql, 'UTF-8');
        List<SourceComponent> components = new List<SourceComponent>();
        while (nextUrl != null) {
            HttpRequest request = new HttpRequest();
            request.setEndpoint(NAMED_CREDENTIAL + nextUrl);request.setMethod('GET');request.setHeader('Accept','application/json');request.setTimeout(120000);
            HttpResponse response = new Http().send(request);
            if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) throw new ToolingApiException('Tooling API ' + toolingObject + ' query failed with HTTP ' + response.getStatusCode() + ': ' + response.getBody().left(1000));
            Map<String,Object> payload=(Map<String,Object>)JSON.deserializeUntyped(response.getBody());
            List<Object> records=payload.get('records') instanceof List<Object>?(List<Object>)payload.get('records'):new List<Object>();
            for(Object rawRecord:records){
                Map<String,Object> record=(Map<String,Object>)rawRecord;
                SourceComponent component=new SourceComponent();component.id=(String)record.get('Id');component.name=(String)record.get('Name');component.body=includeBody?(String)record.get('Body'):null;component.sourceType=sourceType;components.add(component);
            }
            nextUrl=(String)payload.get('nextRecordsUrl');
        }
        return components;
    }
}
