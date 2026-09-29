// 
// * 1.0    18th Feb 2022	  Vikas Cohen Vasudevan     Library to build dynamic Soql string in Apex,
//                                                            Added Null check
//                                                            Added Date,string and Int check 	
//
// * 1.1    13th June 2022	  Vikas Cohen Vasudevan    Refactored some code and added support for 
//                                                             Datatime, boolean and double
//                                                             
// * 1.2    3rd  sept 2022	  Vikas Cohen Vasudevan    Included resetnull option for list filter, Now you dont have to
//                                                     specify donullcheck for list.It will sort itself behind the scene.
//  * 1.3   15th Nov  2023	  Vikas Cohen Vasudevan    Added Sosl support and Querystore support to store query result.
//                                                     Added Soqlresult and Soslresult method to builder pattern                                            

public  inherited sharing class GenericDynamicSoqlBuilder 
{
    private class CacheEntry
    {
        String query;
        List<sObject> result;
        DateTime expirationTime;
        
        public CacheEntry(String query, List<sObject> result, DateTime expirationTime)
        {
            this.query = query;
            this.result = result;
            this.expirationTime = expirationTime;
        }
    }
    public class QueryStore
    {
        private  Map<String, CacheEntry> queryCache = new Map<String, CacheEntry>();
        private  Integer MAX_CACHE_SIZE = 100; // Adjust the size as needed
        
        public  String getCachedQuery(String key)
        {
            CacheEntry entry = queryCache.get(key);
            if (entry != null && entry.expirationTime > DateTime.now())
            {
                return entry.query;
            }
            // Remove expired or non-existent entry
            queryCache.remove(key);
            return null;
        }
        
        public  List<sObject> getCachedResult(String key)
        {
            CacheEntry entry = queryCache.get(key);
            
            if (entry != null && entry.expirationTime > DateTime.now())
            {
                return entry.result;
            }
            // Remove expired or non-existent entry
            queryCache.remove(key);
            return null;
        }
        
        public  void cacheQuery(String key, String query, List<sObject> result, Integer ttlMinutes)
        {
            DateTime expirationTime = DateTime.now().addMinutes(ttlMinutes);
            CacheEntry entry = new CacheEntry(query, result, expirationTime);
            // Check if the cache has reached its limit
            if (queryCache.size() >= MAX_CACHE_SIZE)
            {
                
                // Remove the least recently used entry
                String lruKey = queryCache.keySet().iterator().next();
                queryCache.remove(lruKey);
            }
            
            queryCache.put(key, entry);
            
        }
        
        public  void clearCache()
        {
            queryCache.clear();
        }
        
        public  void removeCachedQuery(String key)
        {
            queryCache.remove(key);
        }
    }
    
    
    
    private  Class KEYSQLDataType
    {
        private  final String STRINGTYPE= 'S';
        private  final  String INTTYPE= 'I';
        private  final  String DATETYPE = 'D';
        private  final  String DATETIMETYPE = 'DT';
        private  final  String BOOLEANTYPE = 'B';
        private  final  String DOUBLETYPE= 'DO';
    }
    
    
    private class MainGenericSqlConst
    {
        private final String ANDSTR= 'and';
        private final String ORSTR= 'or';
        private final String WHERESTR= 'where';
        private final String SELECTSTR= 'select';
        private final String STARTBRACSTR= '(';
        private final String ENDBRACSTR= ')';
        private final String FROMSTR= 'from';
        private final String COMMASTR= ',';
        private final String DOUBLEBLANKSPACE= ' ';
        private final String EQUALSTR= '=';
        private final String INSTR= 'in';
        private final String LIMITSTR = 'limit';
        private final String NOTEQUALSTR = '!=';
        private final String NULLSTR = 'null';
        private final String GREATERTHAN = '>';
        private final String LESSTHAN = '<';
        private final String GREATERTHANEQ = '>=';
        private final String LESSTHANEQ = '<=';
    }
    @testvisible
    private  MainGenericSqlConst genericSqlConst = new MainGenericSqlConst();
    @testvisible
    private   KeySQLDataType  sqlDataType = new KeySQLDataType();
    protected  string Sqlstring='';
    private  list<string> surroundingBrackets = new List<string>{'(', ')'};
    private string dateFormat= 'yyyy-MM-dd';//default format
    private boolean notNullValue= true;
    @testvisible
    private QueryStore  queryStorecontainer =new QueryStore();
    
    @testvisible
    public  QueryStore getQueryStore()
    {
        return queryStorecontainer;
    }
    @testvisible
    private string parseIndividualValue(object fieldValue, string TypeVal)
    {
        string Result;
        if (TypeVal== SQLDataType.STRINGTYPE)
            Result= '\''+  string.valueOf(fieldValue)+ '\'';
        else if (TypeVal== SQLDataType.DATETYPE)
        {
            Date value =  Date.valueOf(fieldValue);
            Result= DateTime.newInstance(value.year(),value.month(),value.day()).format(DateFormat);
            
        }
        else if (TypeVal== SQLDataType.INTTYPE)
        {
            integer value = integer.valueOf(fieldValue);
            Result= string.valueOf(value);
        }
        else if (TypeVal==SQLDataType.DATETIMETYPE)
        {
            datetime value = datetime.valueOf(fieldValue);
            Result= string.valueOfGmT(value);
        }// avoid using boolean in list coz it make no sense to filter with in (true,false) use single field select instead
        else if (TypeVal==SQLDataType.BOOLEANTYPE)
        {
            boolean value = boolean.valueOf(fieldValue);
            Result= string.valueof(value);
        }
        
        else if (TypeVal==SQLDataType.DOUBLETYPE)
        {
            double value = double.valueOf(fieldValue);
            Result= string.valueof(value);
        }
        return Result;
    }
    @testvisible
    private list<string> parseValueList(List<object> fieldValueList, string TypeVal )
    {
        list<string> quotedFieldListValue = new list<string>();
        for (object o : fieldValueList)
        {
            quotedFieldListValue.add(parseIndividualValue(o,TypeVal));
            
        }
        return quotedFieldListValue;
    }
    
    public virtual string getDateType()
    {
        return SQLDataType.DATETYPE;
    }
    public virtual String getStringType()
    {
        return SQLDataType.STRINGTYPE;
    }   
    public virtual String getDateTimeType()
    {
        return SQLDataType.DATETIMETYPE;
    } 
    
    public virtual string getIntType()
    {
        return SQLDataType.INTTYPE;
    }
    public virtual string getBooleanType()
    {
        return SQLDataType.BOOLEANTYPE;
    }
    public virtual string getDoubleType()
    {
        return SQLDataType.DOUBLETYPE;
    }
    
    
    //  return select string 
    public virtual GenericDynamicSoqlBuilder  addSelectSql()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.SELECTSTR;
        return this;
    }
    //  append from object string to existing sql string  
    public virtual GenericDynamicSoqlBuilder  addFromObject(string objectName)
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.FROMSTR+ genericSqlConst.DOUBLEBLANKSPACE+ objectName;
        return this;
    }
    //  append comma seperated fields to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addFields(list<string> fieldName)
    {
        
        if (notNullValue)
        {
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE + string.join(fieldName, genericSqlConst.COMMASTR);
        }
        return this;
    }
    //add all fields 
    public virtual GenericDynamicSoqlBuilder  addAllFields(string ObjectName)
    { 
        if (notNullValue)
        {
            Type t = Type.forName(ObjectName);
            SObject sobj = (SObject) t.newInstance();
            
            DescribeSObjectResult describeResult = sobj.getSObjectType().getDescribe();
            List<String> fieldNames = new List<String>( describeResult.fields.getMap().keySet() );
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE + string.join(fieldNames, genericSqlConst.COMMASTR) + ' from '+ ObjectName;
        }
        return this;
    }
    
    //  if condition is specified notNullValue is ignored.This is used if you dont want to check for null logic in field values
    public virtual GenericDynamicSoqlBuilder  addWhereClause(list<string> Condition)
    {
        if (Condition?.size()>0)
        {
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE + genericSqlConst.WHERESTR+ genericSqlConst.DOUBLEBLANKSPACE+
                string.join(Condition,'');
        }
        else{
            if (notNullValue)
                Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE + genericSqlConst.WHERESTR;
        }
        return this;
    }
    
    
    
    //  append  "(" string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addStartBracket()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.STARTBRACSTR;
        return this;
    }
    //  append  ")" string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addEndBracket()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ENDBRACSTR;
        return this;
    }
    
    //  append  "and" string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addAndClause()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ANDSTR;
        return this;
    }
    //  append  "or" string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addOrclause()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ORSTR;
        return this;
    }
    
    
    //  append  and string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addEqualVal()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.EQUALSTR;
        return this;
    }
    //  append  in string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addInVal()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.INSTR;
        return this;
    }
    //  append  fieldValueList to existing sql string which ends with in 
    public virtual GenericDynamicSoqlBuilder  addWhereFieldVal(list<object> fieldValueList, string TypeVal)
    {
        if (notNullValue){
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ string.join(ParseValueList(fieldValueList,TypeVal), genericSqlConst.COMMASTR);
            
        }
        return this;
    }
    //  append  fieldValue to existing sql string which ends with in 
    public virtual GenericDynamicSoqlBuilder  addWhereFieldVal(object fieldValue, string TypeVal)
    {
        if (notNullValue){
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ parseIndividualValue(fieldValue, TypeVal);
        }
        return this;
    }
    
    //  append  comma string to existing sql string 
    public virtual GenericDynamicSoqlBuilder  addComma()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.COMMASTR;
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder getAddString()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ANDSTR;
        return this; 
    }
    public virtual GenericDynamicSoqlBuilder getOrString()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ORSTR;
        return this;  
    }
    
    //  Return build Sql string
    public virtual string buildSql()  
    {
        return Sqlstring;
    }
    public virtual void clear()
    {
        Sqlstring = '';
        DateFormat= 'yyyy-MM-dd'; //assign default format
    }
    
    public virtual void addDateFormat(string formatStr)
    {
        DateFormat = formatStr;
    }
    public virtual GenericDynamicSoqlBuilder addlimitVal(string Value)
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.LIMITSTR+ genericSqlConst.DOUBLEBLANKSPACE + Value;
        RETURN this;
    }
    
    public virtual GenericDynamicSoqlBuilder addnull()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.NULLSTR;
        RETURN this;
    }
    public virtual GenericDynamicSoqlBuilder addNotEqual()
    {
        if (notNullValue)
            Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.NOTEQUALSTR;
        RETURN this;
    }
    public virtual GenericDynamicSoqlBuilder doNullCheck(object valueStr)
    {
        notNullValue= true;
        if (valueStr==null)
        {
            notNullValue = false;
        }
        return this;
        
    }
    public virtual GenericDynamicSoqlBuilder doNullCheck(list<object> valueStr)
    {
        notNullValue= true;
        if ((valueStr==null) ||(valueStr.size()==0))
        {
            notNullValue = false;
        }
        return this;
        
    }
    public virtual GenericDynamicSoqlBuilder addResetNullCheck()
    {
        notNullValue= true;
        return this;
    }
    @testvisible
    private virtual string getFormattedString(string stringValue, boolean addSurroundingBracket )
    {
        if (addSurroundingBracket)
            
            stringValue = string.format(stringValue, surroundingBrackets);
        else  
            stringValue = string.format(stringValue, new list<string> {'', ''});
        return stringValue;
    }
    
    public virtual GenericDynamicSoqlBuilder addAndCondition(string ConditionString, boolean addSurroundingBracket)
    {
        if (!notNullValue)
            return this;
        sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ANDSTR+genericSqlConst.DOUBLEBLANKSPACE+ 
            '{0}'+ ConditionString+ '{1}';
        sqlString = getFormattedString(sqlstring,addSurroundingBracket);
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder addAndCondition(string FieldName,list<object> fieldValueList, string TypeVal,boolean addSurroundingBracket,string conditionSign)
    {
        doNullCheck(fieldValueList);
        // and (fieldname in(value)) 
        if (((fieldValueList==null) ||(fieldValueList.size()==0)) && (!notNullValue))
        {
            addResetNullCheck();
            return this;
        }
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ANDSTR+genericSqlConst.DOUBLEBLANKSPACE+ 
            '{0}'+ FieldName + genericSqlConst.DOUBLEBLANKSPACE+  conditionSign+ genericSqlConst.DOUBLEBLANKSPACE+
            genericSqlConst.STARTBRACSTR+string.join(ParseValueList(fieldValueList,TypeVal), genericSqlConst.COMMASTR)+ genericSqlConst.ENDBRACSTR+
            '{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    public virtual GenericDynamicSoqlBuilder  addOrCondition(string ConditionString, boolean addSurroundingBracket)
    {
        if (!notNullValue)
            return this;
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ORSTR+genericSqlConst.DOUBLEBLANKSPACE+ 
            '{0}'+ ConditionString+ '{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    public virtual GenericDynamicSoqlBuilder addOrCondition(string FieldName,list<object> fieldValueList, string TypeVal, boolean addSurroundingBracket,string conditionSign)
    {
        doNullCheck(fieldValueList);
        //OR (fieldname in(value))  
        if (((fieldValueList==null) ||(fieldValueList.size()==0))&& (!notNullValue))
        {
            addResetNullCheck();
            return this;
        }
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ORSTR+genericSqlConst.DOUBLEBLANKSPACE+ 
            '{0}'+ FieldName + genericSqlConst.DOUBLEBLANKSPACE+  conditionSign+ genericSqlConst.DOUBLEBLANKSPACE+
            genericSqlConst.STARTBRACSTR+string.join(ParseValueList(fieldValueList,TypeVal), genericSqlConst.COMMASTR)+ genericSqlConst.ENDBRACSTR+'{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder addCondition(string fieldName, object fieldValueList, string TypeVal ,boolean addSurroundingBracket,string conditionSign)
    {
        if (!notNullValue)
            return this;
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ '{0}'+ fieldName + genericSqlConst.DOUBLEBLANKSPACE+  conditionSign+ genericSqlConst.DOUBLEBLANKSPACE+
            parseIndividualValue(fieldValueList,TypeVal)+genericSqlConst.DOUBLEBLANKSPACE+'{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    public virtual GenericDynamicSoqlBuilder addCondition(string FieldName,list<object> fieldValueList, string TypeVal, 
                                                          boolean addSurroundingBracket,string conditionSign)
    {
        doNullCheck(fieldValueList);
        //OR (fieldname in(value))  
        if (((fieldValueList==null) ||(fieldValueList.size()==0))&& (!notNullValue))
        {
            addResetNullCheck();
            return this;
        }
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ '{0}'+ FieldName + genericSqlConst.DOUBLEBLANKSPACE+  conditionSign+ genericSqlConst.DOUBLEBLANKSPACE+
            genericSqlConst.STARTBRACSTR+string.join(ParseValueList(fieldValueList,TypeVal), genericSqlConst.COMMASTR)+ genericSqlConst.ENDBRACSTR+'{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        
        return this;
        
    }
    
    
    public virtual GenericDynamicSoqlBuilder addAndCondition(string fieldName, object fieldValueList, string TypeVal ,boolean addSurroundingBracket,string conditionSign)
    {
        if (!notNullValue)
            return this;
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ANDSTR+genericSqlConst.DOUBLEBLANKSPACE+ 
            '{0}'+ fieldName + genericSqlConst.DOUBLEBLANKSPACE+  conditionSign+ genericSqlConst.DOUBLEBLANKSPACE+
            parseIndividualValue(fieldValueList,TypeVal)+genericSqlConst.DOUBLEBLANKSPACE+'{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder addOrCondition(string fieldName, object fieldValueList, string TypeVal ,boolean addSurroundingBracket,string conditionSign)
    {
        if (!notNullValue)
            return this;  
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ genericSqlConst.ORSTR+genericSqlConst.DOUBLEBLANKSPACE+ 
            '{0}'+ FieldName + genericSqlConst.DOUBLEBLANKSPACE+  conditionSign+ genericSqlConst.DOUBLEBLANKSPACE+
            parseIndividualValue(fieldValueList,TypeVal)+'{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder addCondition(string ConditionString,boolean addSurroundingBracket)
    {
        if (!notNullValue)
            return this;
        Sqlstring = Sqlstring + '{0}'+ genericSqlConst.DOUBLEBLANKSPACE+ConditionString +'{1}';
        sqlString = getFormattedString(Sqlstring,addSurroundingBracket);
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder addSoslSearch(String searchTerm)
    {
        if (notNullValue)
        {
            Sqlstring =  'FIND \'' + searchTerm + '\' IN ALL FIELDS Returning ';
        }
        return this;
    }
    
    public virtual GenericDynamicSoqlBuilder addSoslSearchInObjects(string objectname, list<string> fieldnames, boolean addcomma)
    {   if (fieldnames?.size()>0)
    {
        Sqlstring = Sqlstring + genericSqlConst.DOUBLEBLANKSPACE+ objectname+ genericSqlConst.STARTBRACSTR + 
            String.join(fieldnames, ',')+ genericSqlConst.ENDBRACSTR;
        if (addcomma)
        {
            Sqlstring = Sqlstring+ genericSqlConst.COMMASTR;
        }
    }
     
     
     return this;
    }
    public virtual GenericDynamicSoqlBuilder soqlResult(boolean UserMode, list<sobject> result)
    {
        result= new list<sobject>();
        if (UserMode)
        {
            result.addall(database.query(Sqlstring,AccessLevel.USER_MODE));
        }
        else 
            result.addall(database.query(Sqlstring,AccessLevel.SYSTEM_MODE));
        return this;
        
    }
    public virtual GenericDynamicSoqlBuilder soslResult( list<list<sobject>> result)
    {
        result= new list<list<sobject>>() ;
        result.addall(search.query(Sqlstring));
        return this;
        
    }
    
    
    
    
    public virtual string getEqualSign()
    {
        return genericSqlConst.EQUALSTR;
    }
    public virtual string  getInSign()
    {
        return genericSqlConst.INSTR;
    }
    public virtual string  getGreaterThanSign()
    {
        return genericSqlConst.GREATERTHAN;
    }
    public virtual string  getLessThanSign()
    {
        return genericSqlConst.LESSTHAN;
    }
    public virtual string getGreaterThanEqualSign()
    {
        return genericSqlConst.GREATERTHANEQ;
    }
    public virtual string getLessThanEqualSign()
    {
        return genericSqlConst.LESSTHANEQ;
    }
    
    
    
    
}
