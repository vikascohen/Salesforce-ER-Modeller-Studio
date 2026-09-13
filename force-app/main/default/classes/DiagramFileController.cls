/**
 * CRUD backend for Diagram Studio.
 * Diagrams stored as Diagram_File__c (Name, Diagram_Type__c, Source_Code__c).
 * PNG exports stored as Salesforce Files (ContentVersion) linked to the record.
 *
 * @author Vikas Cohen
 */
public with sharing class DiagramFileController {

    public class FileSummary {
        @AuraEnabled public Id     id;
        @AuraEnabled public String name;
        @AuraEnabled public String diagramType;
        @AuraEnabled public String lastModified; // ISO string
    }

    // ── list ──

    @AuraEnabled(cacheable=true)
    public static List<FileSummary> listFiles() {
        List<FileSummary> out = new List<FileSummary>();
        for (Diagram_File__c f : [
            SELECT Id, Name, Diagram_Type__c, LastModifiedDate
            FROM Diagram_File__c
            WITH USER_MODE
            ORDER BY LastModifiedDate DESC
            LIMIT 200
        ]) {
            FileSummary fs  = new FileSummary();
            fs.id           = f.Id;
            fs.name         = f.Name;
            fs.diagramType  = f.Diagram_Type__c;
            fs.lastModified = String.valueOf(f.LastModifiedDate);
            out.add(fs);
        }
        return out;
    }

    // ── get single ──

    @AuraEnabled(cacheable=true)
    public static Diagram_File__c getFile(Id fileId) {
        List<Diagram_File__c> r = [
            SELECT Id, Name, Diagram_Type__c, Source_Code__c
            FROM   Diagram_File__c
            WHERE  Id = :fileId
            WITH   USER_MODE
            LIMIT  1
        ];
        return r.isEmpty() ? null : r[0];
    }

    // ── save DSL source ──

    @AuraEnabled
    public static Id saveFile(Id fileId, String fileName, String diagramType, String sourceCode) {
        Diagram_File__c f = fileId != null ? new Diagram_File__c(Id = fileId) : new Diagram_File__c();
        f.Name            = fileName;
        f.Diagram_Type__c = diagramType;
        f.Source_Code__c  = sourceCode;

        if (fileId != null) {
            if (!Schema.sObjectType.Diagram_File__c.isUpdateable()) {
                throw new AuraHandledException('You do not have permission to update diagram files.');
            }
            update f;
        } else {
            if (!Schema.sObjectType.Diagram_File__c.isCreateable()) {
                throw new AuraHandledException('You do not have permission to create diagram files.');
            }
            insert f;
        }
        return f.Id;
    }

    // ── rename ──

    @AuraEnabled
    public static void renameFile(Id fileId, String newName) {
        if (!Schema.sObjectType.Diagram_File__c.isUpdateable()) {
            throw new AuraHandledException('You do not have permission to rename diagram files.');
        }
        update new Diagram_File__c(Id = fileId, Name = newName);
    }

    // ── delete ──

    @AuraEnabled
    public static void deleteFile(Id fileId) {
        if (!Schema.sObjectType.Diagram_File__c.isDeletable()) {
            throw new AuraHandledException('You do not have permission to delete diagram files.');
        }
        delete new Diagram_File__c(Id = fileId);
    }

    // ── save PNG/SVG to Salesforce Files ──
    // pngBase64 : base64-encoded PNG bytes (no data-URI prefix)
    // pageSize  : 'A4' | 'A3' | 'PNG'
    // Returns the new ContentVersion Id.

    @AuraEnabled
    public static Id saveDiagramAsFile(Id diagramFileId, String fileName, String pngBase64, String pageSize) {
        if (!Schema.sObjectType.ContentVersion.isCreateable()) {
            throw new AuraHandledException('You do not have permission to create files.');
        }
        String title = fileName + ' (' + pageSize + ')';
        ContentVersion cv  = new ContentVersion();
        cv.Title           = title;
        cv.PathOnClient    = title.replaceAll('[^a-zA-Z0-9_\\- ]', '_') + '.png';
        cv.VersionData     = EncodingUtil.base64Decode(pngBase64);
        cv.IsMajorVersion  = true;
        insert cv;

        // Link to the Diagram_File__c record if supplied
        if (diagramFileId != null) {
            // Re-query to get ContentDocumentId
            Id cdId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id LIMIT 1].ContentDocumentId;
            if (Schema.sObjectType.ContentDocumentLink.isCreateable()) {
                insert new ContentDocumentLink(
                    ContentDocumentId = cdId,
                    LinkedEntityId    = diagramFileId,
                    ShareType         = 'V'
                );
            }
        }
        return cv.Id;
    }
}
