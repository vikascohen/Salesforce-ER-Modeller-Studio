/** Scans Aura markup/controller/helper resources for explicit object.field references. */
public without sharing class FieldUsageAuraScanner {
    private static final Pattern QUALIFIED_FIELD=Pattern.compile('(?i)\\b([A-Za-z_][A-Za-z0-9_]*(?:__c|__e|__mdt)?)\\.([A-Za-z_][A-Za-z0-9_]*(?:__c)?)\\b');
    public static List<Field_Usage_Evidence__c> scan(Id runId,String componentName,String componentId,String body){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();if(String.isBlank(body))return out;
        Map<String,Schema.SObjectType> gd=Schema.getGlobalDescribe();Map<String,Integer> counts=new Map<String,Integer>();Map<String,List<Integer>> lines=new Map<String,List<Integer>>();Matcher m=QUALIFIED_FIELD.matcher(body);
        while(m.find()){String objectName=canonicalObject(gd,m.group(1));if(objectName==null)continue;String fieldName=canonicalField(gd.get(objectName).getDescribe().fields.getMap(),m.group(2));if(fieldName==null)continue;String key=objectName+'.'+fieldName;counts.put(key,(counts.containsKey(key)?counts.get(key):0)+1);if(!lines.containsKey(key))lines.put(key,new List<Integer>());Integer line=lineNumber(body,m.start());if(!lines.get(key).contains(line))lines.get(key).add(line);}
        for(String key:counts.keySet()){Integer dot=key.indexOf('.');String obj=key.substring(0,dot),field=key.substring(dot+1);out.add(new Field_Usage_Evidence__c(Run__c=runId,Field_Key__c=key,Object_API_Name__c=obj,Field_API_Name__c=field,Source_Type__c='Aura',Component_Name__c=componentName,Component_Id__c=componentId,Evidence_Type__c='Aura Source Reference',Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=counts.get(key),Location__c='Aura: '+componentName+formatLines(lines.get(key)),Evidence__c=snippets(body,lines.get(key))));}
        return out;
    }
    private static Integer lineNumber(String s,Integer offset){Integer line=1;for(Integer i=0;i<offset&&i<s.length();i++)if(s.substring(i,i+1)=='\n')line++;return line;}
    private static String formatLines(List<Integer> lines){if(lines==null||lines.isEmpty())return '';List<String> s=new List<String>();for(Integer n:lines)s.add(String.valueOf(n));return ' · line'+(lines.size()>1?'s ':' ')+String.join(s,', ');}
    private static String snippets(String body,List<Integer> lines){List<String> source=body.split('\\n',-1),out=new List<String>();for(Integer i=0;i<Math.min(8,lines.size());i++){Integer n=lines[i];if(n>0&&n<=source.size())out.add('Line '+n+': '+source[n-1].trim());}return String.join(out,'\n').left(32000);}
    private static String canonicalObject(Map<String,Schema.SObjectType> gd,String candidate){for(String n:gd.keySet())if(n.equalsIgnoreCase(candidate))return gd.get(n).getDescribe().getName();return null;}
    private static String canonicalField(Map<String,Schema.SObjectField> fields,String candidate){for(String n:fields.keySet())if(n.equalsIgnoreCase(candidate))return fields.get(n).getDescribe().getName();return null;}
}
