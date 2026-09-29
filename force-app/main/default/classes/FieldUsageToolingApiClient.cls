/**
 * Tooling API client used only by the asynchronous Field Usage scanner.
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
    }

    private static final String API_VERSION = 'v60.0';
    private static final String NAMED_CREDENTIAL = 'callout:Salesforce_Tooling_API';

    public static List<SourceComponent> getApexClasses() {
        return querySource('ApexClass', 'Apex Class');
    }

    public static List<SourceComponent> getApexTriggers() {
        return querySource('ApexTrigger', 'Apex Trigger');
    }

    public static SourceComponent getApexClass(String componentId) {
        return getSource('ApexClass', 'Apex Class', componentId);
    }

    public static SourceComponent getApexTrigger(String componentId) {
        return getSource('ApexTrigger', 'Apex Trigger', componentId);
    }

    private static SourceComponent getSource(
        String toolingObject,
        String sourceType,
        String componentId
    ) {
        HttpRequest request = new HttpRequest();
        request.setEndpoint(
            NAMED_CREDENTIAL + '/services/data/' + API_VERSION +
            '/tooling/sobjects/' + toolingObject + '/' +
            EncodingUtil.urlEncode(componentId, 'UTF-8')
        );
        request.setMethod('GET');
        request.setHeader('Accept', 'application/json');
        request.setTimeout(120000);

        HttpResponse response = new Http().send(request);
        if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
            throw new ToolingApiException(
                'Tooling API source read failed with HTTP ' +
                response.getStatusCode() + ': ' + response.getBody().left(1000)
            );
        }

        Map<String, Object> record =
            (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
        SourceComponent component = new SourceComponent();
        component.id = (String) record.get('Id');
        component.name = (String) record.get('Name');
        component.body = (String) record.get('Body');
        component.sourceType = sourceType;
        return component;
    }

    private static List<SourceComponent> querySource(String toolingObject, String sourceType) {
        String soql =
            'SELECT Id, Name, Body FROM ' + toolingObject +
            ' WHERE NamespacePrefix = null ORDER BY Name';

        String nextUrl =
            '/services/data/' + API_VERSION + '/tooling/query/?q=' +
            EncodingUtil.urlEncode(soql, 'UTF-8');

        List<SourceComponent> components = new List<SourceComponent>();

        while (nextUrl != null) {
            HttpRequest request = new HttpRequest();
            request.setEndpoint(NAMED_CREDENTIAL + nextUrl);
            request.setMethod('GET');
            request.setHeader('Accept', 'application/json');
            request.setTimeout(120000);

            HttpResponse response = new Http().send(request);
            if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
                throw new ToolingApiException(
                    'Tooling API ' + toolingObject + ' query failed with HTTP ' +
                    response.getStatusCode() + ': ' + response.getBody().left(1000)
                );
            }

            Map<String, Object> payload =
                (Map<String, Object>) JSON.deserializeUntyped(response.getBody());

            for (Object rawRecord : (List<Object>) payload.get('records')) {
                Map<String, Object> record = (Map<String, Object>) rawRecord;
                SourceComponent component = new SourceComponent();
                component.id = (String) record.get('Id');
                component.name = (String) record.get('Name');
                component.body = (String) record.get('Body');
                component.sourceType = sourceType;
                components.add(component);
            }

            nextUrl = (String) payload.get('nextRecordsUrl');
        }

        return components;
    }
}
