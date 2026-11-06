trigger DiagramFileNames on Diagram_File__c (before insert,before update) {
    Set<String> keys=new Set<String>(),variants=new Set<String>();Map<String,Diagram_File__c> pending=new Map<String,Diagram_File__c>();Set<Id> ids=new Set<Id>();
    for(Diagram_File__c row:Trigger.new){
        try{row.File_Key__c=DslFileService.key(row.Name);row.Name=row.Name.trim();}catch(Exception ex){row.addError(ex.getMessage());continue;}
        String key=row.File_Key__c;keys.add(key);variants.add(key);variants.add(key.substring(0,key.length()-4));if(row.Id!=null)ids.add(row.Id);
        if(pending.containsKey(key)){row.addError('A diagram with this filename already exists. Choose a unique name.');pending.get(key).addError('A diagram with this filename already exists. Choose a unique name.');}pending.put(key,row);
    }
    // Internal uniqueness check includes inaccessible legacy rows; never disclose their names.
    for(Diagram_File__c row:[SELECT Id,Name,File_Key__c FROM Diagram_File__c WHERE (File_Key__c IN :keys OR Name IN :variants) AND Id NOT IN :ids]){
        String key=row.File_Key__c;if(key==null){try{key=DslFileService.key(row.Name);}catch(Exception ignored){continue;}}
        if(pending.containsKey(key))pending.get(key).addError('A diagram with this filename already exists. Choose a unique name.');
    }
}
