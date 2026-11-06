@IsTest private class ObjectUsageScannerTest {
    private static Set<String> targets(){Set<String> result=new Set<String>();for(Object_Usage_Evidence__c row:ObjectUsageScanner.rows())result.add(row.Target_Type__c+':'+row.Target_Name__c);return result;}
    @IsTest static void objectOnlyApexAndCommentMasking(){
        ObjectUsageScanner.reset(true);
        ObjectUsageScanner.apex(null,'Apex Class','Service','01p000000000001','Integer n=[SELECT COUNT() FROM Account]; List<Contact> contacts; Opportunity o=new Opportunity(); // FROM Case\nString text=\'FROM Lead\';');
        Set<String> values=targets();System.assert(values.contains('Object:Account'));System.assert(values.contains('Object:Contact'));System.assert(values.contains('Object:Opportunity'));System.assert(!values.contains('Object:Case'));System.assert(!values.contains('Object:Lead'));
    }
    @IsTest static void disabledDoesNotChangeExistingScans(){ObjectUsageScanner.reset(false);ObjectUsageScanner.apex(null,'Apex Class','Service',null,'Account a=new Account();');System.assertEquals(0,ObjectUsageScanner.rows().size());}
    @IsTest static void lwcObjectImportsAndComponentLinks(){
        ObjectUsageScanner.reset(true);ObjectUsageScanner.lwc(null,'accountPanel / accountPanel.js','0Rd000000000001','import OBJ from "@salesforce/schema/Account"; import save from "@salesforce/apex/ContactService.save"; const objectApiName="Opportunity"; <c-child-panel></c-child-panel>');
        Set<String> values=targets();System.assert(values.containsAll(new Set<String>{'Object:Account','Object:Opportunity','ApexClass:ContactService','LightningComponentBundle:childPanel'}));
        for(Object_Usage_Evidence__c row:ObjectUsageScanner.rows())System.assertEquals('accountPanel',row.Component_Name__c);
    }
    @IsTest static void flowObjectOnlyAndEntryAutomation(){
        ObjectUsageScanner.reset(true);
        Object metadata=JSON.deserializeUntyped('{"start":{"object":"Account","recordTriggerType":"Create"},"recordLookups":[{"object":"Contact"}],"subflows":[{"flowName":"ChildFlow"}],"actionCalls":[{"actionType":"apex","actionName":"LeadAction"}],"screens":[{"extensionName":"c:accountPanel"}]}');
        ObjectUsageScanner.flow(null,'AccountFlow','301000000000001',metadata);
        System.assert(targets().containsAll(new Set<String>{'Object:Account','Object:Contact','Flow:ChildFlow','ApexClass:LeadAction','LightningComponentBundle:accountPanel'}));
        for(Object_Usage_Evidence__c row:ObjectUsageScanner.rows())System.assertEquals('Account',row.Entry_Object__c);
    }
    @IsTest static void fieldsBecomeObjectsWithoutFabricatedFieldRows(){
        ObjectUsageScanner.reset(true);ObjectUsageScanner.fromFields(null,new List<Field_Usage_Evidence__c>{new Field_Usage_Evidence__c(Source_Type__c='LWC',Component_Name__c='panel / panel.js',Object_API_Name__c='Account',Field_Key__c='Account.Name')});
        System.assertEquals(new Set<String>{'Object:Account'},targets());
    }
}
