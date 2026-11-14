@IsTest private class DslFileServiceTest {
    @TestSetup static void grantStudioAccess(){
        User u=new User(Alias='dsltest',Email='dsltest@example.com',EmailEncodingKey='UTF-8',LastName='DslTest',LanguageLocaleKey='en_US',LocaleSidKey='en_US',TimeZoneSidKey='Pacific/Auckland',ProfileId=UserInfo.getProfileId(),Username='dsltest.'+UserInfo.getOrganizationId()+'.'+String.valueOf(System.now().getTime())+'@example.com');
        insert u;
        insert new PermissionSetAssignment(AssigneeId=u.Id,PermissionSetId=[SELECT Id FROM PermissionSet WHERE Name='Diagram_Studio_User' LIMIT 1].Id);
    }
    @IsTest static void canonicalNamesAreUniqueAndImportsBindAcrossRename(){
        User testUser=[SELECT Id FROM User WHERE Alias='dsltest' AND LastName='DslTest' LIMIT 1];
        System.runAs(testUser) {
        Id library=DiagramFileController.saveFile(null,'Customer.dsl','ER','export module Customer {\nentity Account : Name\n}');
        Boolean duplicate=false;try{DiagramFileController.saveFile(null,' customer ','ER','entity Account');}catch(Exception ex){duplicate=true;}System.assert(duplicate);
        Id main=DiagramFileController.saveFile(null,'Main.dsl','ER','import customer.dsl\nuse Customer');
        DiagramFileController.renameFile(library,'Renamed.dsl');
        Map<String,Object> bundle=(Map<String,Object>)JSON.deserializeUntyped(DslFileService.resolveImports(main,'import customer.dsl\nuse Customer'));
        Map<String,Object> edges=(Map<String,Object>)bundle.get('edges');System.assertEquals(String.valueOf(library),edges.get(String.valueOf(main)+'|customer.dsl'));
        Map<String,Object> files=(Map<String,Object>)bundle.get('files');System.assertEquals(1,files.size());
        }
    }
    @IsTest static void databaseRejectsDuplicateNamesFromBulkOrDirectWrites(){
        List<Diagram_File__c> rows=new List<Diagram_File__c>{new Diagram_File__c(Name='One.dsl',Diagram_Type__c='ER'),new Diagram_File__c(Name='one',Diagram_Type__c='ER')};
        Database.SaveResult[] results=Database.insert(rows,false);System.assert(!results[0].isSuccess()&&!results[1].isSuccess());
        insert new Diagram_File__c(Name='Existing',Diagram_Type__c='ER');
        Database.SaveResult duplicate=Database.insert(new Diagram_File__c(Name='EXISTING.dsl',Diagram_Type__c='ER'),false);System.assert(!duplicate.isSuccess());
    }
    @IsTest static void missingImportsAndPathsFailAndOrdinaryDiagramsStillSave(){
        Boolean failed=false;try{DslFileService.resolveImports(null,'import missing.dsl');}catch(Exception ex){failed=true;}System.assert(failed);
        failed=false;try{DslFileService.key('./test.dsl');}catch(Exception ex){failed=true;}System.assert(failed);
        Id diagram=DiagramFileController.saveFile(null,'Ordinary model (copy)','ER','entity Account : Name');
        System.assertEquals('entity Account : Name',DiagramFileController.getFile(diagram).sourceCode);
        DiagramFileController.renameFile(diagram,'Other name');System.assertEquals('Other name',DiagramFileController.getFile(diagram).name);
    }
    @IsTest static void graphResolutionIsBoundedAndCycleSafeForTheClientCompiler(){
        User testUser=[SELECT Id FROM User WHERE Alias='dsltest' AND LastName='DslTest' LIMIT 1];
        System.runAs(testUser) {
        Id a=DiagramFileController.saveFile(null,'A.dsl','ER','export module A {}');
        Id b=DiagramFileController.saveFile(null,'B.dsl','ER','import a.dsl\nexport module B {}');
        DiagramFileController.saveFile(a,'A.dsl','ER','import b.dsl\nexport module A {}');
        Map<String,Object> bundle=(Map<String,Object>)JSON.deserializeUntyped(DslFileService.resolveImports(a,'import b.dsl\nuse B'));
        System.assertEquals(2,((Map<String,Object>)bundle.get('files')).size(),'The server bounds the graph; the compiler reports its cycle.');
        }
    }
    @IsTest static void ordinaryDiagramTextAndDiagnosticExportsKeepTheirContent(){
        String text='erDiagram\nAccount { string Name }';
        Id mermaid=DiagramFileController.saveDiagramTextExport('Customer Model','mmd',text);
        Id drawio=DiagramFileController.saveDiagramTextExport(null,'drawio','<mxfile/>');
        Id diagnostic=DiagramFileController.saveSessionDiagnosticText(null,'Module import check');
        Map<Id,ContentVersion> files=new Map<Id,ContentVersion>([SELECT Title,PathOnClient,VersionData FROM ContentVersion WHERE Id IN :new Set<Id>{mermaid,drawio,diagnostic}]);
        System.assertEquals(text,files.get(mermaid).VersionData.toString());
        System.assertEquals('Customer-Model.mmd',files.get(mermaid).PathOnClient);
        System.assertEquals('ER-Diagram.drawio',files.get(drawio).PathOnClient);
        System.assertEquals('Module import check',files.get(diagnostic).VersionData.toString());
        System.assertEquals('ER-Modeller-Session-Errors.txt',files.get(diagnostic).PathOnClient);
        Boolean failed=false;try{DiagramFileController.saveDiagramTextExport('Model','js','text');}catch(Exception ex){failed=true;}System.assert(failed);
        failed=false;try{DiagramFileController.saveDiagramTextExport('Model','mmd','');}catch(Exception ex){failed=true;}System.assert(failed);
        failed=false;try{DiagramFileController.saveSessionDiagnosticText('Model','');}catch(Exception ex){failed=true;}System.assert(failed);
    }
}
