/**
 * @author Vikas Cohen
 */
@IsTest
private class FieldUsageFlowScannerTest {
    private static Set<String> keys(List<Field_Usage_Evidence__c> rows){Set<String> out=new Set<String>();for(Field_Usage_Evidence__c r:rows)out.add(r.Field_Key__c);return out;}

    @IsTest static void findsOnlySchemaValidatedFlowReferences(){
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running');insert run;
        Map<String,Object> metadata=new Map<String,Object>{
            'recordLookups'=>new List<Object>{new Map<String,Object>{'object'=>'Account','field'=>'Industry'},new Map<String,Object>{'object'=>'NotARealObject__c','field'=>'Fake__c'}},
            'assignments'=>new List<Object>{new Map<String,Object>{'value'=>'Account.Name'},new Map<String,Object>{'value'=>'RandomThing.NotAField'}}
        };
        Set<String> found=keys(FieldUsageFlowScanner.scan(run.Id,'Account Flow','301000000000001',metadata));
        System.assert(found.contains('Account.Industry'));System.assert(found.contains('Account.Name'));System.assertEquals(2,found.size());
    }

    @IsTest static void recordTriggeredRecordAssignments(){
        Map<String,Object> metadata=new Map<String,Object>{
            'start'=>new Map<String,Object>{'object'=>'Contact'},
            'recordUpdates'=>new List<Object>{new Map<String,Object>{
                'name'=>'Update_contact','inputReference'=>'$Record',
                'inputAssignments'=>new List<Object>{new Map<String,Object>{'field'=>'FirstName'},new Map<String,Object>{'field'=>'LastName'}}
            }}
        };
        Set<String> found=keys(FieldUsageFlowScanner.scan(null,'Record Triggered','301000000000010',metadata));
        System.assert(found.contains('Contact.FirstName'));System.assert(found.contains('Contact.LastName'));
    }

    @IsTest static void recordPriorFormulaAndRelationshipPaths(){
        Map<String,Object> metadata=new Map<String,Object>{
            'start'=>new Map<String,Object>{'object'=>'Contact'},
            'formulas'=>new List<Object>{
                new Map<String,Object>{'expression'=>'{!$Record.LastName}'},
                new Map<String,Object>{'expression'=>'{!$Record__Prior.FirstName}'},
                new Map<String,Object>{'expression'=>'{!$Record.Account.Name}'}
            }
        };
        Set<String> found=keys(FieldUsageFlowScanner.scan(null,'Formula Flow','301000000000011',metadata));
        System.assert(found.contains('Contact.LastName'));System.assert(found.contains('Contact.FirstName'));System.assert(found.contains('Contact.AccountId'));System.assert(found.contains('Account.Name'));
    }

    @IsTest static void autolaunchedRecordVariableGetAndQueriedFields(){
        Map<String,Object> metadata=new Map<String,Object>{
            'variables'=>new List<Object>{new Map<String,Object>{'name'=>'contactVar','dataType'=>'SObject','objectType'=>'Contact'}},
            'recordLookups'=>new List<Object>{new Map<String,Object>{'name'=>'GetContact','object'=>'Contact','queriedFields'=>new List<Object>{'FirstName','Email'}}},
            'assignments'=>new List<Object>{new Map<String,Object>{'assignToReference'=>'contactVar.LastName'}}
        };
        Set<String> found=keys(FieldUsageFlowScanner.scan(null,'Autolaunched','301000000000012',metadata));
        System.assert(found.contains('Contact.FirstName'));System.assert(found.contains('Contact.Email'));System.assert(found.contains('Contact.LastName'));
    }

    @IsTest static void screenAndChoiceMetadata(){
        Map<String,Object> metadata=new Map<String,Object>{
            'variables'=>new List<Object>{new Map<String,Object>{'name'=>'accountVar','dataType'=>'SObject','objectType'=>'Account'}},
            'screens'=>new List<Object>{new Map<String,Object>{'name'=>'AccountScreen','fields'=>new List<Object>{new Map<String,Object>{'objectFieldReference'=>'accountVar.Name'}}}},
            'dynamicChoiceSets'=>new List<Object>{new Map<String,Object>{'object'=>'Account','displayField'=>'Name','valueField'=>'Id','sortField'=>'Name'}}
        };
        Set<String> found=keys(FieldUsageFlowScanner.scan(null,'Screen Flow','301000000000013',metadata));
        System.assert(found.contains('Account.Name'));System.assert(found.contains('Account.Id'));
    }

    @IsTest static void scheduledAndEventStyleContextUsesSameEngine(){
        Map<String,Object> scheduled=new Map<String,Object>{'start'=>new Map<String,Object>{'object'=>'Account','filterFormula'=>'{!$Record.Industry} = \'Technology\''}};
        Set<String> scheduledKeys=keys(FieldUsageFlowScanner.scan(null,'Scheduled','301000000000014',scheduled));
        System.assert(scheduledKeys.contains('Account.Industry'));
        Map<String,Object> eventFlow=new Map<String,Object>{'start'=>new Map<String,Object>{'object'=>'Contact'},'assignments'=>new List<Object>{new Map<String,Object>{'value'=>'$Record.Email'}}};
        Set<String> eventKeys=keys(FieldUsageFlowScanner.scan(null,'Event Style','301000000000015',eventFlow));
        System.assert(eventKeys.contains('Contact.Email'));
    }

    @IsTest static void malformedUnknownAndBareRecordsDoNotInventFields(){
        Map<String,Object> metadata=new Map<String,Object>{
            'variables'=>new List<Object>{new Map<String,Object>{'name'=>'contacts','dataType'=>'SObject','objectType'=>'Contact'}},
            'noise'=>new List<Object>{'contacts','RandomThing.NotAField',new Map<String,Object>{'object'=>'Contact','field'=>'DefinitelyNotAField'}}
        };
        System.assertEquals(0,FieldUsageFlowScanner.scan(null,'Noise','301000000000016',metadata).size());
    }

    @IsTest static void toleratesNullEmptyAndDuplicateMetadata(){
        System.assertEquals(0,FieldUsageFlowScanner.scan(null,'Empty','301000000000017',null).size());
        Map<String,Object> metadata=new Map<String,Object>{'first'=>'Account.Name','second'=>new List<Object>{'Account.Name',new Map<String,Object>{'object'=>'Account','field'=>'Name'}}};
        List<Field_Usage_Evidence__c> rows=FieldUsageFlowScanner.scan(null,'Duplicate','301000000000018',metadata);
        System.assertEquals(1,rows.size());System.assertEquals('Account.Name',rows[0].Field_Key__c);System.assert(rows[0].Occurrence_Count__c>=3);
    }
}
