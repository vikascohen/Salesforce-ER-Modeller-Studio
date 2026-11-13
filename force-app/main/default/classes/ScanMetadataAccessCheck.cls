/** Read-only Health Check: setup metadata and Describe only; never queries business records. */
public with sharing class ScanMetadataAccessCheck {
    public class Gap {
        @AuraEnabled public String objectName; @AuraEnabled public String fieldName;
        @AuraEnabled public String issue; @AuraEnabled public String action;
        public Gap(String o,String f,String i,String a){objectName=o;fieldName=f;issue=i;action=a;}
    }
    public class Result {
        public Boolean detected=false,partial=false; public Integer objects=0,fields=0,totalGaps=0,eligibleGaps=0;
        public String note; public List<Gap> gaps=new List<Gap>();
    }
    @TestVisible private static Set<String> objectsOverride;
    private static void add(Result r,String o,String f,String issue){
        r.totalGaps++;
        if(r.gaps.size()>=100){r.partial=true;return;}
        String action=issue=='Object Read missing'?'Setup > Permission Sets > Diagram Studio User > Object Settings > '+o+': Object Permissions > Read.':
            issue=='Field Read missing'?'Setup > Permission Sets > Diagram Studio User > Object Settings > '+o+': Field Permissions > '+f+' > Read Access.':
            'Verify applicable licence and metadata availability first. If configurable: Setup > Permission Sets > Diagram Studio User > Object Settings > '+o+'. Review object Read and field Read Access.';
        r.gaps.add(new Gap(o,f,issue,action));
    }
    public static Result inspect(){
        Result r=new Result();Set<String> names=new Set<String>();
        if(Test.isRunningTest()&&objectsOverride!=null){names.addAll(objectsOverride);r.detected=!names.isEmpty();}
        else{
            IndustryAccessController.Discovery available=IndustryAccessController.discover();
            r.detected=available.detected;r.partial=available.partial;r.note=available.message;names.addAll(available.objects);
        }
        if(!r.detected||names.isEmpty())return r;
        List<String> ordered=new List<String>(names);ordered.sort();
        Integer priority=ordered.indexOf('BenefitDisbursement');
        if(priority>=0){ordered.remove(priority);ordered.add(0,'BenefitDisbursement');}
        if(ordered.size()>50){r.partial=true;while(ordered.size()>50)ordered.remove(ordered.size()-1);}
        IndustryAccessController.Grants grants=IndustryAccessController.grantsFor(new Set<String>(ordered));
        Map<String,Schema.SObjectType> types=Schema.getGlobalDescribe();
        Integer cpuEnd=Limits.getCpuTime()+3500;
        for(String name:ordered){
            if(r.fields>=8000||Limits.getCpuTime()>cpuEnd){r.partial=true;break;}
            if(types.get(name)==null)continue;
            r.objects++;
            IndustryAccessController.ObjectReview review=IndustryAccessController.compare(name,types.get(name),grants,8000 - r.fields,cpuEnd);
            r.fields+=review.inspectedFields;r.partial=r.partial||review.partial;
            if(review.needsObjectRead){add(r,name,'—','Object Read missing');r.eligibleGaps++;}
            for(IndustryAccessController.Item item:review.fields){
                add(r,name,item.name,item.eligible?'Field Read missing':'Metadata unavailable');
                if(item.eligible)r.eligibleGaps++;
            }
        }
        return r;
    }
}
