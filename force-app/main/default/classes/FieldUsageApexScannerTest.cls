/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageApexScannerTest {
    @IsTest
    static void findsQualifiedSalesforceFieldReferencesAndCountsOccurrences() {
        String source =
            'Account accountRecord = new Account(); ' +
            'String a = Account.Name; ' +
            'String b = Account.Name; ' +
            'String c = Contact.Email;';

        List<Field_Usage_Evidence__c> rows = FieldUsageApexScanner.scan(
            null,
            'Apex Class',
            'AccountService',
            '01p000000000001',
            source
        );

        Map<String, Integer> counts = new Map<String, Integer>();
        for (Field_Usage_Evidence__c row : rows) {
            counts.put(row.Field_Key__c, Integer.valueOf(row.Occurrence_Count__c));
            System.assertEquals('Apex Class', row.Source_Type__c);
            System.assertEquals('AccountService', row.Component_Name__c);
        }

        System.assertEquals(2, counts.get('Account.Name'));
        System.assertEquals(1, counts.get('Contact.Email'));
    }


    @IsTest
    static void findsTypedVariableAndSimpleSoqlReferences() {
        String source =
            'Account acc = new Account(); ' +
            'acc.Name = \'Test\'; ' +
            'Id owner = acc.OwnerId; ' +
            'List<Account> rows = [SELECT Name, OwnerId FROM Account WHERE Id != null];';

        List<Field_Usage_Evidence__c> rows = FieldUsageApexScanner.scan(
            null, 'Apex Class', 'AccountRepository', '01p000000000002', source
        );

        Map<String,Integer> counts=new Map<String,Integer>();
        for(Field_Usage_Evidence__c row:rows)counts.put(row.Field_Key__c,Integer.valueOf(row.Occurrence_Count__c));
        System.assert(counts.containsKey('Account.Name'),'Typed variable/SOQL Name reference should be detected.');
        System.assert(counts.containsKey('Account.OwnerId'),'Typed variable/SOQL OwnerId reference should be detected.');
        System.assert(counts.get('Account.Name')>=2,'Name should be detected from both variable access and SOQL.');
        System.assert(counts.get('Account.OwnerId')>=1,'OwnerId should be detected from the typed variable or static SOQL evidence.');
    }

    @IsTest
    static void ignoresCommentsStringsAndUnknownObjectFieldPairs() {
        String source =
            '// Account.Name should not count\n' +
            'String literalValue = \'Contact.Email\'; ' +
            'String x = UnknownThing.Name;';

        List<Field_Usage_Evidence__c> rows = FieldUsageApexScanner.scan(
            null,
            'Apex Trigger',
            'AccountTrigger',
            '01q000000000001',
            source
        );

        System.assertEquals(0, rows.size());
    }

    @IsTest
    static void capturesLineAndSourceSnippetForDrilldown() {
        String source='public class Sample {\n  void runIt(){\n    Contact c = new Contact();\n    c.LastName = \'Smith\';\n  }\n}';
        List<Field_Usage_Evidence__c> rows=FieldUsageApexScanner.scan(null,'Apex Class','Sample','01p000000000003',source);
        Field_Usage_Evidence__c lastName;
        for(Field_Usage_Evidence__c row:rows)if(row.Field_Key__c=='Contact.LastName')lastName=row;
        System.assertNotEquals(null,lastName);
        System.assert(lastName.Location__c.contains('line 4'),lastName.Location__c);
        System.assert(lastName.Evidence__c.contains('Line 4:'),lastName.Evidence__c);
        System.assert(lastName.Evidence__c.contains('c.LastName'),lastName.Evidence__c);
    }
}
