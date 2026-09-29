public without sharing class FieldUsageFormulaScanner {
    public static List<Field_Usage_Evidence__c> scan(Id runId,String objectName) {
        List<Field_Usage_Evidence__c> out=new List<Field_Usage_Evidence__c>();
        Schema.SObjectType typ=Schema.getGlobalDescribe().get(objectName);
        if(typ==null) return out;
        Map<String,Schema.SObjectField> fields=typ.getDescribe().fields.getMap();
        for(String formulaField:fields.keySet()) {
            Schema.DescribeFieldResult fd=fields.get(formulaField).getDescribe();
            String formula=fd.getCalculatedFormula();
            if(String.isBlank(formula)) continue;
            for(String candidate:fields.keySet()) {
                if(candidate==formulaField) continue;
                if(containsToken(formula,candidate)) out.add(new Field_Usage_Evidence__c(
                    Run__c=runId,Field_Key__c=objectName+'.'+candidate,Object_API_Name__c=objectName,Field_API_Name__c=candidate,
                    Source_Type__c='Formula Field',Component_Name__c=formulaField,Evidence_Type__c='Formula Reference',
                    Evidence__c=formula.left(32000),Confidence__c='High',Observed_At__c=System.now()));
            }
        }
        return out;
    }
    @TestVisible private static Boolean containsToken(String source,String token) {
        return Pattern.compile('(?i)(^|[^A-Za-z0-9_])'+Pattern.quote(token)+'([^A-Za-z0-9_]|$)').matcher(source).find();
    }
}