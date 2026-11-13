/** Field metadata failures are evidence of limited coverage, independent of scan success. */
public without sharing class FieldUsageSchemaAccess {
    @TestVisible private static Set<String> unavailableForTest=new Set<String>();
    private static Map<String,Map<String,String>> skipped=new Map<String,Map<String,String>>();
    private static void remember(String objectName,String fieldName,String reason){
        if(String.isBlank(objectName)||String.isBlank(fieldName))return;
        if(!skipped.containsKey(objectName))skipped.put(objectName,new Map<String,String>());
        skipped.get(objectName).put(fieldName.toLowerCase(),reason);
    }
    public static void skipObject(String objectName,String reason){remember(objectName,'*',reason);}
    public static Schema.DescribeFieldResult describeField(Schema.SObjectField token){return describeField(token,null,null);}
    public static Schema.DescribeFieldResult describeField(Schema.SObjectField token,String objectName,String fieldName){
        if(token==null)return null;
        try{
            Schema.DescribeFieldResult d=token.getDescribe();
            objectName=d.getSObjectType().getDescribe().getName();
            fieldName=d.getName();
            if(!d.isAccessible()||(Test.isRunningTest()&&unavailableForTest.contains(String.valueOf(token)))){
                remember(objectName,fieldName,'Read');return null;
            }
            d.getType();d.isCalculated();d.getCalculatedFormula();d.getRelationshipName();d.getReferenceTo();
            return d;
        }catch(System.SObjectException ex){
            if(objectName==null||fieldName==null){
                Matcher match=Pattern.compile('([A-Za-z][A-Za-z0-9_]*)[.]([A-Za-z][A-Za-z0-9_]*)').matcher(ex.getMessage());
                if(match.find()){objectName=match.group(1);fieldName=match.group(2);}
            }
            remember(objectName,fieldName,'Metadata');return null;
        }
    }
    public static String fieldName(Schema.SObjectField token){Schema.DescribeFieldResult d=describeField(token);return d==null?null:d.getName();}
    public static Map<String,String> canonicalNames(Map<String,Schema.SObjectField> fields){
        Map<String,String> names=new Map<String,String>();for(Schema.SObjectField token:fields.values()){String n=fieldName(token);if(n!=null)names.put(n.toLowerCase(),n);}return names;
    }
    public static Map<String,String> unpack(String payload){
        Map<String,String> entries=new Map<String,String>();
        if(payload!=null)for(String line:payload.split('\n')){Integer i=line.indexOf('|');if(i>0)entries.put(line.substring(0,i),line.substring(i+1));}
        return entries;
    }
    public static void persistWarnings(Id runId){
        if(runId==null||skipped.isEmpty())return;
        Field_Usage_Run__c run=[SELECT Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:runId FOR UPDATE];
        Set<String> objects=skipped.keySet();
        Map<String,List<Field_Usage_Skip__c>> stored=new Map<String,List<Field_Usage_Skip__c>>();
        for(Field_Usage_Skip__c row:[SELECT Object_Name__c,Entries__c,Skip_Key__c FROM Field_Usage_Skip__c WHERE Run__c=:runId AND Object_Name__c IN :objects ORDER BY Skip_Key__c]){
            if(!stored.containsKey(row.Object_Name__c))stored.put(row.Object_Name__c,new List<Field_Usage_Skip__c>());
            stored.get(row.Object_Name__c).add(row);
        }
        List<Field_Usage_Skip__c> writes=new List<Field_Usage_Skip__c>();
        List<String> messages=new List<String>();
        for(String name:objects){
            List<Field_Usage_Skip__c> chunks=stored.get(name);
            if(chunks==null)chunks=new List<Field_Usage_Skip__c>();
            Map<String,String> fresh=skipped.get(name);
            for(Field_Usage_Skip__c chunk:chunks)for(String known:unpack(chunk.Entries__c).keySet())fresh.remove(known);
            if(fresh.isEmpty())continue;
            List<String> ordered=new List<String>(fresh.keySet());ordered.sort();
            Field_Usage_Skip__c current=chunks.isEmpty()?null:chunks[chunks.size()-1];
            Integer chunkIndex=chunks.size();
            if(current!=null){current.Entry_Count__c=unpack(current.Entries__c).size();writes.add(current);}
            String message='';
            for(String f:ordered){
                if(current==null||current.Entries__c.length()>125000){
                    current=new Field_Usage_Skip__c(Run__c=runId,Object_Name__c=name,Skip_Key__c=runId+'|'+name+'|'+String.valueOf(chunkIndex++).leftPad(5,'0'),Entries__c='',Entry_Count__c=0);writes.add(current);
                }
                if(String.isNotEmpty(current.Entries__c)&&!current.Entries__c.endsWith('\n'))current.Entries__c+='\n';
                current.Entries__c+=f+'|'+fresh.get(f)+'\n';current.Entry_Count__c++;
                if(message.length()>2700){messages.add(message);message='';}
                message+=(message==''?'':', ')+name+'.'+f;
            }
            if(message!='')messages.add(message);
        }
        if(!writes.isEmpty()){
            upsert writes;
            String marker='[Schema coverage] SCAN_SKIP:'+runId;
            if(run.Progress_Log__c==null||!run.Progress_Log__c.contains(marker)){
                run.Progress_Log__c=marker+' — skipped metadata recorded. Review Health Check.\n'+(run.Progress_Log__c==null?'':run.Progress_Log__c.left(31500));
                update run;
            }
            for(String message:messages)ErStudioDiagnosticService.warning('Field Usage','Scan coverage','SCAN_SKIP:'+runId+' '+message);
        }
        skipped.clear();
    }
}
