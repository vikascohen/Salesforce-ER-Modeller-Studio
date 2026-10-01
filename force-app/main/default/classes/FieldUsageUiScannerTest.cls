/** Tests UI source scanners with real standard Account metadata. @author Vikas Cohen */
@IsTest
private class FieldUsageUiScannerTest {
    @IsTest
    static void lwcFindsSchemaImportsAndQualifiedLiterals() {
        String body = 'import NAME from \'@salesforce/schema/Account.Name\';\n'
            + 'const f = \'Account.Name\';\n'
            + 'const nope = \'Missing__c.X__c\';';
        List<Field_Usage_Evidence__c> rows = FieldUsageLwcScanner.scan(null,'accountCard','cmp1',body);
        System.assertEquals(1, rows.size());
        System.assertEquals('Account.Name', rows[0].Field_Key__c);
        System.assertEquals(2, rows[0].Occurrence_Count__c);
        System.assert(rows[0].Location__c.contains('line'));
        System.assert(rows[0].Evidence__c.contains('Account.Name'));
        System.assertEquals(0, FieldUsageLwcScanner.scan(null,'x','x','').size());
    }
    @IsTest
    static void auraFindsQualifiedReferences() {
        String body='<aura:component>\nAccount.Name\nAccount.Name\nBogus__c.Nope__c\n</aura:component>';
        List<Field_Usage_Evidence__c> rows=FieldUsageAuraScanner.scan(null,'accountAura','cmp2',body);
        System.assertEquals(1,rows.size());
        System.assertEquals('Account.Name',rows[0].Field_Key__c);
        System.assertEquals(2,rows[0].Occurrence_Count__c);
        System.assertEquals('Aura',rows[0].Source_Type__c);
        System.assertEquals(0,FieldUsageAuraScanner.scan(null,'x','x',null).size());
    }
    @IsTest
    static void validationRuleFindsSameObjectFields() {
        List<Field_Usage_Evidence__c> rows=FieldUsageValidationRuleScanner.scan(null,'Account','RequireName','vr1','AND(ISBLANK(Name), Name = \'\')',true);
        System.assertEquals(1,rows.size());
        System.assertEquals('Account.Name',rows[0].Field_Key__c);
        System.assertEquals(2,rows[0].Occurrence_Count__c);
        System.assertEquals('Validation Rule Reference',rows[0].Evidence_Type__c);
        rows=FieldUsageValidationRuleScanner.scan(null,'Account','InactiveRule','vr2','ISBLANK(Name)',false);
        System.assertEquals('Inactive Validation Rule Reference',rows[0].Evidence_Type__c);
        System.assertEquals(0,FieldUsageValidationRuleScanner.scan(null,'NoSuchObject__c','x','x','Name = null',true).size());
        System.assertEquals(0,FieldUsageValidationRuleScanner.scan(null,'Account','x','x','',true).size());
    }
}
