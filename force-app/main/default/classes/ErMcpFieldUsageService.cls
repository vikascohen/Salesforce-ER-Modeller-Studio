/**
 * Snapshot-bound keyset pagination for stored field usage evidence.
 * No Tooling API calls and no UI concerns.
 */
public with sharing class ErMcpFieldUsageService {
    public class Page {
        public Id snapshotId;
        public List<Field_Usage_Evidence__c> rows;
        public Boolean hasMore;
        public String nextCursor;
        public Integer pageSize;
    }

    public static Page readPage(String fieldKey,String requestedSnapshotId,String afterEvidenceId,Integer requestedSize) {
        if(String.isBlank(fieldKey)) throw new ErMcpCore.InvalidRequestException('Field key is required.');
        List<Field_Usage_Run__c> currentRuns=[
            SELECT Id FROM Field_Usage_Run__c
            WHERE Is_Current__c=true AND Status__c='Completed'
            ORDER BY Completed_At__c DESC LIMIT 1
        ];
        if(currentRuns.isEmpty()) throw new ErMcpCore.InvalidRequestException('No successful field usage snapshot is available.');
        Id runId=currentRuns[0].Id;
        if(!String.isBlank(afterEvidenceId) && String.isBlank(requestedSnapshotId))
            throw new ErMcpCore.InvalidRequestException('snapshotId is required when continuing pagination.');
        if(!String.isBlank(requestedSnapshotId) && requestedSnapshotId!=String.valueOf(runId))
            throw new ErMcpCore.InvalidRequestException('Snapshot changed; restart pagination from the first page.');

        Integer size=requestedSize==null?100:Math.max(1,Math.min(200,requestedSize));
        Integer queryLimit=size+1;
        Id cursorId=null;
        if(!String.isBlank(afterEvidenceId)) {
            try { cursorId=(Id)afterEvidenceId; }
            catch(Exception ex) { throw new ErMcpCore.InvalidRequestException('Invalid evidence cursor.'); }
        }

        List<Field_Usage_Evidence__c> evidence;
        if(cursorId==null) {
            evidence=[
                SELECT Id,Field_Key__c,Source_Type__c,Component_Name__c,Component_Id__c,
                    Evidence_Type__c,Confidence__c,Location__c,Occurrence_Count__c
                FROM Field_Usage_Evidence__c
                WHERE Run__c=:runId AND Field_Key__c=:fieldKey
                ORDER BY Id LIMIT :queryLimit
            ];
        } else {
            evidence=[
                SELECT Id,Field_Key__c,Source_Type__c,Component_Name__c,Component_Id__c,
                    Evidence_Type__c,Confidence__c,Location__c,Occurrence_Count__c
                FROM Field_Usage_Evidence__c
                WHERE Run__c=:runId AND Field_Key__c=:fieldKey AND Id>:cursorId
                ORDER BY Id LIMIT :queryLimit
            ];
        }

        Page page=new Page();
        page.snapshotId=runId;
        page.pageSize=size;
        page.hasMore=evidence.size()>size;
        if(page.hasMore)evidence.remove(evidence.size()-1);
        page.rows=evidence;
        page.nextCursor=page.hasMore && !evidence.isEmpty()?String.valueOf(evidence[evidence.size()-1].Id):null;
        return page;
    }
}
