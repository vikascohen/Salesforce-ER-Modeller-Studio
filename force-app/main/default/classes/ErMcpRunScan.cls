global with sharing class ErMcpRunScan {
    global class Request { @InvocableVariable(label='Request reference') global String reference; }
    global class Response { @InvocableVariable(label='Run Scan result JSON') global String result; }
    @InvocableMethod(label='ER Modeller Run Scan' description='Start a new asynchronous Field Usage scan when permitted and outside cooldown.')
    global static List<Response> invoke(List<Request> requests) {
        List<Response> out=new List<Response>();
        for(Request req:requests) {
            Long started=System.now().getTime();String outcome='Success';String detail=null;Response response=new Response();
            try {
                if (!FeatureManagement.checkPermission('ER_MCP_Scan_Operator')) throw new ErMcpCore.InvalidRequestException('Scan operator permission required.');
                MCP_Settings__c config=ErMcpCore.settings();
                ErMcpCore.requireEnabled(config.Scan_Enabled__c);
                List<Field_Usage_Run__c> active=[SELECT Id FROM Field_Usage_Run__c WHERE Status__c IN ('Queued','Running') LIMIT 1];
                if (!active.isEmpty()) throw new ErMcpCore.InvalidRequestException('A scan is already running.');
                List<Field_Usage_Run__c> previous=[SELECT Id,Completed_At__c FROM Field_Usage_Run__c WHERE Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 1];
                Integer hours=config.Cooldown_Hours__c==null?24:config.Cooldown_Hours__c.intValue();
                if (!previous.isEmpty() && previous[0].Completed_At__c!=null && previous[0].Completed_At__c.addHours(hours)>System.now()) throw new ErMcpCore.InvalidRequestException('Scan cooldown has not elapsed.');
                // The V3 orchestrator performs its Tooling API preflight before DML.
                Id runId=FieldUsageOrchestrator.start('MCP');
                response.result=JSON.serialize(new Map<String,Object>{'runId'=>runId,'state'=>'Queued','snapshot'=>JSON.deserializeUntyped(ErMcpCore.snapshotContext())});
            } catch(Exception ex) {outcome='Error';detail=ex.getMessage();response.result=JSON.serialize(new Map<String,Object>{'error'=>detail});}
            // Log only after the orchestrator's preflight, never before its callout.
            ErMcpCore.logCall('Run Scan',null,outcome,started,detail);out.add(response);
        }
        return out;
    }
}