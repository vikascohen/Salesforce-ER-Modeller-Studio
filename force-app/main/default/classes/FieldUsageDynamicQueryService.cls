/**
 * @author Vikas Cohen
 */
public inherited sharing class FieldUsageDynamicQueryService {
    public static Boolean objectExists(String objectApiName) { return !String.isBlank(objectApiName) && Schema.getGlobalDescribe().containsKey(objectApiName); }
    public static List<SObject> queryAvailable(String objectApiName,List<String> requestedFields,Integer rowLimit) {
        if(!objectExists(objectApiName)) return new List<SObject>();
        Schema.DescribeSObjectResult d=Schema.getGlobalDescribe().get(objectApiName).getDescribe();
        if(!d.isAccessible()||!d.isQueryable()) return new List<SObject>();
        Map<String,Schema.SObjectField> available=d.fields.getMap(); List<String> fields=new List<String>();
        for(String f:requestedFields) if(available.containsKey(f)&&available.get(f).getDescribe().isAccessible()) fields.add(f);
        if(fields.isEmpty()) return new List<SObject>();
        GenericDynamicSoqlBuilder builder=new GenericDynamicSoqlBuilder(); builder.addSelectSql().addFields(fields).addFromObject(objectApiName).addlimitVal(String.valueOf(Math.max(1,Math.min(rowLimit==null?200:rowLimit,2000))));
        return Database.query(builder.buildSql(),AccessLevel.USER_MODE);
    }
}