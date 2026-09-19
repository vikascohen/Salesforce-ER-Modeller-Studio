/**
 * Tests for SchemaMetadataController. Uses standard objects (Account,
 * Contact, Task) rather than custom metadata, since those are guaranteed
 * present in any org this runs in and don't require deploying additional
 * test-only custom objects/fields alongside this package.
 *
 * A few assertions are deliberately loose where the exact result depends
 * on org configuration this test can't control — e.g. the specific
 * Internal/External sharing model values, or whether the running user has
 * "View Setup and Configuration" (required for the EntityDefinition/
 * FieldDefinition-backed methods). Those paths are wrapped in try/catch
 * in the class under test specifically so a missing permission degrades
 * gracefully rather than throwing — the tests here check for that same
 * graceful behavior rather than asserting one specific outcome.
 *
 * @author Vikas Cohen
 */
@isTest
private class SchemaMetadataControllerTest {

    @isTest
    static void testGetAllObjectNamesIncludesAccount() {
        Test.startTest();
        List<String> names = SchemaMetadataController.getAllObjectNames();
        Test.stopTest();

        Assert.isTrue(names.size() > 0, 'Should return at least some accessible objects');
        Assert.isTrue(names.contains('Account'), 'Account should always be accessible/queryable');
        // Confirms the sort in the class under test — verifying descending
        // pairs are never found is a simple way to assert ascending order.
        for (Integer i = 1; i < names.size(); i++) {
            Assert.isTrue(names[i - 1] <= names[i], 'Names should be sorted ascending');
        }
    }

    @isTest
    static void testDescribeObjectsReturnsFieldsAndDetectsLookupRelationship() {
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjects(new List<String>{ 'Account' });
        Test.stopTest();

        Assert.areEqual(1, result.size());
        SchemaMetadataController.ObjectWrap account = result[0];
        Assert.areEqual('Account', account.apiName);
        Assert.isFalse(account.fields.isEmpty(), 'Account should describe with at least some fields');

        SchemaMetadataController.FieldWrap ownerField = findField(account.fields, 'OwnerId');
        Assert.isNotNull(ownerField, 'OwnerId should be present on Account');
        Assert.isTrue(ownerField.isRelationship, 'OwnerId is a lookup to User');
        Assert.areEqual('Lookup', ownerField.relationshipType);
        Assert.areEqual('User', ownerField.relatesTo);

        // describeObjects() (the DSL-facing path) must keep the raw Apex
        // enum name, not the Data Dictionary's friendly label — other
        // features (parsing/intellisense) depend on this exact format.
        SchemaMetadataController.FieldWrap nameField = findField(account.fields, 'Name');
        Assert.isNotNull(nameField);
        Assert.areEqual('STRING', nameField.dataType);
    }

    @isTest
    static void testDescribeObjectsMarksRequiredCorrectlyExcludingCheckboxesAndSystemFields() {
        // Real, reported bug: a genuinely required text field (LastName)
        // was correct, but every Checkbox field and every true system
        // field on Contact was ALSO showing as required on canvas, which
        // is wrong — neither is something a user is expected to "fill in".
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjects(new List<String>{ 'Contact' });
        Test.stopTest();

        SchemaMetadataController.ObjectWrap contact = result[0];

        SchemaMetadataController.FieldWrap lastName = findField(contact.fields, 'LastName');
        Assert.isNotNull(lastName);
        Assert.isTrue(lastName.required, 'LastName is a genuinely required standard field on Contact');

        SchemaMetadataController.FieldWrap emailBounced = findField(contact.fields, 'IsEmailBounced');
        Assert.isNotNull(emailBounced);
        Assert.isFalse(emailBounced.required, 'A Checkbox field can never be null by platform design, but that does not make it "required" the way LastName is');

        SchemaMetadataController.FieldWrap doNotCall = findField(contact.fields, 'DoNotCall');
        Assert.isNotNull(doNotCall);
        Assert.isFalse(doNotCall.required, 'Same Checkbox exclusion as IsEmailBounced above');

        SchemaMetadataController.FieldWrap createdDate = findField(contact.fields, 'CreatedDate');
        Assert.isNotNull(createdDate);
        Assert.isFalse(createdDate.required, 'CreatedDate is a true system field — read-only for every user, not something anyone fills in');

        SchemaMetadataController.FieldWrap systemModstamp = findField(contact.fields, 'SystemModstamp');
        Assert.isNotNull(systemModstamp);
        Assert.isFalse(systemModstamp.required, 'Same system-field exclusion as CreatedDate above');
    }

    @isTest
    static void testDescribeObjectsDetectsPolymorphicLookup() {
        // Task.WhoId is a standard, always-present polymorphic lookup
        // (Contact or Lead) — a reliable way to test this without needing
        // custom metadata deployed alongside the test.
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjects(new List<String>{ 'Task' });
        Test.stopTest();

        SchemaMetadataController.FieldWrap whoId = findField(result[0].fields, 'WhoId');
        Assert.isNotNull(whoId, 'Task.WhoId should be present');
        Assert.isTrue(whoId.isRelationship);
        Assert.areEqual('Polymorphic Lookup', whoId.relationshipType);
    }

    @isTest
    static void testDescribeObjectsSkipsAnObjectThatDoesNotExist() {
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjects(new List<String>{ 'Account', 'Not_A_Real_Object__x' });
        Test.stopTest();

        Assert.areEqual(1, result.size(), 'The nonexistent object name should be silently skipped, not error');
        Assert.areEqual('Account', result[0].apiName);
    }

    @isTest
    static void testDescribeObjectsForDictionaryAddsSyntheticPrimaryKeyRow() {
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjectsForDictionary(new List<String>{ 'Account' });
        Test.stopTest();

        SchemaMetadataController.FieldWrap idField = findField(result[0].fields, 'Id');
        Assert.isNotNull(idField, 'Dictionary path should prepend a synthetic Id row');
        Assert.isTrue(idField.isPrimaryKey);
        Assert.areEqual('ID', idField.dataType);

        // describeObjects() (non-dictionary path) must NOT have this row —
        // confirms the two call paths stay independent as designed.
        List<SchemaMetadataController.ObjectWrap> plainResult =
            SchemaMetadataController.describeObjects(new List<String>{ 'Account' });
        Assert.isNull(findField(plainResult[0].fields, 'Id'), 'Plain describeObjects() should not add the synthetic Id row');
    }

    @isTest
    static void testDescribeObjectsForDictionaryUsesFriendlyDataTypeLabels() {
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjectsForDictionary(new List<String>{ 'Account' });
        Test.stopTest();

        SchemaMetadataController.FieldWrap nameField = findField(result[0].fields, 'Name');
        Assert.areEqual('Text', nameField.dataType, 'Dictionary path should show the Setup-style label, not the raw enum');

        SchemaMetadataController.FieldWrap ownerField = findField(result[0].fields, 'OwnerId');
        Assert.areEqual('Lookup Relationship', ownerField.dataType);
    }

    @isTest
    static void testDescribeObjectsForDictionaryDoesNotThrowWithoutSetupAccess() {
        // enrichWithFieldDefinitions() queries FieldDefinition, which needs
        // "View Setup and Configuration" — whatever this test-running user's
        // access actually is, the call must complete either way (graceful
        // degradation is the whole point of that try/catch).
        Test.startTest();
        List<SchemaMetadataController.ObjectWrap> result =
            SchemaMetadataController.describeObjectsForDictionary(new List<String>{ 'Account' });
        Test.stopTest();

        Assert.areEqual(1, result.size());
        Assert.isFalse(result[0].fields.isEmpty());
    }

    @isTest
    static void testGetSharingModelsDoesNotThrowAndSkipsBlankNames() {
        Test.startTest();
        Map<String, SchemaMetadataController.SharingWrap> result =
            SchemaMetadataController.getSharingModels(new List<String>{ 'Account', '', null, '  ' });
        Test.stopTest();

        // Whether Account's sharing model resolves depends on the running
        // user's Setup access (see class comment) — either a real result or
        // none at all is acceptable; the point is it never throws, and the
        // blank/null entries never produce a spurious map entry.
        Assert.isFalse(result.containsKey(''));
        Assert.isFalse(result.containsKey('  '));
    }

    @isTest
    static void testGetRecordCountsReflectsInsertedRecords() {
        insert new Account(Name = 'Test Account 1');
        insert new Account(Name = 'Test Account 2');

        Test.startTest();
        Map<String, Integer> counts = SchemaMetadataController.getRecordCounts(new List<String>{ 'Account' });
        Test.stopTest();

        Assert.areEqual(2, counts.get('Account'), 'Should reflect the two Accounts inserted in this test');
    }

    @isTest
    static void testGetRecordCountsSkipsAnUnsafeObjectNameRatherThanRunningIt() {
        // Object/field names get concatenated directly into dynamic SOQL
        // (they can't be bind variables there) — anything that isn't a
        // plain identifier must be rejected before it ever reaches a query.
        Test.startTest();
        Map<String, Integer> counts = SchemaMetadataController.getRecordCounts(
            new List<String>{ 'Account; DELETE FROM Account', 'Account WHERE Id != null' }
        );
        Test.stopTest();

        Assert.isTrue(counts.isEmpty(), 'Malformed object names should be rejected, not executed');
    }

    @isTest
    static void testGetFieldUsageStatsComputesPopulationPercentage() {
        insert new Account(Name = 'Has Industry', Industry = 'Technology');
        insert new Account(Name = 'No Industry');

        Test.startTest();
        Map<String, Object> stats = SchemaMetadataController.getFieldUsageStats(
            'Account', new List<String>{ 'Name', 'Industry' }
        );
        Test.stopTest();

        Assert.areEqual(2, stats.get('totalRecords'));
        Map<String, Double> percentages = (Map<String, Double>) stats.get('percentages');
        Assert.areEqual(100.0, percentages.get('Name'), 'Name is populated on both records');
        Assert.areEqual(50.0, percentages.get('Industry'), 'Industry is populated on only one of two records');
    }

    @isTest
    static void testGetFieldUsageStatsHandlesZeroRecordsWithoutDivideByZero() {
        Test.startTest();
        Map<String, Object> stats = SchemaMetadataController.getFieldUsageStats(
            'Account', new List<String>{ 'Name' }
        );
        Test.stopTest();

        Assert.areEqual(0, stats.get('totalRecords'));
        Map<String, Double> percentages = (Map<String, Double>) stats.get('percentages');
        Assert.areEqual(0.0, percentages.get('Name'), 'Zero records should report 0%, not throw or return null');
    }

    @isTest
    static void testGetFieldUsageStatsRejectsAnUnsafeObjectName() {
        Test.startTest();
        Map<String, Object> stats = SchemaMetadataController.getFieldUsageStats(
            'Account; DROP TABLE Account', new List<String>{ 'Name' }
        );
        Test.stopTest();

        Assert.isNotNull(stats.get('error'), 'An unsafe object name should be rejected with an error, not executed');
    }

    // ── helper ──

    private static SchemaMetadataController.FieldWrap findField(
        List<SchemaMetadataController.FieldWrap> fields, String apiName
    ) {
        for (SchemaMetadataController.FieldWrap f : fields) {
            if (f.apiName == apiName) return f;
        }
        return null;
    }
}
