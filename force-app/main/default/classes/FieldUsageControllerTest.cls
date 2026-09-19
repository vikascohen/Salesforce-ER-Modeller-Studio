@isTest
private class FieldUsageControllerTest {

    @isTest
    static void testRejectsAnInvalidObjectApiName() {
        Boolean threw = false;
        try {
            FieldUsageController.searchFieldUsage('Account; DROP', new List<String>{ 'Name' });
        } catch (AuraHandledException e) {
            threw = true;
        }
        Assert.isTrue(threw, 'An unsafe object API name must be rejected before any query runs');
    }

    @isTest
    static void testRejectsAnInvalidFieldApiName() {
        Boolean threw = false;
        try {
            FieldUsageController.searchFieldUsage('Account', new List<String>{ 'Name', 'bad name!' });
        } catch (AuraHandledException e) {
            threw = true;
        }
        Assert.isTrue(threw, 'An unsafe field API name must be rejected before any query runs');
    }

    @isTest
    static void testReturnsOneResultPerRequestedFieldInOrderRegardlessOfWhetherAnyUsageIsFound() {
        // Deliberately does not assert on the CONTENTS of objectFlows or
        // omniStudioHits — whether this scratch/dev org actually has
        // matching flows or OmniStudio installed is environment-specific,
        // not something this test should assume either way. What it does
        // assert is the one thing that must always be true regardless of
        // that: the method runs without throwing for a real object, and
        // echoes back exactly the fields that were asked for, in order.
        Test.startTest();
        List<FieldUsageController.FieldUsageResult> results =
            FieldUsageController.searchFieldUsage('Account', new List<String>{ 'Name', 'Industry' });
        Test.stopTest();

        Assert.areEqual(2, results.size());
        Assert.areEqual('Name', results[0].fieldApiName);
        Assert.areEqual('Industry', results[1].fieldApiName);
        Assert.isNotNull(results[0].objectFlows, 'objectFlows should be an empty list, not null, when nothing is found');
        Assert.isNotNull(results[0].omniStudioHits, 'omniStudioHits should be an empty list, not null, when nothing is found');
    }

    @isTest
    static void testOmniStudioAvailableReflectsWhetherTheCoreSchemaExistsInThisOrg() {
        // A scratch/dev org with no OmniStudio license installed should
        // report omniStudioAvailable = false and an empty omniStudioHits
        // list, not an error — this is the honest, expected result for
        // the majority of orgs this tool will ever run in, not a failure
        // case. This assertion will need revisiting only if the org this
        // test runs in actually has the Core OmniStudio schema installed.
        Test.startTest();
        List<FieldUsageController.FieldUsageResult> results =
            FieldUsageController.searchFieldUsage('Account', new List<String>{ 'Name' });
        Test.stopTest();

        Boolean coreOmniStudioPresent = Schema.getGlobalDescribe().containsKey('OmniProcess');
        if (!coreOmniStudioPresent) {
            Assert.isFalse(results[0].omniStudioAvailable);
            Assert.areEqual(0, results[0].omniStudioHits.size());
        }
    }

    @isTest
    static void testHandlesAnEmptyFieldListWithoutThrowing() {
        Test.startTest();
        List<FieldUsageController.FieldUsageResult> results =
            FieldUsageController.searchFieldUsage('Account', new List<String>());
        Test.stopTest();

        Assert.areEqual(0, results.size());
    }
}
