/** Optional, read-only standard OmniStudio configuration scanner. No static Omni sObject references. */
public without sharing class FieldUsageOmniScanner {
    private static final Set<String> ROOTS=new Set<String>{'OmniProcess','OmniDataTransform'};
    private static final Set<String> OBJECT_KEYS=new Set<String>{'object','objectname','objectapiname','sobject','sobjecttype','objecttype'};
    private static final Set<String> FIELD_KEYS=new Set<String>{'field','fieldname','fields','fieldlist'};
    @TestVisible private static Map<String,Set<String>> catalogOverride;
    public interface Reader { List<Map<String,Object>> read(String soql,Map<String,Object> binds); }
    @TestVisible private static Reader readerOverride;
    public class OmniScanException extends Exception {}
    private class SchemaReader implements Reader {
        public List<Map<String,Object>> read(String soql,Map<String,Object> binds){
            List<Map<String,Object>> rows=new List<Map<String,Object>>();
            for(SObject row:Database.queryWithBinds(soql,binds,AccessLevel.USER_MODE))rows.add(row.getPopulatedFieldsAsMap());
            return rows;
        }
    }
    private static Reader reader(){return Test.isRunningTest()&&readerOverride!=null?readerOverride:new SchemaReader();}
    private static Map<String,Set<String>> catalog(){
        if(Test.isRunningTest()&&catalogOverride!=null)return catalogOverride;
        Map<String,Set<String>> out=new Map<String,Set<String>>();Map<String,Schema.SObjectType> gd=Schema.getGlobalDescribe();
        for(String name:new List<String>{'OmniProcess','OmniProcessElement','OmniDataTransform','OmniDataTransformItem'}){
            Schema.SObjectType token=gd.get(name);if(token==null)continue;Schema.DescribeSObjectResult d=token.getDescribe();
            if(!d.isQueryable()||!d.isAccessible())continue;
            Set<String> fields=new Set<String>();for(Schema.SObjectField field:d.fields.getMap().values())if(field.getDescribe().isAccessible())fields.add(field.getDescribe().getName());
            out.put(name,fields);
        }
        return out;
    }
    public static String capabilitySummary(){
        Map<String,Set<String>> availableSchema=catalog();List<String> available=new List<String>();for(String root:ROOTS)if(availableSchema.containsKey(root))available.add(root);
        List<String> managed=new List<String>();for(String name:Schema.getGlobalDescribe().keySet())if(name.endsWith('__omniscript__c')||name.endsWith('__drbundle__c'))managed.add(name);
        return 'OmniStudio: '+(available.isEmpty()?'no readable standard runtime objects; safely skipped':String.join(available,', '))+(managed.isEmpty()?'':'. Managed-package runtime detected; this version does not scan its configuration field variants.');
    }
    public static List<String> discover(){
        List<String> targets=new List<String>();Map<String,Set<String>> availableSchema=catalog();
        for(String objectName:ROOTS){
            if(!availableSchema.containsKey(objectName))continue;
            if(!availableSchema.get(objectName).containsAll(new Set<String>{'Id','Name'}))throw new OmniScanException('OmniStudio definition identity fields are not readable: '+objectName);
            Set<String> fields=availableSchema.get(objectName);
            if(objectName=='OmniProcess'&&!fields.contains('IsActive'))throw new OmniScanException('OmniProcess is present but readable IsActive metadata is unavailable.');
            String soql='SELECT Id'+(objectName=='OmniDataTransform'?',Name':'')+' FROM '+objectName+(fields.contains('IsActive')?' WHERE IsActive = true':'')+' LIMIT 5001';
            List<Map<String,Object>> rows=reader().read(soql,new Map<String,Object>());
            if(rows.size()>5000)throw new OmniScanException('OmniStudio discovery exceeds 5,000 '+objectName+' records. No partial index was accepted.');
            Set<String> mapperNames=new Set<String>();
            for(Map<String,Object> row:rows){
                if(objectName=='OmniDataTransform'){String name=stringValue(row.get('Name'));if(String.isBlank(name)||!mapperNames.add(name.toLowerCase()))throw new OmniScanException('Ambiguous or missing Data Mapper name; select an unambiguous published definition before scanning.');}
                targets.add(objectName+'|'+String.valueOf(row.get('Id')));
            }
        }
        return targets;
    }
    public static List<Field_Usage_Evidence__c> scan(Id runId,String target){
        List<String> parts=target==null?new List<String>():target.split('\\|');
        if(parts.size()!=2||!ROOTS.contains(parts[0])||!Pattern.matches('^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$',parts[1]))throw new OmniScanException('Invalid OmniStudio work target.');
        Map<String,Set<String>> availableSchema=catalog();String root=parts[0];
        if(!availableSchema.containsKey(root))throw new OmniScanException('OmniStudio object is no longer readable: '+root);
        List<String> fields=selectFields(availableSchema.get(root),new List<String>{'Id','Name','IsActive','IsIntegrationProcedure','Type','SubType','Language','OmniProcessKey','PropertySetConfig','SourceObject'});
        List<Map<String,Object>> parents=reader().read('SELECT '+String.join(fields,',')+' FROM '+root+' WHERE Id = :parentId LIMIT 1',new Map<String,Object>{'parentId'=>parts[1]});
        if(parents.isEmpty())throw new OmniScanException('OmniStudio component disappeared or is inaccessible: '+target);
        Map<String,Object> parent=parents[0];if(parent.get('IsActive')==false)return new List<Field_Usage_Evidence__c>();
        String type=root=='OmniDataTransform'?'Omni Data Mapper':parent.get('IsIntegrationProcedure')==true?'Integration Procedure':'OmniScript';
        String canonicalName=stringValue(parent.get('Name'));
        Set<String> names=new Set<String>{canonicalName};
        if(parent.get('Type')!=null&&parent.get('SubType')!=null){canonicalName=String.valueOf(parent.get('Type'))+'_'+String.valueOf(parent.get('SubType'))+(type=='OmniScript'&&parent.get('Language')!=null?'_'+String.valueOf(parent.get('Language')):'');names.add(canonicalName);}
        if(parent.get('OmniProcessKey')!=null)names.add(String.valueOf(parent.get('OmniProcessKey')));
        String child=root=='OmniProcess'?'OmniProcessElement':'OmniDataTransformItem',parentField=root=='OmniProcess'?'OmniProcessId':'OmniDataTransformationId';
        if(!availableSchema.containsKey(child)||!availableSchema.get(child).contains(parentField))throw new OmniScanException('OmniStudio child configuration is unavailable: '+child+'.'+parentField);
        if(root=='OmniProcess'&&!availableSchema.get(child).contains('PropertySetConfig'))throw new OmniScanException('OmniStudio element configuration is not readable.');
        if(root=='OmniDataTransform'&&!availableSchema.get(child).containsAll(new Set<String>{'InputObjectName','InputFieldName','OutputObjectName','OutputFieldName'}))throw new OmniScanException('OmniStudio Data Mapper mapping fields are not readable.');
        List<String> childFields=selectFields(availableSchema.get(child),new List<String>{'Id',parentField,'IsActive','IsDisabled','PropertySetConfig','InputObjectName','InputFieldName','OutputObjectName','OutputFieldName','LookupObjectName','LookupByFieldName','LookupReturnedFieldName'});
        List<Map<String,Object>> children=reader().read('SELECT '+String.join(childFields,',')+' FROM '+child+' WHERE '+parentField+' = :parentId LIMIT 1001',new Map<String,Object>{'parentId'=>parts[1]});
        if(children.size()>1000)throw new OmniScanException('OmniStudio component exceeds 1,000 configuration items: '+target);
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        if(String.isBlank(canonicalName)||canonicalName.length()>255)throw new OmniScanException('OmniStudio component has no usable identity.');
        for(String alias:names)if(!String.isBlank(alias)&&alias.length()<=255&&!alias.equalsIgnoreCase(canonicalName))ObjectUsageScanner.add(runId,type,alias,parts[1],ObjectUsageScanner.sourceType(type),canonicalName,null,'OmniStudio identity alias');
        for(String name:new Set<String>{canonicalName}){
            if(String.isBlank(name)||name=='null'||name.length()>255)continue;
            out.addAll(parseConfig(runId,type,name,parts[1],stringValue(parent.get('PropertySetConfig'))));
            for(Map<String,Object> row:children){
                if(row.get('IsActive')==false||row.get('IsDisabled')==true)continue;
                out.addAll(parseConfig(runId,type,name,parts[1],stringValue(row.get('PropertySetConfig'))));
                for(String direction:new List<String>{'Input','Output','Lookup'}){
                    String objectName=stringValue(row.get(direction+'ObjectName'));
                    if(direction=='Lookup'){
                        addField(out,runId,type,name,parts[1],objectName,stringValue(row.get('LookupByFieldName')),'Data Mapper lookup');
                        addField(out,runId,type,name,parts[1],objectName,stringValue(row.get('LookupReturnedFieldName')),'Data Mapper lookup');
                    }else addField(out,runId,type,name,parts[1],objectName,stringValue(row.get(direction+'FieldName')),'Data Mapper '+direction);
                    ObjectUsageScanner.add(runId,type,name,parts[1],'Object',objectName,null,'OmniStudio '+direction+' object');
                }
                if(out.size()>2000)throw new OmniScanException('OmniStudio component exceeds 2,000 field evidence entries.');
            }
        }
        return out;
    }
    private static List<String> selectFields(Set<String> available,List<String> candidates){List<String> fields=new List<String>();for(String field:candidates)if(available.contains(field))fields.add(field);return fields;}
    private static String stringValue(Object value){return value instanceof String?(String)value:null;}
    @TestVisible private static List<Field_Usage_Evidence__c> parseConfig(Id runId,String type,String name,String id,String config){
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();if(String.isBlank(config))return out;
        if(config.length()>131072)throw new OmniScanException('OmniStudio configuration exceeds supported size.');
        Object node;try{node=JSON.deserializeUntyped(config);}catch(Exception ex){throw new OmniScanException('Invalid OmniStudio JSON for '+name);}
        walk(out,runId,type,name,id,node,null,0);return out;
    }
    private static void walk(List<Field_Usage_Evidence__c> out,Id runId,String type,String name,String id,Object node,String context,Integer depth){
        if(depth>40)throw new OmniScanException('OmniStudio configuration exceeds supported nesting depth.');
        if(node instanceof Map<String,Object>){
            Map<String,Object> mapNode=(Map<String,Object>)node;String objectName=context;
            for(String key:mapNode.keySet())if(OBJECT_KEYS.contains(key.toLowerCase())){String canonical=ObjectUsageScanner.canonical(stringValue(mapNode.get(key)));if(canonical!=null)objectName=canonical;}
            if(objectName!=null)ObjectUsageScanner.add(runId,type,name,id,'Object',objectName,null,'Explicit OmniStudio configuration object');
            for(String key:mapNode.keySet()){
                Object value=mapNode.get(key);String text=stringValue(value),lower=key.toLowerCase();
                if(text!=null){
                    if(FIELD_KEYS.contains(lower))for(String field:text.split(','))addField(out,runId,type,name,id,objectName,field.trim(),'OmniStudio '+key);
                    if(new Set<String>{'bundle','bundlename','dataraptorbundlename'}.contains(lower))ObjectUsageScanner.add(runId,type,name,id,'OmniDataMapper',text,null,'OmniStudio Data Mapper action');
                    if(new Set<String>{'integrationprocedurekey','integrationprocedurename'}.contains(lower))ObjectUsageScanner.add(runId,type,name,id,'IntegrationProcedure',text,null,'OmniStudio Integration Procedure action');
                    if(new Set<String>{'omniscriptkey','reusableomniscriptkey'}.contains(lower))ObjectUsageScanner.add(runId,type,name,id,'OmniScript',text,null,'Reusable OmniScript');
                    if(lower=='remoteclass'&&Pattern.matches('^[A-Za-z_][A-Za-z0-9_]*$',text))ObjectUsageScanner.add(runId,type,name,id,'ApexClass',text,null,'OmniStudio remote Apex class');
                }
                if(FIELD_KEYS.contains(lower)&&value instanceof List<Object>)for(Object field:(List<Object>)value)addField(out,runId,type,name,id,objectName,stringValue(field),'OmniStudio '+key);
                if(value instanceof Map<String,Object>||value instanceof List<Object>)walk(out,runId,type,name,id,value,objectName,depth+1);
            }
        }else if(node instanceof List<Object>)for(Object child:(List<Object>)node)walk(out,runId,type,name,id,child,context,depth+1);
    }
    private static void addField(List<Field_Usage_Evidence__c> out,Id runId,String type,String name,String id,String objectName,String fieldName,String location){
        objectName=ObjectUsageScanner.canonical(objectName);if(objectName==null||String.isBlank(fieldName))return;
        Map<String,Schema.SObjectField> fields=Schema.getGlobalDescribe().get(objectName).getDescribe().fields.getMap();Schema.SObjectField field=fields.get(fieldName);if(field==null)return;
        fieldName=field.getDescribe().getName();out.add(new Field_Usage_Evidence__c(Run__c=runId,Object_API_Name__c=objectName,Field_API_Name__c=fieldName,Field_Key__c=objectName+'.'+fieldName,Source_Type__c=type,Component_Name__c=name,Component_Id__c=id,Location__c=location,Evidence_Type__c='OmniStudio Configuration',Confidence__c='High',Observed_At__c=System.now(),Occurrence_Count__c=1,Evidence__c='Validated static OmniStudio object/field mapping'));
    }
}
