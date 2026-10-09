global with sharing class ErMcpGetSnapshotStatus {
    global class Request { @InvocableVariable(label='Request reference') global String reference; }
    global class Response { @InvocableVariable(label='Snapshot status JSON') global String result; }
    @InvocableMethod(label='ER Modeller Get Snapshot Status' description='Return stored Field Usage snapshot and running scan state without live scanning.')
    global static List<Response> invoke(List<Request> requests) {
        List<Response> out = new List<Response>();
        for (Request req : requests) {
            Long started=System.now().getTime(); String outcome='Success';String detail=null;
            Response response=new Response();
            try {
                ErMcpCore.requireEnabled(ErMcpCore.settings().Status_Enabled__c);
                response.result=ErMcpCore.snapshotContext();
            } catch(Exception ex) {outcome='Error';detail=ex.getMessage();response.result=JSON.serialize(new Map<String,Object>{'error'=>detail});}
            ErMcpCore.logCall('Get Snapshot Status',null,outcome,started,detail);
            out.add(response);
        }
        return out;
    }
}