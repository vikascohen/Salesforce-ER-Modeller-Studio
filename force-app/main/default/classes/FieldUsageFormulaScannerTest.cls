/**
 * @author Vikas Cohen
 */
@IsTest private class FieldUsageFormulaScannerTest {
 @IsTest static void tokenMatchingIsBoundarySafe(){
  System.assert(FieldUsageFormulaScanner.containsToken('Amount + 1','Amount'));System.assert(!FieldUsageFormulaScanner.containsToken('TotalAmount + 1','Amount'));
  System.assertEquals(2,FieldUsageFormulaScanner.countToken('Amount + Amount','Amount'));System.assertEquals(2,FieldUsageFormulaScanner.tokenCounts('Amount + Amount + TotalAmount').get('amount'));
 }
 @IsTest static void unknownObjectIsSafe(){
  Field_Usage_Run__c r=new Field_Usage_Run__c(Status__c='Queued');insert r;System.assertEquals(0,FieldUsageFormulaScanner.scan(r.Id,'Definitely_Not_An_Object__c').size());System.assertEquals(0,FieldUsageFormulaScanner.scanField(r.Id,'Definitely_Not_An_Object__c','Name').size());
 }
 @IsTest static void qualifiedRelationshipReferenceIsNotCountedAsSameObjectField(){
  String cleaned=FieldUsageFormulaScanner.removeQualifiedReferences('Account.Name & Name & Parent__r.Name');System.assertEquals(1,FieldUsageFormulaScanner.countToken(cleaned,'Name'));System.assertEquals(0,FieldUsageFormulaScanner.countToken(cleaned,'Account'));System.assertEquals(0,FieldUsageFormulaScanner.countToken(cleaned,'Parent__r'));
 }
 @IsTest static void relationshipTargetsResolveStandardRelationship(){Map<String,String> targets=FieldUsageFormulaScanner.relationshipTargets(Schema.SObjectType.Case.fields.getMap());System.assertEquals('Contact',targets.get('contact'));System.assertEquals('Account',targets.get('account'));}
 @IsTest static void analysesLocalAndRelationshipReferences(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
  String formula='Subject & Subject & Contact.FirstName & Contact.FirstName & Account.Name & Missing__r.Name';
  List<Field_Usage_Evidence__c> rows=FieldUsageFormulaScanner.analyseFormula(run.Id,'Case','SyntheticFormula__c',formula,Schema.SObjectType.Case.fields.getMap());
  Map<String,Decimal> counts=new Map<String,Decimal>();for(Field_Usage_Evidence__c row:rows){counts.put(row.Field_Key__c,row.Occurrence_Count__c);System.assertEquals('Formula Field',row.Source_Type__c);System.assertEquals('Case.SyntheticFormula__c',row.Component_Name__c);System.assertEquals('High',row.Confidence__c);}
  System.assertEquals(2,counts.get('Case.Subject'));System.assertEquals(2,counts.get('Contact.FirstName'));System.assertEquals(1,counts.get('Account.Name'));System.assertEquals(false,counts.containsKey('Case.Contact'));
  System.assertEquals(0,FieldUsageFormulaScanner.analyseFormula(run.Id,'Case','X',null,Schema.SObjectType.Case.fields.getMap()).size());System.assertEquals(0,FieldUsageFormulaScanner.analyseFormula(run.Id,'Case','X','Subject',null).size());
 }
 @IsTest static void scansRealSchemaSafelyAndSkipsNonFormulaField(){
  Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;System.assertEquals(0,FieldUsageFormulaScanner.scanField(run.Id,'Account','Name').size());System.assertEquals(0,FieldUsageFormulaScanner.scanField(run.Id,'Account','DefinitelyMissing__c').size());List<Field_Usage_Evidence__c> rows=FieldUsageFormulaScanner.scan(run.Id,'Account');System.assertNotEquals(null,rows);
 }
}