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

    @IsTest static void toleratesNullEmptyAndDuplicateMetadata(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        System.assertEquals(0,FieldUsageFlowScanner.scan(run.Id,'Empty Flow','301000000000002',null).size());
        Map<String,Object> metadata=new Map<String,Object>{
            'first'=>'Account.Name',
            'second'=>new List<Object>{'Account.Name',new Map<String,Object>{'object'=>'Account','field'=>'Name'}},
            'noise'=>new Map<String,Object>{'label'=>'Account.NotARealField','value'=>'ordinary text'}
        };
        List<Field_Usage_Evidence__c> rows=FieldUsageFlowScanner.scan(run.Id,'Duplicate Flow','301000000000003',metadata);
        System.assertEquals(1,rows.size(),'Repeated references should collapse to one evidence row per field/component/location.');
        System.assertEquals('Account.Name',rows[0].Field_Key__c);
        System.assertEquals(3,Integer.valueOf(rows[0].Occurrence_Count__c));
    }
}
