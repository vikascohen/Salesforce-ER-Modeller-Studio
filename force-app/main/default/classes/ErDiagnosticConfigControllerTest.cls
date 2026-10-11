/**
 * @author Vikas Cohen
 */
@IsTest
private class ErDiagnosticConfigControllerTest {
    private static User adminUser() {
        User u=new User(Alias='erdtest',Email='erdtest@example.org',EmailEncodingKey='UTF-8',LastName='Diagnostic',LanguageLocaleKey='en_US',LocaleSidKey='en_US',TimeZoneSidKey='Pacific/Auckland',ProfileId=UserInfo.getProfileId(),Username='erdtest-'+String.valueOf(System.now().getTime())+'@example.org');
        insert u;
        PermissionSet ps=[SELECT Id FROM PermissionSet WHERE Name='Diagram_Studio_User' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=ps.Id);
        return u;
    }
    @IsTest static void optOutAndValidation() {
        User u=adminUser();
        System.runAs(u) {
            Test.startTest();
            System.assertEquals(false,ErDiagnosticConfigController.validateObject('Missing_Object_987__c').valid);
            System.assertEquals(true,ErDiagnosticConfigController.validateObject('Account').valid);
            System.assertEquals(false,ErDiagnosticConfigController.validateField('Account','Missing_Field_987__c',true).valid);
            System.assertEquals(true,ErDiagnosticConfigController.validateField('Account','Description',true).valid);
            ErDiagnosticConfigController.save('{"enabled":false,"requiredFields":[]}');
            System.assert(ErDiagnosticConfigController.load().contains('"enabled":false'));
            System.assertEquals(false,ErDiagnosticConfigController.recordEvent('buffer only','ERROR'));
            Test.stopTest();
        }
    }
    @IsTest static void enabledObjectLoggingAndSeverity() {
        User u=adminUser();
        System.runAs(u) {
            String config='{"enabled":true,"objectApi":"Account","messageField":"Description","severityEnabled":true,"severityField":"Industry","errorValue":"Technology","warningValue":"Technology","requiredFields":[{"field":"Name","value":"ER diagnostic test"}]}';
            Test.startTest();
            ErDiagnosticConfigController.save(config);
            System.assertEquals(true,ErDiagnosticConfigController.recordEvent('Test diagnostic event','ERROR'));
            System.assertEquals(true,ErDiagnosticConfigController.recordEvent('Test warning','WARN'));
            System.assertEquals(false,ErDiagnosticConfigController.recordEvent('Invalid severity','DEBUG'));
            Test.stopTest();
            System.assertEquals(2,[SELECT COUNT() FROM Account WHERE Name='ER diagnostic test']);
        }
    }
    @IsTest static void invalidMappingsRejected() {
        User u=adminUser();
        System.runAs(u) {
            Test.startTest();
            try {ErDiagnosticConfigController.save('{"enabled":true,"objectApi":"Missing_Object_987__c","messageField":"Description"}');System.assert(false,'Invalid object accepted');}
            catch(AuraHandledException expected){System.assert(expected.getMessage()!=null);}
            try {ErDiagnosticConfigController.save('{"enabled":true,"objectApi":"Account","messageField":"NumberOfEmployees"}');System.assert(false,'Invalid message type accepted');}
            catch(AuraHandledException expected){System.assert(expected.getMessage()!=null);}
            Test.stopTest();
        }
    }
    @IsTest static void typedDefaultValues() {
        System.assertEquals('Example',ErDiagnosticConfigController.validateValue('Account','Name','Example'));
        System.assertEquals(12,ErDiagnosticConfigController.validateValue('Account','NumberOfEmployees','12'));
        try {ErDiagnosticConfigController.validateValue('Account','NumberOfEmployees','not a number');System.assert(false,'Invalid numeric default accepted');}
        catch(AuraHandledException expected) {System.assert(expected.getMessage()!=null);}
    }
    @IsTest static void customParentChildLogging() {
        User u=adminUser();
        System.runAs(u) {
            String config='{"enabled":true,"provider":"custom","parentObjectApi":"Account","parentLookupField":"AccountId","parentRequiredFields":[{"field":"Name","value":"ER Parent Log"}],"objectApi":"Contact","messageField":"Description","requiredFields":[{"field":"LastName","value":"ER Child Entry"}]}';
            Test.startTest();
            ErDiagnosticConfigController.save(config);
            System.assertEquals(true,ErDiagnosticConfigController.recordEvent('Test parent child diagnostic','ERROR'));
            Test.stopTest();
            Contact entry=[SELECT Account.Name,Description FROM Contact WHERE LastName='ER Child Entry' LIMIT 1];
            System.assertEquals('ER Parent Log',entry.Account.Name);
            System.assertEquals('Test parent child diagnostic',entry.Description);
        }
    }

}
