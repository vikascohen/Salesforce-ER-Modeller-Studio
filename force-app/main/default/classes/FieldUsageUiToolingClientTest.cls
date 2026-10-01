/** Tests Tooling API UI metadata parsing without depending on live org UI metadata. @author Vikas Cohen */
@IsTest
private class FieldUsageUiToolingClientTest {
    private class UiMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            String endpoint = request.getEndpoint();

            if (endpoint.contains('/composite')) {
                System.assertEquals('POST', request.getMethod());
                System.assert(request.getBody().contains('ValidationRule'));
                response.setBody('{"compositeResponse":['
                    + '{"httpStatusCode":200,"body":{"records":[{"Id":"03d000000000001","ValidationName":"Require_Name","Active":true,"EntityDefinition":{"QualifiedApiName":"Account"},"Metadata":{"errorConditionFormula":"ISBLANK(Name)"}}]}},'
                    + '{"httpStatusCode":404,"body":{"message":"deleted"}},'
                    + '{"httpStatusCode":200,"body":{"records":[]}}'
                    + ']}');
            } else if (endpoint.contains('LightningComponentResource')) {
                response.setBody('{"records":[{"Id":"0Rd1","FilePath":"account.js","Source":"Account.Name","LightningComponentBundle":{"DeveloperName":"accountCard"}}]}');
            } else if (endpoint.contains('AuraDefinitionBundleId')) {
                response.setBody('{"records":[{"Id":"0Ad1","DefType":"COMPONENT","Source":"Account.Name","AuraDefinitionBundle":{"DeveloperName":"accountAura"}}]}');
            } else if (endpoint.contains('LightningComponentBundle')) {
                response.setBody('{"records":[{"Id":"0Rb1","DeveloperName":"accountCard"}],"nextRecordsUrl":"/services/data/v60.0/tooling/query/next-lwc"}');
            } else if (endpoint.contains('next-lwc')) {
                response.setBody('{"records":[{"Id":"0Rb2","DeveloperName":"secondCard"}]}');
            } else if (endpoint.contains('AuraDefinitionBundle')) {
                response.setBody('{"records":[{"Id":"0Ab1","DeveloperName":"accountAura"}]}');
            } else if (endpoint.contains('ValidationRule')) {
                response.setBody('{"records":[{"Id":"03d000000000001","ValidationName":"Require_Name","Active":true,"EntityDefinition":{"QualifiedApiName":"Account"}}]}');
            } else {
                response.setBody('{"records":[]}');
            }
            return response;
        }
    }

    @IsTest
    static void indexesResourcesRulesAndPaginationAreParsed() {
        Test.setMock(HttpCalloutMock.class, new UiMock());

        List<FieldUsageUiToolingClient.UiComponent> lwcIndex = FieldUsageUiToolingClient.getLwcBundleIndex();
        System.assertEquals(2, lwcIndex.size());
        System.assertEquals('accountCard', lwcIndex[0].name);
        System.assertEquals('secondCard', lwcIndex[1].name);
        System.assertEquals('LWC', lwcIndex[0].sourceType);

        List<FieldUsageUiToolingClient.UiComponent> auraIndex = FieldUsageUiToolingClient.getAuraBundleIndex();
        System.assertEquals(1, auraIndex.size());
        System.assertEquals('accountAura', auraIndex[0].name);

        List<FieldUsageUiToolingClient.UiComponent> lwc = FieldUsageUiToolingClient.getLwcResources(new Set<String>{'0Rb1'});
        System.assertEquals(1, lwc.size());
        System.assertEquals('accountCard / account.js', lwc[0].name);
        System.assertEquals('Account.Name', lwc[0].body);
        System.assertEquals('LWC', lwc[0].sourceType);

        List<FieldUsageUiToolingClient.UiComponent> aura = FieldUsageUiToolingClient.getAuraResources(new Set<String>{'0Ab1'});
        System.assertEquals(1, aura.size());
        System.assertEquals('accountAura / COMPONENT', aura[0].name);
        System.assertEquals('Aura', aura[0].sourceType);

        List<FieldUsageUiToolingClient.UiComponent> index = FieldUsageUiToolingClient.getValidationRuleIndex();
        System.assertEquals(1, index.size());
        System.assertEquals('Require_Name', index[0].name);
        System.assertEquals('Account', index[0].objectName);
        System.assertEquals(true, index[0].active);

        List<FieldUsageUiToolingClient.UiComponent> rules = FieldUsageUiToolingClient.getValidationRules(
            new Set<String>{'03d000000000001', '03d000000000002', '03d000000000003'}
        );
        System.assertEquals(1, rules.size(), '404 and empty composite subresponses should be ignored');
        System.assertEquals('ISBLANK(Name)', rules[0].body);
        System.assertEquals('Account', rules[0].objectName);
        System.assertEquals('Validation Rule', rules[0].sourceType);

        System.assertEquals(0, FieldUsageUiToolingClient.getLwcResources(new Set<String>()).size());
        System.assertEquals(0, FieldUsageUiToolingClient.getAuraResources(null).size());
        System.assertEquals(0, FieldUsageUiToolingClient.getValidationRules(null).size());
    }

    private class LargeCompositeMock implements HttpCalloutMock {
        Integer compositeCalls = 0;
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            if (request.getEndpoint().contains('/composite')) {
                compositeCalls++;
                List<Object> compositeResponses = new List<Object>();
                Map<String,Object> sent = (Map<String,Object>) JSON.deserializeUntyped(request.getBody());
                List<Object> requests = (List<Object>) sent.get('compositeRequest');
                for (Integer i = 0; i < requests.size(); i++) {
                    compositeResponses.add(new Map<String,Object>{
                        'httpStatusCode' => 200,
                        'body' => new Map<String,Object>{
                            'records' => new List<Object>{
                                new Map<String,Object>{
                                    'Id' => '03d' + String.valueOf(compositeCalls) + String.valueOf(i),
                                    'ValidationName' => 'Rule' + String.valueOf(i),
                                    'Active' => true,
                                    'EntityDefinition' => new Map<String,Object>{'QualifiedApiName' => 'Account'},
                                    'Metadata' => new Map<String,Object>{'errorConditionFormula' => 'Name = null'}
                                }
                            }
                        }
                    });
                }
                response.setBody(JSON.serialize(new Map<String,Object>{'compositeResponse' => compositeResponses}));
            } else {
                response.setBody('{"records":[]}');
            }
            return response;
        }
    }

    @IsTest
    static void validationRulesAreChunkedAtCompositeLimit() {
        Set<String> ids = new Set<String>();
        for (Integer i = 0; i < 26; i++) ids.add('03d000000000' + String.valueOf(i).leftPad(3, '0'));
        LargeCompositeMock mock = new LargeCompositeMock();
        Test.setMock(HttpCalloutMock.class, mock);
        List<FieldUsageUiToolingClient.UiComponent> rows = FieldUsageUiToolingClient.getValidationRules(ids);
        System.assertEquals(26, rows.size());
        System.assertEquals(2, mock.compositeCalls, '26 rules must be split into two Composite API calls');
    }

    private class MissingRelationshipMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            response.setBody('{"records":[{"Id":"0RdX","FilePath":"orphan.js","Source":"Account.Name"}]}');
            return response;
        }
    }

    @IsTest
    static void missingBundleRelationshipUsesSafeFallbackName() {
        Test.setMock(HttpCalloutMock.class, new MissingRelationshipMock());
        List<FieldUsageUiToolingClient.UiComponent> rows = FieldUsageUiToolingClient.getLwcResources(new Set<String>{'0RbMissing'});
        System.assertEquals(1, rows.size());
        System.assertEquals('Unknown bundle / orphan.js', rows[0].name);
    }

    private class ErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest request) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(500);
            response.setBody('failure');
            return response;
        }
    }

    @IsTest
    static void errorsAreExplicitForQueryAndComposite() {
        Test.setMock(HttpCalloutMock.class, new ErrorMock());
        try {
            FieldUsageUiToolingClient.getLwcBundleIndex();
            System.assert(false, 'Expected query error');
        } catch (FieldUsageUiToolingClient.FieldUsageUiToolingException e) {
            System.assert(e.getMessage().contains('HTTP 500'));
        }
        try {
            FieldUsageUiToolingClient.getValidationRules(new Set<String>{'03d000000000001'});
            System.assert(false, 'Expected composite error');
        } catch (FieldUsageUiToolingClient.FieldUsageUiToolingException e) {
            System.assert(e.getMessage().contains('HTTP 500'));
        }
    }
}