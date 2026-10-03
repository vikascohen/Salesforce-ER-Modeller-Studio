@IsTest
private class FieldUsageLayoutScannerTest {
    private class LayoutMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req){
            HttpResponse res=new HttpResponse();res.setStatusCode(200);
            if(req.getEndpoint().contains('/tooling/query/')){
                res.setBody('{"records":[{"Id":"00h000000000001AAA","Name":"Account Layout"}]}');
            } else {
                res.setBody('{"recordTypeMappings":[{"layoutId":"00h000000000001AAA","recordTypeId":"012000000000000AAA","name":"Master"}],"layouts":[{"id":"00h000000000001AAA","name":"Account Layout","layoutSections":[{"layoutRows":[{"layoutItems":[{"layoutComponents":[{"type":"Field","value":"Name"},{"type":"Field","value":"Phone"}]}]}]}]}]}');
            }
            return res;
        }
    }
    private class NonLayoutableMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req){HttpResponse res=new HttpResponse();res.setStatusCode(400);res.setBody('[{"errorCode":"INVALID_ARGUMENT_TYPE","message":"non-layoutable entity"}]');return res;}
    }
    private class ErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req){HttpResponse res=new HttpResponse();res.setStatusCode(500);res.setBody('boom');return res;}
    }
    @IsTest static void loadsFieldLayoutAndRecordType(){
        Test.setMock(HttpCalloutMock.class,new LayoutMock());Test.startTest();FieldUsageLayoutScanner.FieldLayoutDetail d=FieldUsageLayoutScanner.describeField('Account','Name');Test.stopTest();
        System.assertEquals(true,d.metadataAvailable);System.assertEquals(new List<String>{'Account Layout'},d.pageLayouts);System.assertEquals(new List<String>{'Master'},d.recordTypes);
        System.assertEquals(0,FieldUsageLayoutScanner.scan(null,'Account').size());
    }
    @IsTest static void blankAndUnknownInputsAreSafe(){
        System.assertEquals(false,FieldUsageLayoutScanner.describeField(null,'Name').metadataAvailable);
        System.assertEquals(false,FieldUsageLayoutScanner.describeField('Account','').metadataAvailable);
        System.assertEquals(false,FieldUsageLayoutScanner.describeField('Definitely_Not_An_Object__c','Name').metadataAvailable);
    }
    @IsTest static void nonLayoutableObjectReturnsUnavailable(){
        Test.setMock(HttpCalloutMock.class,new NonLayoutableMock());Test.startTest();FieldUsageLayoutScanner.FieldLayoutDetail d=FieldUsageLayoutScanner.describeField('Account','Name');Test.stopTest();System.assertEquals(false,d.metadataAvailable);
        HttpResponse r=new HttpResponse();r.setStatusCode(400);r.setBody('INVALID_ARGUMENT_TYPE: non-layoutable entity');System.assert(FieldUsageLayoutScanner.isNonLayoutableResponse(r));
        r.setStatusCode(500);System.assertEquals(false,FieldUsageLayoutScanner.isNonLayoutableResponse(r));System.assertEquals(false,FieldUsageLayoutScanner.isNonLayoutableResponse(null));
    }
    @IsTest static void unexpectedHttpFailureIsActionable(){
        Test.setMock(HttpCalloutMock.class,new ErrorMock());try{FieldUsageLayoutScanner.describeField('Account','Name');System.assert(false,'Expected layout scan exception');}catch(FieldUsageLayoutScanner.LayoutScanException ex){System.assert(ex.getMessage().contains('HTTP 500'));}
    }
}