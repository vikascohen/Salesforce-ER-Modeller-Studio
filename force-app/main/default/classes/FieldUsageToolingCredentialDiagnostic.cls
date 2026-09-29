public with sharing class FieldUsageToolingCredentialDiagnostic {
    @AuraEnabled
    public static String run() {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(
            'callout:Salesforce_Tooling_API/services/data/v60.0/tooling/query/?q=' +
            EncodingUtil.urlEncode('SELECT Id FROM ApexClass LIMIT 1', 'UTF-8')
        );
        req.setMethod('GET');

        HttpResponse res = new Http().send(req);
        return 'STATUS = ' + res.getStatusCode() + '\nBODY = ' + res.getBody();
    }
}
