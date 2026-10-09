global with sharing class ErMcpGetFieldUsage {
    global class Request { @InvocableVariable(required=true label='Object API name') global String objectApiName; @InvocableVariable(required=true label='Field API name') global String fieldApiName; @InvocableVariable(label='After evidence Id') global String afterEvidenceId; @InvocableVariable(label='Page size (1 to 200)') global Integer pageSize; }
    global class Response { @InvocableVariable(label='Field usage JSON') global String result; }
    @InvocableMethod(label='ER Modeller Get Field Usage' description='Read field references from the current stored Field Usage snapshot.')
    global static List<Response> invoke(List<Request> requests) {
        List<Response> out=new List<Response>();
        for(Request req:requests) {
            Long started=System.now().getTime();String outcome='Success';String detail=null;
            Response response=new Response();
            String key=req==null?'':String.valueOf(req.objectApiName)+'.'+String.valueOf(req.fieldApiName);
            try {
                ErMcpCore.requireEnabled(ErMcpCore.settings().Usage_Enabled__c);
                if(req==null||String.isBlank(req.objectApiName)||String.isBlank(req.fieldApiName)) throw new ErMcpCore.InvalidRequestException('Object and field API names are required.');
                Integer pageSize=req.pageSize==null?100:Math.max(1,Math.min(200,req.pageSize));
                Integer queryLimit=pageSize+1;
                Id cursorId=null;
                if(!String.isBlank(req.afterEvidenceId)) {
                    try { cursorId=(Id)req.afterEvidenceId; }
                    catch(Exception ex) { throw new ErMcpCore.InvalidRequestException('Invalid evidence cursor.'); }
                }
                List<Field_Usage_Evidence__c> rows;
                if(cursorId==null) {
                    rows=[SELECT Id,Field_Key__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Location__c,Occurrence_Count__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Run__r.Status__c='Completed' AND Field_Key__c=:key ORDER BY Id LIMIT :queryLimit];
                } else {
                    rows=[SELECT Id,Field_Key__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Confidence__c,Location__c,Occurrence_Count__c FROM Field_Usage_Evidence__c WHERE Run__r.Is_Current__c=true AND Run__r.Status__c='Completed' AND Field_Key__c=:key AND Id>:cursorId ORDER BY Id LIMIT :queryLimit];
                }
                Boolean hasMore=rows.size()>pageSize;
                if(hasMore)rows.remove(rows.size()-1);
                String nextCursor=hasMore && !rows.isEmpty()?String.valueOf(rows[rows.size()-1].Id):null;
                response.result=JSON.serialize(new Map<String,Object>{'snapshot'=>JSON.deserializeUntyped(ErMcpCore.snapshotContext()),'field'=>key,'usage'=>rows,'hasMore'=>hasMore,'nextCursor'=>nextCursor,'pageSize'=>pageSize});
            } catch(Exception ex) {outcome='Error';detail=ex.getMessage();response.result=JSON.serialize(new Map<String,Object>{'error'=>detail});}
            ErMcpCore.logCall('Get Field Usage',key,outcome,started,detail);out.add(response);
        }
        return out;
    }
}