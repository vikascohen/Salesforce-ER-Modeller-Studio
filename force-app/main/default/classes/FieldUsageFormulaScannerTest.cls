@IsTest private class FieldUsageFormulaScannerTest {
 @IsTest static void tokenMatchingIsBoundarySafe(){System.assert(FieldUsageFormulaScanner.containsToken('Amount + 1','Amount'));System.assert(!FieldUsageFormulaScanner.containsToken('TotalAmount + 1','Amount'));System.assertEquals(2,FieldUsageFormulaScanner.countToken('Amount + Amount','Amount'));}
 @IsTest static void unknownObjectIsSafe(){Field_Usage_Run__c r=new Field_Usage_Run__c(Status__c='Queued');insert r;System.assertEquals(0,FieldUsageFormulaScanner.scan(r.Id,'Definitely_Not_An_Object__c').size());}
}