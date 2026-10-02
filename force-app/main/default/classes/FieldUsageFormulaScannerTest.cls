/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageFormulaScannerTest {
 @IsTest static void tokenMatchingIsBoundarySafe(){
  System.assert(FieldUsageFormulaScanner.containsToken('Amount + 1','Amount'));
  System.assert(!FieldUsageFormulaScanner.containsToken('TotalAmount + 1','Amount'));
  System.assertEquals(2,FieldUsageFormulaScanner.countToken('Amount + Amount','Amount'));
  System.assertEquals(2,FieldUsageFormulaScanner.tokenCounts('Amount + Amount + TotalAmount').get('amount'));
 }
 @IsTest static void unknownObjectIsSafe(){
  Field_Usage_Run__c r=new Field_Usage_Run__c(Status__c='Queued');insert r;
  System.assertEquals(0,FieldUsageFormulaScanner.scan(r.Id,'Definitely_Not_An_Object__c').size());
  System.assertEquals(0,FieldUsageFormulaScanner.scanField(r.Id,'Definitely_Not_An_Object__c','Name').size());
 }
 @IsTest static void qualifiedRelationshipReferenceIsNotCountedAsSameObjectField(){
  String cleaned=FieldUsageFormulaScanner.removeQualifiedReferences('Account.Name & Name & Parent__r.Name');
  System.assertEquals(1,FieldUsageFormulaScanner.countToken(cleaned,'Name'));
  System.assertEquals(0,FieldUsageFormulaScanner.countToken(cleaned,'Account'));
  System.assertEquals(0,FieldUsageFormulaScanner.countToken(cleaned,'Parent__r'));
 }
 @IsTest static void relationshipTargetsResolveStandardRelationship(){
  Map<String,Schema.SObjectField> caseFields=Schema.SObjectType.Case.fields.getMap();
  Map<String,String> targets=FieldUsageFormulaScanner.relationshipTargets(caseFields);
  System.assertEquals('Contact',targets.get('contact'));
  System.assertEquals('Account',targets.get('account'));
 }
 @IsTest static void scansRealSchemaSafelyAndSkipsNonFormulaField(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
  System.assertEquals(0,FieldUsageFormulaScanner.scanField(run.Id,'Account','Name').size());
  System.assertEquals(0,FieldUsageFormulaScanner.scanField(run.Id,'Account','DefinitelyMissing__c').size());
  List<Field_Usage_Evidence__c> rows=FieldUsageFormulaScanner.scan(run.Id,'Account');
  System.assertNotEquals(null,rows);
 }
}