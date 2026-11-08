@IsTest private class FieldUsageSchemaAccessTest {
    @IsTest static void skipsOnlyUnavailableFieldAndPersistsCoverage(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        FieldUsageSchemaAccess.unavailableForTest.add(String.valueOf(Account.Name));
        System.assertEquals(null,FieldUsageSchemaAccess.fieldName(Account.Name));
        System.assertEquals('Phone',FieldUsageSchemaAccess.fieldName(Account.Phone));
        Map<String,String> names=FieldUsageSchemaAccess.canonicalNames(Account.SObjectType.getDescribe().fields.getMap());
        System.assert(!names.containsKey('name'));System.assertEquals('Phone',names.get('phone'));
        new FieldUsageDiscoveryBatch(run.Id).execute(null,new List<String>{'Account','Missing_Industry_Object__c'});
        String log=[SELECT Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:run.Id].Progress_Log__c;
        System.assert(log.contains('[Schema coverage]'));
        FieldUsageSchemaAccess.persistWarnings(run.Id);
        System.assertEquals(log,[SELECT Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:run.Id].Progress_Log__c);
        System.assertEquals(null,FieldUsageSchemaAccess.describeField(null));
    }
    @IsTest static void validationAndFormulaKeepReadableEvidence(){
        FieldUsageSchemaAccess.unavailableForTest.add(String.valueOf(Case.Subject));
        List<Field_Usage_Evidence__c> rules=FieldUsageValidationRuleScanner.scan(null,'Case','Rule',null,'Subject & Description',true);
        System.assertEquals(1,rules.size());System.assertEquals('Description',rules[0].Field_API_Name__c);
        List<Field_Usage_Evidence__c> formulas=FieldUsageFormulaScanner.analyseFormula(null,'Case','Synthetic__c','Subject & Description',Case.SObjectType.getDescribe().fields.getMap());
        System.assertEquals(1,formulas.size());System.assertEquals('Description',formulas[0].Field_API_Name__c);
        System.assertEquals(0,FieldUsageFormulaScanner.scanField(null,'Case','Subject').size());
    }
    @IsTest static void industrySchemaIsOptionalAndReadableFieldsContinue(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        new FieldUsageDiscoveryBatch(run.Id).execute(null,new List<String>{'BenefitDisbursement','Account','Missing_Industry_Object__c'});
        System.assertNotEquals(null,FieldUsageFormulaScanner.scan(run.Id,'BenefitDisbursement'));
        System.assertNotEquals(null,FieldUsageFormulaScanner.scan(run.Id,'Account'));
        FieldUsageSchemaAccess.persistWarnings(run.Id);
    }
}
