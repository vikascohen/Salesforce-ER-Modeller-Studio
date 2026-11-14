/** Canonical filenames and sharing-aware, bounded saved-DSL import resolution. */
public with sharing class DslFileService {
    public static String key(String name){
        if(String.isBlank(name))throw new AuraHandledException('Choose a unique diagram filename.');
        String value=name.trim();if(value.contains('/')||value.contains('\\')||value.contains('..')||value.contains('\r')||value.contains('\n')||value.length()>80)throw new AuraHandledException('Use a filename of at most 80 characters, optionally ending in .dsl. Paths are not allowed.');
        return (value.toLowerCase().endsWith('.dsl')?value:value+'.dsl').toLowerCase();
    }
    public static Set<String> imports(String source){
        Set<String> out=new Set<String>();if(source==null)return out;
        Matcher match=Pattern.compile('(?im)^\\s*import\\s+(?:[A-Za-z0-9_]+\\s+from\\s+)?([^\\r\\n]+\\.dsl)\\s*$').matcher(source);
        while(match.find())out.add(key(match.group(1)));if(out.size()>32)throw new AuraHandledException('A DSL file can import at most 32 files.');return out;
    }
    private static Map<String,Object> bindingMap(String jsonText){if(String.isBlank(jsonText))return new Map<String,Object>();try{return (Map<String,Object>)JSON.deserializeUntyped(jsonText);}catch(Exception ex){throw new AuraHandledException('Saved DSL import bindings are invalid.');}}
    private static Map<String,Diagram_File__c> resolveDirect(Set<String> names,Map<String,Object> old){
        Map<String,Diagram_File__c> out=new Map<String,Diagram_File__c>();if(names.isEmpty())return out;
        Set<String> variants=new Set<String>(),boundIds=new Set<String>();for(String name:names){variants.add(name);variants.add(name.substring(0,name.length()-4));if(old.containsKey(name))boundIds.add(String.valueOf(old.get(name)));}
        List<Diagram_File__c> rows=[SELECT Id,Name,File_Key__c,Source_Code__c,Import_Bindings__c FROM Diagram_File__c WHERE Id IN :boundIds OR File_Key__c IN :names OR Name IN :variants WITH USER_MODE];
        for(String name:names){
            List<Diagram_File__c> matches=new List<Diagram_File__c>();for(Diagram_File__c row:rows){
                if(old.containsKey(name)){if(String.valueOf(row.Id)==String.valueOf(old.get(name)))matches.add(row);}
                else if((row.File_Key__c!=null&&row.File_Key__c==name)||(row.Name!=null&&key(row.Name)==name))matches.add(row);
            }
            if(matches.size()!=1)throw new AuraHandledException('Import '+name+' is missing, inaccessible or ambiguous.');out.put(name,matches[0]);
        }
        return out;
    }
    private static Map<String,Object> ownerBindings(Id owner){
        if(owner==null)return new Map<String,Object>();List<Diagram_File__c> rows=[SELECT Import_Bindings__c FROM Diagram_File__c WHERE Id=:owner WITH USER_MODE LIMIT 1];
        if(rows.isEmpty())throw new AuraHandledException('The importing diagram is missing or inaccessible.');return bindingMap(rows[0].Import_Bindings__c);
    }
    public static Map<String,String> bind(Id ownerId,String source){
        Map<String,String> out=new Map<String,String>();Set<String> names=imports(source);if(names.isEmpty())return out;
        Map<String,Diagram_File__c> targets=resolveDirect(names,ownerBindings(ownerId));
        for(String name:targets.keySet())out.put(name,String.valueOf(targets.get(name).Id));return out;
    }
    @AuraEnabled public static String resolveImports(Id fileId,String sourceCode){
        Map<String,Object> files=new Map<String,Object>(),edges=new Map<String,Object>();String root=fileId==null?'@root':String.valueOf(fileId);
        List<String> queue=new List<String>{root};Map<String,String> sources=new Map<String,String>{root=>sourceCode};
        Map<String,Map<String,Object>> savedBindings=new Map<String,Map<String,Object>>{root=>ownerBindings(fileId)};Set<String> seen=new Set<String>();Integer bytes=sourceCode==null?0:sourceCode.length();
        for(Integer offset=0;offset<queue.size();offset++){
            String owner=queue[offset];if(!seen.add(owner))continue;if(seen.size()>32)throw new AuraHandledException('DSL import graph exceeds 32 files.');
            Map<String,Diagram_File__c> targets=resolveDirect(imports(sources.get(owner)),savedBindings.get(owner));
            for(String name:targets.keySet()){
                Diagram_File__c row=targets.get(name);String target=String.valueOf(row.Id);edges.put(owner+'|'+name,target);
                if(!files.containsKey(target)){
                    bytes+=row.Source_Code__c==null?0:row.Source_Code__c.length();if(bytes>1048576)throw new AuraHandledException('Imported DSL exceeds 1 MB.');
                    files.put(target,new Map<String,Object>{'id'=>target,'name'=>row.Name,'sourceCode'=>row.Source_Code__c});sources.put(target,row.Source_Code__c);savedBindings.put(target,bindingMap(row.Import_Bindings__c));queue.add(target);
                }
            }
        }
        return JSON.serialize(new Map<String,Object>{'files'=>files,'edges'=>edges});
    }
}
