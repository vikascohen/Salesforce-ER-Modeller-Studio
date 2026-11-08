/** Capability-safe field metadata access. No industry objects are statically referenced. */
public without sharing class FieldUsageSchemaAccess {
    @TestVisible private static Set<String> unavailableForTest=new Set<String>();
    private static Set<String> skipped=new Set<String>();
    private static void note(String value){if(skipped.size()<100)skipped.add(value.left(250));}
    public static Schema.DescribeFieldResult describeField(Schema.SObjectField token){
        if(token==null)return null;
        String key=String.valueOf(token);
        if(Test.isRunningTest()&&unavailableForTest.contains(key)){note(key);return null;}
        try{
            Schema.DescribeFieldResult d=token.getDescribe();
            // Probe the metadata used by scanners inside the same protected boundary.
            key=d.getSObjectType().getDescribe().getName()+'.'+d.getName();
            if(!d.isAccessible()){note(key);return null;}
            d.getType();d.isCalculated();d.getCalculatedFormula();d.getRelationshipName();d.getReferenceTo();
            return d;
        }catch(System.SObjectException ex){note(ex.getMessage());return null;}
    }
    public static String fieldName(Schema.SObjectField token){Schema.DescribeFieldResult d=describeField(token);return d==null?null:d.getName();}
    public static Map<String,String> canonicalNames(Map<String,Schema.SObjectField> fields){
        Map<String,String> names=new Map<String,String>();
        for(String key:fields.keySet()){String name=fieldName(fields.get(key));if(name!=null)names.put(key.toLowerCase(),name);}
        return names;
    }
    public static void persistWarnings(Id runId){
        if(runId==null||skipped.isEmpty())return;
        List<String> names=new List<String>(skipped);names.sort();
        String message='[Schema coverage] Unavailable field metadata skipped (up to 100 per transaction): '+String.join(names,', ')+'. Readable fields were still scanned.';
        Field_Usage_Run__c run=[SELECT Progress_Log__c FROM Field_Usage_Run__c WHERE Id=:runId FOR UPDATE];
        String prior=String.isBlank(run.Progress_Log__c)?'':run.Progress_Log__c+'\n';
        run.Progress_Log__c=(prior+message).left(31900);update run;skipped.clear();
    }
}
