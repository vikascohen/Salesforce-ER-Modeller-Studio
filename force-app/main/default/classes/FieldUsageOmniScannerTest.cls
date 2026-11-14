@IsTest private class FieldUsageOmniScannerTest {
    private class FixtureReader implements FieldUsageOmniScanner.Reader {
        List<String> queries=new List<String>();
        public List<Map<String,Object>> read(String soql,Map<String,Object> binds){
            queries.add(soql);
            if(soql=='SELECT Id,Name FROM OmniDataTransform LIMIT 5001')return new List<Map<String,Object>>{new Map<String,Object>{'Id'=>'001000000000001','Name'=>'ReadAccount'}};
            System.assert(soql.contains(' = :parentId'),'Record IDs must be bound, never interpolated.');
            if(soql.contains('FROM OmniDataTransform WHERE'))return new List<Map<String,Object>>{new Map<String,Object>{'Id'=>'001000000000001','Name'=>'ReadAccount'}};
            return new List<Map<String,Object>>{new Map<String,Object>{'InputObjectName'=>'Account','InputFieldName'=>'Description','OutputObjectName'=>'NotAnSObject','OutputFieldName'=>'Name'}};
        }
    }
    private static void mapperCatalog(){FieldUsageOmniScanner.catalogOverride=new Map<String,Set<String>>{'OmniDataTransform'=>new Set<String>{'Id','Name'},'OmniDataTransformItem'=>new Set<String>{'Id','OmniDataTransformationId','InputObjectName','InputFieldName','OutputObjectName','OutputFieldName'}};}
    @IsTest static void absentObjectsSkipWithoutQueries(){
        FieldUsageOmniScanner.catalogOverride=new Map<String,Set<String>>();FixtureReader reader=new FixtureReader();FieldUsageOmniScanner.readerOverride=reader;
        System.assertEquals(0,FieldUsageOmniScanner.discover().size());System.assertEquals(0,reader.queries.size());
        System.assert(FieldUsageOmniScanner.capabilitySummary().contains('safely skipped'));
    }
    @IsTest static void mapperUsesDescribedFieldsAndBindsAndOnlyValidatedFieldEvidence(){
        mapperCatalog();FixtureReader reader=new FixtureReader();FieldUsageOmniScanner.readerOverride=reader;ObjectUsageScanner.reset(true);
        System.assertEquals(new List<String>{'OmniDataTransform|001000000000001'},FieldUsageOmniScanner.discover());
        List<Field_Usage_Evidence__c> rows=FieldUsageOmniScanner.scan(null,'OmniDataTransform|001000000000001');
        System.assertEquals(1,rows.size());System.assertEquals('Account.Description',rows[0].Field_Key__c);System.assertEquals('Omni Data Mapper',rows[0].Source_Type__c);
        System.assertEquals('OmniDataMapper',ObjectUsageScanner.sourceType(rows[0].Source_Type__c));
        Boolean rejected=false;try{FieldUsageOmniScanner.scan(null,'Account WHERE Name != null|001000000000001');}catch(FieldUsageOmniScanner.OmniScanException ex){rejected=true;}System.assert(rejected);
    }
    @IsTest static void configurationLinksAndFieldsAreSemanticAndSchemaValidated(){
        ObjectUsageScanner.reset(true);
        List<Field_Usage_Evidence__c> rows=FieldUsageOmniScanner.parseConfig(null,'OmniScript','Case_Open_English','001000000000001','{"objectName":"Account","fields":"Name,Description,DoesNotExist","helpText":"Industry","children":[{"bundle":"ReadAccount"},{"integrationProcedureKey":"Read_Contact"},{"remoteClass":"MyRemote"}]}');
        Set<String> fields=new Set<String>();for(Field_Usage_Evidence__c row:rows)fields.add(row.Field_Key__c);
        System.assertEquals(new Set<String>{'Account.Name','Account.Description'},fields);
        Set<String> targets=new Set<String>();for(Object_Usage_Evidence__c row:ObjectUsageScanner.rows())targets.add(row.Target_Type__c+':'+row.Target_Name__c);
        System.assert(targets.containsAll(new Set<String>{'OmniDataMapper:ReadAccount','IntegrationProcedure:Read_Contact','ApexClass:MyRemote'}));
        Boolean rejected=false;try{FieldUsageOmniScanner.parseConfig(null,'OmniScript','Bad','001000000000001','{bad');}catch(FieldUsageOmniScanner.OmniScanException ex){rejected=true;}System.assert(rejected);
    }
    @IsTest static void explicitUiReferencesCreateOnlyScopedOmniLinks(){
        ObjectUsageScanner.reset(true);ObjectUsageScanner.omniUi(null,'LWC','wrapper','id','<c-host omni-script-key="Case_Open_English"></c-host><!-- omni-script-key="Ignored" -->');
        System.assertEquals(1,ObjectUsageScanner.rows().size());System.assertEquals('Case_Open_English',ObjectUsageScanner.rows()[0].Target_Name__c);
    }
    @IsTest static void workerPersistsOmniEvidenceIdempotently(){
        mapperCatalog();FieldUsageOmniScanner.readerOverride=new FixtureReader();
        Field_Usage_Run__c run=new Field_Usage_Run__c(Status__c='Running',Object_Scan_Version__c=5,Objects_Total__c=2);insert run;
        for(Integer i=0;i<2;i++){
            Field_Usage_Work_Unit__c unit=new Field_Usage_Work_Unit__c(Run__c=run.Id,Work_Key__c='omni-'+i,Scanner_Type__c='OmniStudio',Target_Key__c='OmniDataTransform|001000000000001',Status__c='Pending');insert unit;
            new FieldUsageWorkUnitBatch(run.Id).execute(null,new List<SObject>{unit});
        }
        System.assertEquals(1,[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c=:run.Id]);
        System.assertEquals(1,[SELECT COUNT() FROM Object_Usage_Evidence__c WHERE Run__c=:run.Id]);
        System.assertEquals(0,[SELECT COUNT() FROM Field_Usage_Work_Unit__c WHERE Run__c=:run.Id]);
    }
    private class ProcessReader implements FieldUsageOmniScanner.Reader {
        public List<Map<String,Object>> read(String soql,Map<String,Object> binds){
            if(soql.contains('FROM OmniProcess WHERE'))return new List<Map<String,Object>>{new Map<String,Object>{'Name'=>'CaseOpen','IsActive'=>true,'IsIntegrationProcedure'=>false,'Type'=>'Case','SubType'=>'Open','Language'=>'English'}};
            return new List<Map<String,Object>>{new Map<String,Object>{'PropertySetConfig'=>'{"objectName":"Account","fields":["Name","Description"]}'}};
        }
    }
    @IsTest static void installedProcessSchemaUsesAliasesAndConfigurationFields(){
        FieldUsageOmniScanner.catalogOverride=new Map<String,Set<String>>{'OmniProcess'=>new Set<String>{'Id','Name','IsActive','IsIntegrationProcedure','Type','SubType','Language'},'OmniProcessElement'=>new Set<String>{'Id','OmniProcessId','PropertySetConfig'}};
        FieldUsageOmniScanner.readerOverride=new ProcessReader();ObjectUsageScanner.reset(true);
        List<Field_Usage_Evidence__c> rows=FieldUsageOmniScanner.scan(null,'OmniProcess|001000000000001');
        Set<String> names=new Set<String>(),fields=new Set<String>();for(Field_Usage_Evidence__c row:rows){names.add(row.Component_Name__c);fields.add(row.Field_Key__c);}
        System.assertEquals(new Set<String>{'Case_Open_English'},names);
        Boolean aliasFound=false;for(Object_Usage_Evidence__c row:ObjectUsageScanner.rows())if(row.Component_Name__c=='CaseOpen'&&row.Target_Name__c=='Case_Open_English')aliasFound=true;System.assert(aliasFound,'Aliases must resolve without duplicating field evidence.');System.assertEquals(new Set<String>{'Account.Name','Account.Description'},fields);
    }

}
