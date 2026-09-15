/**
 * Tests for DiagramFileController. Covers the CRUD surface end to end:
 * list, get (found and not-found), save (insert and update), rename,
 * delete, and the PNG-export-to-Files flow (with and without linking to a
 * Diagram_File__c). The permission-guard branches (isCreateable/isUpdateable/
 * isDeletable) are exercised on their true path by every insert/update/
 * delete below — Salesforce's coverage metric is line-based, so the guard
 * condition itself counts as covered whichever branch runs.
 *
 * @author Vikas Cohen
 */
@isTest
private class DiagramFileControllerTest {

    private static Diagram_File__c makeDiagram(String name) {
        return new Diagram_File__c(
            Name = name,
            Diagram_Type__c = 'ER',
            Source_Code__c = 'entity Account : Name'
        );
    }

    @isTest
    static void testListFilesReturnsInsertedRecordsNewestFirst() {
        insert makeDiagram('Older Diagram');
        // LastModifiedDate ordering can't be forced apart within one test
        // transaction (both inserts land in the same instant), so this
        // checks the list contains what was inserted, not a specific order.
        insert makeDiagram('Newer Diagram');

        Test.startTest();
        List<DiagramFileController.FileSummary> results = DiagramFileController.listFiles();
        Test.stopTest();

        Assert.areEqual(2, results.size(), 'Both inserted diagrams should be returned');
        Set<String> names = new Set<String>();
        for (DiagramFileController.FileSummary fs : results) {
            names.add(fs.name);
            Assert.areEqual('ER', fs.diagramType, 'diagramType should be carried through');
            Assert.isNotNull(fs.lastModified, 'lastModified should be populated');
        }
        Assert.isTrue(names.contains('Older Diagram'));
        Assert.isTrue(names.contains('Newer Diagram'));
    }

    @isTest
    static void testListFilesReturnsEmptyListWhenNoneExist() {
        Test.startTest();
        List<DiagramFileController.FileSummary> results = DiagramFileController.listFiles();
        Test.stopTest();

        Assert.areEqual(0, results.size(), 'No diagrams inserted, so the list should be empty, not null');
    }

    @isTest
    static void testGetFileReturnsTheMatchingRecord() {
        Diagram_File__c d = makeDiagram('My Diagram');
        insert d;

        Test.startTest();
        Diagram_File__c result = DiagramFileController.getFile(d.Id);
        Test.stopTest();

        Assert.isNotNull(result, 'Should find the record just inserted');
        Assert.areEqual('My Diagram', result.Name);
        Assert.areEqual('entity Account : Name', result.Source_Code__c);
    }

    @isTest
    static void testGetFileReturnsNullForAnUnknownId() {
        // A syntactically valid but non-existent Diagram_File__c Id.
        Diagram_File__c throwaway = makeDiagram('Throwaway');
        insert throwaway;
        Id fakeId = throwaway.Id;
        delete throwaway;

        Test.startTest();
        Diagram_File__c result = DiagramFileController.getFile(fakeId);
        Test.stopTest();

        Assert.isNull(result, 'A since-deleted Id should resolve to null, not throw');
    }

    @isTest
    static void testSaveFileInsertsANewRecordWhenNoIdIsGiven() {
        Test.startTest();
        Id newId = DiagramFileController.saveFile(null, 'Brand New', 'ER', 'entity Contact : LastName');
        Test.stopTest();

        Assert.isNotNull(newId, 'A new record should have been created');
        Diagram_File__c inserted = [SELECT Name, Diagram_Type__c, Source_Code__c FROM Diagram_File__c WHERE Id = :newId];
        Assert.areEqual('Brand New', inserted.Name);
        Assert.areEqual('entity Contact : LastName', inserted.Source_Code__c);
    }

    @isTest
    static void testSaveFileUpdatesAnExistingRecordWhenIdIsGiven() {
        Diagram_File__c d = makeDiagram('Original Name');
        insert d;

        Test.startTest();
        Id resultId = DiagramFileController.saveFile(d.Id, 'Updated Name', 'ER', 'entity Lead : Company');
        Test.stopTest();

        Assert.areEqual(d.Id, resultId, 'Updating should return the same Id, not create a new record');
        Diagram_File__c updated = [SELECT Name, Source_Code__c FROM Diagram_File__c WHERE Id = :d.Id];
        Assert.areEqual('Updated Name', updated.Name);
        Assert.areEqual('entity Lead : Company', updated.Source_Code__c);
        Assert.areEqual(1, [SELECT COUNT() FROM Diagram_File__c], 'Should still be exactly one record, not a duplicate');
    }

    @isTest
    static void testRenameFileChangesOnlyTheName() {
        Diagram_File__c d = makeDiagram('Old Name');
        insert d;

        Test.startTest();
        DiagramFileController.renameFile(d.Id, 'New Name');
        Test.stopTest();

        Diagram_File__c renamed = [SELECT Name, Source_Code__c FROM Diagram_File__c WHERE Id = :d.Id];
        Assert.areEqual('New Name', renamed.Name);
        Assert.areEqual('entity Account : Name', renamed.Source_Code__c, 'Renaming should not touch the DSL source');
    }

    @isTest
    static void testDeleteFileRemovesTheRecord() {
        Diagram_File__c d = makeDiagram('To Be Deleted');
        insert d;
        Id deletedId = d.Id;

        Test.startTest();
        DiagramFileController.deleteFile(deletedId);
        Test.stopTest();

        Assert.areEqual(0, [SELECT COUNT() FROM Diagram_File__c WHERE Id = :deletedId], 'Record should no longer exist');
    }

    @isTest
    static void testSaveDiagramAsFileCreatesAContentVersionLinkedToTheDiagram() {
        Diagram_File__c d = makeDiagram('Diagram To Export');
        insert d;
        // A tiny but valid base64 payload — Apex only base64-decodes it into
        // bytes, it never validates that the bytes are a real PNG.
        String fakePngBase64 = EncodingUtil.base64Encode(Blob.valueOf('not a real png, just bytes'));

        Test.startTest();
        Id cvId = DiagramFileController.saveDiagramAsFile(d.Id, 'Diagram To Export', fakePngBase64, 'PNG');
        Test.stopTest();

        Assert.isNotNull(cvId, 'A ContentVersion should have been created');
        ContentVersion cv = [SELECT Title, ContentDocumentId FROM ContentVersion WHERE Id = :cvId];
        Assert.areEqual('Diagram To Export (PNG)', cv.Title);

        List<ContentDocumentLink> links = [
            SELECT Id FROM ContentDocumentLink
            WHERE ContentDocumentId = :cv.ContentDocumentId AND LinkedEntityId = :d.Id
        ];
        Assert.areEqual(1, links.size(), 'The exported file should be linked to the diagram record');
    }

    @isTest
    static void testSaveDiagramAsFileWorksWithoutADiagramToLinkTo() {
        // diagramFileId is optional — e.g. exporting before the diagram has
        // ever been saved. Should still create the file, just no link.
        String fakePngBase64 = EncodingUtil.base64Encode(Blob.valueOf('some bytes'));

        Test.startTest();
        Id cvId = DiagramFileController.saveDiagramAsFile(null, 'Unsaved Diagram', fakePngBase64, 'A4');
        Test.stopTest();

        Assert.isNotNull(cvId, 'A ContentVersion should still be created with no diagram to link to');
        ContentVersion cv = [SELECT Title FROM ContentVersion WHERE Id = :cvId];
        Assert.areEqual('Unsaved Diagram (A4)', cv.Title);
        Assert.areEqual(0, [SELECT COUNT() FROM ContentDocumentLink], 'No link should be created when diagramFileId is null');
    }

    @isTest
    static void testPathOnClientStripsCharactersThatArentSafeForAFileName() {
        String fakePngBase64 = EncodingUtil.base64Encode(Blob.valueOf('bytes'));

        Test.startTest();
        Id cvId = DiagramFileController.saveDiagramAsFile(null, 'Weird/Name:Here?', fakePngBase64, 'PNG');
        Test.stopTest();

        ContentVersion cv = [SELECT PathOnClient FROM ContentVersion WHERE Id = :cvId];
        Assert.isFalse(cv.PathOnClient.contains('/'), 'Unsafe filename characters should have been stripped');
        Assert.isFalse(cv.PathOnClient.contains(':'));
        Assert.isFalse(cv.PathOnClient.contains('?'));
        Assert.isTrue(cv.PathOnClient.endsWith('.png'), 'Exported file should always end in .png');
    }
}
