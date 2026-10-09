global with sharing class ErMcpGetChangedFields {
    global class Request { @InvocableVariable(label='Request reference') global String reference; }
    global class Response { @InvocableVariable(label='Changed fields JSON') global String result; }
    @InvocableMethod(label='ER Modeller Get Changed Fields' description='Compare dependency evidence across the five most recent successful snapshots.')
    global static List<Response> invoke(List<Request> requests) {
        List<Response> out=new List<Response>();
        for(Request req:requests) {
            Long started=System.now().getTime();String outcome='Success';String detail=null;Response response=new Response();
            try {
                ErMcpCore.requireEnabled(ErMcpCore.settings().Changed_Enabled__c);
                List<Field_Usage_Run__c> runs=[SELECT Id,Completed_At__c FROM Field_Usage_Run__c WHERE Status__c='Completed' ORDER BY Completed_At__c DESC LIMIT 5];
                List<Map<String,Object>> changes=new List<Map<String,Object>>();
                if(runs.size()>1) {
                    Set<Id> runIds=new Set<Id>();for(Field_Usage_Run__c run:runs)runIds.add(run.Id);
                    // Fail rather than silently returning an incomplete change set.
                    Integer total=[SELECT COUNT() FROM Field_Usage_Evidence__c WHERE Run__c IN :runIds];
                    if(total>40000)throw new ErMcpCore.InvalidRequestException('Snapshot history exceeds synchronous comparison limit. Historical diff index required.');
                    Map<Id,Map<String,Set<String>>> evidenceByRun=new Map<Id,Map<String,Set<String>>>();
                    for(Field_Usage_Evidence__c ev:[SELECT Run__c,Field_Key__c,Source_Type__c,Component_Name__c,Component_Id__c,Evidence_Type__c,Location__c FROM Field_Usage_Evidence__c WHERE Run__c IN :runIds LIMIT 40000]) {
                        if(!evidenceByRun.containsKey(ev.Run__c))evidenceByRun.put(ev.Run__c,new Map<String,Set<String>>());
                        Map<String,Set<String>> byField=evidenceByRun.get(ev.Run__c);
                        if(!byField.containsKey(ev.Field_Key__c))byField.put(ev.Field_Key__c,new Set<String>());
                        byField.get(ev.Field_Key__c).add(JSON.serialize(new List<String>{ev.Source_Type__c,ev.Component_Id__c,ev.Component_Name__c,ev.Evidence_Type__c,ev.Location__c}));
                    }
                    for(Integer i=runs.size()-2;i>=0;i--) {
                        Field_Usage_Run__c older=runs[i+1],newer=runs[i];
                        Map<String,Set<String>> before=evidenceByRun.containsKey(older.Id)?evidenceByRun.get(older.Id):new Map<String,Set<String>>();
                        Map<String,Set<String>> after=evidenceByRun.containsKey(newer.Id)?evidenceByRun.get(newer.Id):new Map<String,Set<String>>();
                        Set<String> keys=new Set<String>();keys.addAll(before.keySet());keys.addAll(after.keySet());
                        List<String> sortedKeys=new List<String>();sortedKeys.addAll(keys);sortedKeys.sort();
                        List<Map<String,Object>> fields=new List<Map<String,Object>>();
                        for(String key:sortedKeys) {
                            Set<String> prev=before.containsKey(key)?before.get(key):new Set<String>();
                            Set<String> next=after.containsKey(key)?after.get(key):new Set<String>();
                            Set<String> added=new Set<String>();added.addAll(next);added.removeAll(prev);
                            Set<String> removed=new Set<String>();removed.addAll(prev);removed.removeAll(next);
                            if(!added.isEmpty()||!removed.isEmpty()) {
                                List<String> plus=new List<String>();plus.addAll(added);plus.sort();
                                List<String> minus=new List<String>();minus.addAll(removed);minus.sort();
                                fields.add(new Map<String,Object>{'field'=>key,'added'=>plus,'removed'=>minus,'currentUsageCount'=>next.size()});
                            }
                        }
                        changes.add(new Map<String,Object>{'fromRun'=>older.Id,'fromDate'=>older.Completed_At__c,'toRun'=>newer.Id,'toDate'=>newer.Completed_At__c,'status'=>fields.isEmpty()?'No changes':'Changed','fields'=>fields});
                    }
                }
                response.result=JSON.serialize(new Map<String,Object>{'snapshot'=>JSON.deserializeUntyped(ErMcpCore.snapshotContext()),'successfulRuns'=>runs.size(),'comparisons'=>changes,'note'=>runs.size()<2?'At least two successful scans are required.':'Dependency evidence differences only; scanner coverage changes can affect comparisons.'});
            } catch(Exception ex) {outcome='Error';detail=ex.getMessage();response.result=JSON.serialize(new Map<String,Object>{'error'=>detail});}
            ErMcpCore.logCall('Get Changed Fields',null,outcome,started,detail);out.add(response);
        }
        return out;
    }
}