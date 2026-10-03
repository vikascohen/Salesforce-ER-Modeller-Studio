public with sharing class DataDictionaryFieldDetailController {
    public class FieldDetail {
        @AuraEnabled public String objectApiName;
        @AuraEnabled public String fieldApiName;
        @AuraEnabled public String label;
        @AuraEnabled public String dataType;
        @AuraEnabled public String formula;
        @AuraEnabled public Boolean formulaField;
        @AuraEnabled public Boolean rollupSummary;
        @AuraEnabled public Boolean relationship;
        @AuraEnabled public String relationshipType;
        @AuraEnabled public String relationshipName;
        @AuraEnabled public List<String> relatedObjects;
        @AuraEnabled public Boolean externalRelationship;
        @AuraEnabled public String detailMessage;
    }

    @AuraEnabled(cacheable=true)
    public static FieldDetail getFieldDetail(String objectApiName, String fieldApiName) {
        if (String.isBlank(objectApiName) || String.isBlank(fieldApiName)) {
            throw new AuraHandledException('Object and field API names are required.');
        }

        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        Schema.SObjectType objectType = globalDescribe.get(objectApiName.trim());
        if (objectType == null) {
            objectType = globalDescribe.get(objectApiName.trim().toLowerCase());
        }
        if (objectType == null) {
            throw new AuraHandledException('Object not found: ' + objectApiName);
        }

        Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
        Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();
        Schema.SObjectField fieldToken = fieldMap.get(fieldApiName.trim());
        if (fieldToken == null) {
            fieldToken = fieldMap.get(fieldApiName.trim().toLowerCase());
        }
        if (fieldToken == null) {
            throw new AuraHandledException('Field not found: ' + objectApiName + '.' + fieldApiName);
        }

        Schema.DescribeFieldResult fd = fieldToken.getDescribe();
        FieldDetail out = new FieldDetail();
        out.objectApiName = objectDescribe.getName();
        out.fieldApiName = fd.getName();
        out.label = fd.getLabel();
        out.dataType = String.valueOf(fd.getType());
        out.formula = fd.getCalculatedFormula();
        out.formulaField = fd.isCalculated() && !String.isBlank(out.formula);
        out.rollupSummary = fd.isCalculated() && String.isBlank(out.formula);
        out.relationship = fd.getType() == Schema.DisplayType.REFERENCE;
        out.relationshipName = fd.getRelationshipName();
        out.relatedObjects = new List<String>();
        out.externalRelationship = false;

        if (out.relationship) {
            List<Schema.SObjectType> refs = fd.getReferenceTo();
            for (Schema.SObjectType refType : refs) {
                String target = refType.getDescribe().getName();
                out.relatedObjects.add(target);
                if (target != null && target.toLowerCase().endsWith('__x')) {
                    out.externalRelationship = true;
                }
            }
            if (fd.isNamePointing() || refs.size() > 1) {
                out.relationshipType = 'Polymorphic Lookup';
            } else if (fd.getRelationshipOrder() != null || fd.isCascadeDelete()) {
                out.relationshipType = 'Master-Detail';
            } else if (out.externalRelationship || objectDescribe.getName().toLowerCase().endsWith('__x')) {
                out.relationshipType = 'External / Indirect Lookup';
            } else {
                out.relationshipType = 'Lookup';
            }
            out.detailMessage = out.relatedObjects.isEmpty()
                ? 'Relationship target metadata is not exposed for this field.'
                : 'Linked to ' + String.join(out.relatedObjects, ', ') + '.';
        } else if (out.formulaField) {
            out.relationshipType = null;
            out.detailMessage = 'Calculated formula field. The complete formula is shown below.';
        } else if (out.rollupSummary) {
            out.relationshipType = null;
            out.detailMessage = 'Roll-Up Summary field detected. Salesforce Apex describe identifies the field as a roll-up but does not expose the complete roll-up criteria/aggregate definition.';
        } else {
            out.detailMessage = 'No additional relationship or calculated-field metadata applies to this field.';
        }
        return out;
    }
}