global with sharing class ErMcpGetFieldUsage {
    global class Request { @InvocableVariable(required=true label='Object API name') global String objectApiName; @InvocableVariable(required=true label='Field API name') global String fieldApiName; @InvocableVariable(label='Snapshot Id from first page') global String snapshotId; @InvocableVariable(label='After evidence Id') global String afterEvidenceId; @InvocableVariable(label='Page size (1 to 200)') global Integer pageSize; }
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
                ErMcpFieldUsageService.Page page=ErMcpFieldUsageService.readPage(
                    key,req.snapshotId,req.afterEvidenceId,req.pageSize
                );
                response.result=JSON.serialize(new Map<String,Object>{
                    'snapshot'=>JSON.deserializeUntyped(ErMcpCore.snapshotContext()),
                    'snapshotId'=>String.valueOf(page.snapshotId),
                    'field'=>key,
                    'usage'=>page.rows,
                    'hasMore'=>page.hasMore,
                    'nextCursor'=>page.nextCursor,
                    'pageSize'=>page.pageSize
                });
            } catch(Exception ex) {outcome='Error';detail=ex.getMessage();response.result=JSON.serialize(new Map<String,Object>{'error'=>detail});}
            ErMcpCore.logCall('Get Field Usage',key,outcome,started,detail);out.add(response);
        }
        return out;
    }
}