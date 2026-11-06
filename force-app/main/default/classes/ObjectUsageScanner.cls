/** V5 object and component evidence, kept separate from field-usage counts. */
public without sharing class ObjectUsageScanner {
    public static Boolean enabled = false;
    private static Map<String,Object_Usage_Evidence__c> pending = new Map<String,Object_Usage_Evidence__c>();
    public static void reset(Boolean active) { enabled=active; pending.clear(); }
    public static List<Object_Usage_Evidence__c> rows() { return pending.values(); }
    public static String canonical(String candidate) {
        if(String.isBlank(candidate))return null;
        Schema.SObjectType token=Schema.getGlobalDescribe().get(candidate);
        return token==null?null:token.getDescribe().getName();
    }
    public static String sourceType(String value) {
        if(value=='Apex Class')return 'ApexClass';
        if(value=='Apex Trigger')return 'ApexTrigger';
        if(value=='LWC')return 'LightningComponentBundle';
        if(value=='Aura')return 'AuraDefinitionBundle';
        return value;
    }
    public static void add(Id runId,String source,String name,String componentId,String targetType,String target,String entry,String reason) {
        if(!enabled||String.isBlank(target)||String.isBlank(name))return;
        if(targetType=='Object') { target=canonical(target); if(target==null)return; }
        if(source=='LWC'||source=='Aura')name=name.substringBefore(' / ');
        String key=sourceType(source)+'|'+name+'|'+targetType+'|'+target+'|'+String.valueOf(entry);
        pending.put(key,new Object_Usage_Evidence__c(Run__c=runId,Source_Type__c=sourceType(source),Component_Name__c=name.left(255),Component_Id__c=componentId,Target_Type__c=targetType,Target_Name__c=target.left(255),Entry_Object__c=entry,Evidence__c=reason.left(4000)));
    }
    public static void fromFields(Id runId,List<Field_Usage_Evidence__c> fields) {
        if(!enabled)return;
        for(Field_Usage_Evidence__c row:fields)add(runId,row.Source_Type__c,row.Component_Name__c,row.Component_Id__c,'Object',row.Object_API_Name__c,null,'Validated field reference: '+row.Field_Key__c);
    }
    public static void apex(Id runId,String source,String name,String componentId,String body) {
        if(!enabled||String.isBlank(body))return;
        apexCode(runId,source,name,componentId,FieldUsageApexScanner.stripCommentsAndStrings(body));
    }
    public static void apexCode(Id runId,String source,String name,String componentId,String code) {
        if(!enabled||String.isBlank(code))return;
        String entry;
        Matcher triggerMatch=Pattern.compile('(?i)\\btrigger\\s+\\w+\\s+on\\s+(\\w+)').matcher(code);
        if(triggerMatch.find())entry=canonical(triggerMatch.group(1));
        // Contextual tokens only: do not treat every variable named Account as a type.
        List<Pattern> patterns=new List<Pattern>{
            Pattern.compile('(?i)\\b(?:from|new|on)\\s+([A-Za-z_][A-Za-z0-9_]*)\\b'),
            Pattern.compile('(?i)\\b(?:List|Set)\\s*<\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*>'),
            Pattern.compile('(?i)\\bMap\\s*<[^,<>]+,\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*>'),
            Pattern.compile('\\b([A-Za-z_][A-Za-z0-9_]*)\\s+[A-Za-z_][A-Za-z0-9_]*\\s*(?:[=;,)({]|$)'),
            Pattern.compile('(?i)\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*(?:SObjectType|Fields)\\b')
        };
        for(Pattern pattern:patterns){Matcher m=pattern.matcher(code);while(m.find())add(runId,source,name,componentId,'Object',m.group(1),entry,'Static Apex object reference: '+m.group(0).left(250));}
        if(entry!=null)add(runId,source,name,componentId,'Object',entry,entry,'Trigger entry object');
    }
    public static void lwc(Id runId,String name,String componentId,String body) {
        if(!enabled||String.isBlank(body))return;
        // Strip JS and HTML comments before inspecting literal imports and properties.
        String code=stripUiComments(body);
        Matcher schema=Pattern.compile('@salesforce/schema/([A-Za-z_][A-Za-z0-9_]*)').matcher(code);
        while(schema.find())add(runId,'LWC',name,componentId,'Object',schema.group(1),null,'Salesforce schema import');
        Matcher objectName=Pattern.compile('(?i)(?:object-api-name|objectApiName)\\s*[:=]\\s*[\'\"]([A-Za-z_][A-Za-z0-9_]*)[\'\"]').matcher(code);
        while(objectName.find())add(runId,'LWC',name,componentId,'Object',objectName.group(1),null,'Literal object API name');
        Matcher apex=Pattern.compile('@salesforce/apex/([A-Za-z_][A-Za-z0-9_]*)\\.').matcher(code);
        while(apex.find())add(runId,'LWC',name,componentId,'ApexClass',apex.group(1),null,'Apex import');
        Matcher child=Pattern.compile('<c-([a-z][a-z0-9-]*)[\\s/>]').matcher(code);
        while(child.find()){
            List<String> parts=child.group(1).split('-');String target=parts[0];
            for(Integer i=1;i<parts.size();i++)target+=parts[i].substring(0,1).toUpperCase()+parts[i].substring(1);
            add(runId,'LWC',name,componentId,'LightningComponentBundle',target,null,'Nested LWC tag');
        }
    }
    private static String stripUiComments(String body) {
        List<String> output=new List<String>();Integer state=0;String quote;
        for(Integer i=0;i<body.length();i++){
            String ch=body.substring(i,i+1),next=i+1<body.length()?body.substring(i+1,i+2):'';
            if(state==1){if(ch=='\n'){state=0;output.add(ch);}else output.add(' ');continue;}
            if(state==2){if(ch=='*'&&next=='/'){output.add('  ');i++;state=0;}else output.add(ch=='\n'?ch:' ');continue;}
            if(state==3){output.add(ch);if(ch=='\\'&&i+1<body.length()){output.add(next);i++;}else if(ch==quote)state=0;continue;}
            if(ch=='/'&&next=='/'){output.add('  ');i++;state=1;}
            else if(ch=='/'&&next=='*'){output.add('  ');i++;state=2;}
            else if(ch=='\''||ch=='"'||ch=='`'){quote=ch;state=3;output.add(ch);}
            else output.add(ch);
        }
        return String.join(output,'').replaceAll('(?s)<!--.*?-->',' ');
    }
    public static void flow(Id runId,String name,String componentId,Object metadata) {
        if(!enabled||metadata==null)return;
        String entry;
        if(metadata instanceof Map<String,Object>){
            Map<String,Object> root=(Map<String,Object>)metadata;
            if(root.get('start') instanceof Map<String,Object>){Map<String,Object> start=(Map<String,Object>)root.get('start');if(start.containsKey('triggerType')||start.containsKey('recordTriggerType'))entry=canonical((String)start.get('object'));}
        }
        walkFlow(runId,name,componentId,metadata,entry);
    }
    private static void walkFlow(Id runId,String name,String componentId,Object node,String entry) {
        if(node instanceof Map<String,Object>){
            Map<String,Object> item=(Map<String,Object>)node;
            for(String key:item.keySet()){
                Object value=item.get(key);
                if(value instanceof String){
                    if(new Set<String>{'object','objectName','sObjectType','recordObject','objectType'}.contains(key))add(runId,'Flow',name,componentId,'Object',(String)value,entry,'Flow metadata: '+key);
                    if(key=='flowName')add(runId,'Flow',name,componentId,'Flow',(String)value,entry,'Subflow reference');
                    if(key=='actionName'&&item.get('actionType')=='apex')add(runId,'Flow',name,componentId,'ApexClass',(String)value,entry,'Invocable Apex action');
                    if(key=='extensionName'&&((String)value).startsWith('c:'))add(runId,'Flow',name,componentId,'LightningComponentBundle',((String)value).substring(2),entry,'Flow screen component');
                }
                walkFlow(runId,name,componentId,value,entry);
            }
        }else if(node instanceof List<Object>)for(Object child:(List<Object>)node)walkFlow(runId,name,componentId,child,entry);
    }
}
