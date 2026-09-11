/**
 * Read only schema introspection used by the ER Diagram Builder LWC.
 * Returns object and field metadata, including relationship type
 * (Master Detail, Lookup, Polymorphic Lookup) for reference fields.
 *
 * @author Vikas Cohen
 */
public with sharing class SchemaMetadataController {

    public class FieldWrap {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String dataType;
        @AuraEnabled public Boolean isRelationship;
        @AuraEnabled public String relatesTo;
        @AuraEnabled public String relationshipType;
        @AuraEnabled public Boolean required;
    }

    public class ObjectWrap {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public List<FieldWrap> fields;
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getAllObjectNames() {
        List<String> names = new List<String>();
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        for (String key : gd.keySet()) {
            Schema.DescribeSObjectResult dr = gd.get(key).getDescribe();
            if (dr.isAccessible() && dr.isQueryable()) {
                names.add(dr.getName());
            }
        }
        names.sort();
        return names;
    }

    @AuraEnabled(cacheable=true)
    public static List<ObjectWrap> describeObjects(List<String> objectApiNames) {
        List<ObjectWrap> result = new List<ObjectWrap>();
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();

        for (String rawName : objectApiNames) {
            String key = rawName.trim().toLowerCase();
            if (!gd.containsKey(key)) {
                continue;
            }
            Schema.DescribeSObjectResult dr = gd.get(key).getDescribe();

            ObjectWrap ow = new ObjectWrap();
            ow.apiName = dr.getName();
            ow.label = dr.getLabel();
            ow.fields = new List<FieldWrap>();

            Map<String, Schema.SObjectField> fieldsMap = dr.fields.getMap();
            List<String> fieldKeys = new List<String>(fieldsMap.keySet());
            fieldKeys.sort();

            for (String fKey : fieldKeys) {
                Schema.DescribeFieldResult fdr = fieldsMap.get(fKey).getDescribe();
                if (!fdr.isAccessible()) {
                    continue;
                }

                FieldWrap fw = new FieldWrap();
                fw.apiName = fdr.getName();
                fw.label = fdr.getLabel();
                fw.dataType = String.valueOf(fdr.getType());
                fw.required = (!fdr.isNillable() && fdr.isCreateable());
                fw.isRelationship = false;

                if (fdr.getType() == Schema.DisplayType.REFERENCE) {
                    List<Schema.SObjectType> refs = fdr.getReferenceTo();
                    if (!refs.isEmpty()) {
                        fw.isRelationship = true;

                        if (fdr.isNamePointing() || refs.size() > 1) {
                            // Polymorphic, e.g. Task.WhoId / WhatId
                            fw.relatesTo = refs[0].getDescribe().getName();
                            fw.relationshipType = 'Polymorphic Lookup';
                        } else {
                            fw.relatesTo = refs[0].getDescribe().getName();
                            // getRelationshipOrder() is non null (0 or 1) only for
                            // Master Detail fields, null for plain Lookups.
                            fw.relationshipType = (fdr.getRelationshipOrder() != null)
                                ? 'Master-Detail'
                                : 'Lookup';
                        }
                    }
                }
                ow.fields.add(fw);
            }
            result.add(ow);
        }
        return result;
    }
}
