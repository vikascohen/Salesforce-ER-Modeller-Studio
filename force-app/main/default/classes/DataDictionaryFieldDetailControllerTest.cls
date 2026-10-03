@IsTest
private class DataDictionaryFieldDetailControllerTest {
    @IsTest
    static void returnsPlainFieldDetail() {
        Test.startTest();
        DataDictionaryFieldDetailController.FieldDetail detail =
            DataDictionaryFieldDetailController.getFieldDetail('Account', 'Name');
        Test.stopTest();
        System.assertEquals('Account', detail.objectApiName);
        System.assertEquals('Name', detail.fieldApiName);
        System.assertEquals(false, detail.relationship);
        System.assertNotEquals(null, detail.dataType);
    }

    @IsTest
    static void returnsLookupDetail() {
        Test.startTest();
        DataDictionaryFieldDetailController.FieldDetail detail =
            DataDictionaryFieldDetailController.getFieldDetail('Contact', 'AccountId');
        Test.stopTest();
        System.assertEquals(true, detail.relationship);
        System.assert(detail.relatedObjects.contains('Account'));
        System.assertNotEquals(null, detail.relationshipType);
        System.assert(detail.detailMessage.contains('Account'));
    }

    @IsTest
    static void rejectsMissingNames() {
        try {
            DataDictionaryFieldDetailController.getFieldDetail('', 'Name');
            System.assert(false, 'Expected missing-name validation.');
        } catch (AuraHandledException expected) {
            System.assert(true);
        }
    }

    @IsTest
    static void rejectsUnknownObject() {
        try {
            DataDictionaryFieldDetailController.getFieldDetail('Definitely_Not_An_Object__c', 'Name');
            System.assert(false, 'Expected unknown-object validation.');
        } catch (AuraHandledException expected) {
            System.assert(true);
        }
    }

    @IsTest
    static void rejectsUnknownField() {
        try {
            DataDictionaryFieldDetailController.getFieldDetail('Account', 'Definitely_Not_A_Field__c');
            System.assert(false, 'Expected unknown-field validation.');
        } catch (AuraHandledException expected) {
            System.assert(true);
        }
    }
}