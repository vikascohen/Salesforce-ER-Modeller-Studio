/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageFlowScannerTest {
    @IsTest static void findsOnlySchemaValidatedFlowReferences(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        Map<String,Object> metadata=new Map<String,Object>{
            'recordLookups'=>new List<Object>{
                new Map<String,Object>{'object'=>'Account','field'=>'Industry'},
                new Map<String,Object>{'object'=>'NotARealObject__c','field'=>'Fake__c'}
            },
            'assignments'=>new List<Object>{
                new Map<String,Object>{'value'=>'Account.Name'},
                new Map<String,Object>{'value'=>'RandomThing.NotAField'}
            }
        };
        List<Field_Usage_Evidence__c> rows=FieldUsageFlowScanner.scan(run.Id,'Account Flow','301000000000001',metadata);
        Set<String> keys=new Set<String>();for(Field_Usage_Evidence__c row:rows)keys.add(row.Field_Key__c);
        System.assert(keys.contains('Account.Industry'));
        System.assert(keys.contains('Account.Name'));
        System.assertEquals(2,keys.size(),'Unknown object/field strings must not become Flow evidence.');
        for(Field_Usage_Evidence__c row:rows){System.assertEquals('Flow',row.Source_Type__c);System.assertEquals('Account Flow',row.Component_Name__c);}
    }
}
