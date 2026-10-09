@IsTest
private class ErMcpFieldUsageServiceTest {
    @IsTest static void paginatesOneSnapshotWithoutSkippingRows() {
        Field_Usage_Run__c run=new Field_Usage_Run__c(
            Status__c='Completed',Is_Current__c=true,Completed_At__c=System.now()
        );
        insert run;
        List<Field_Usage_Evidence__c> evidence=new List<Field_Usage_Evidence__c>();
        for(Integer i=0;i<3;i++) {
            evidence.add(new Field_Usage_Evidence__c(
                Run__c=run.Id,Field_Key__c='Account.Name',
                Object_API_Name__c='Account',Field_API_Name__c='Name',
                Source_Type__c='Apex Class',Component_Name__c='Class'+i,
                Evidence_Type__c='Apex Source Reference',Confidence__c='High',
                Observed_At__c=System.now(),Occurrence_Count__c=1
            ));
        }
        insert evidence;
        Test.startTest();
        ErMcpFieldUsageService.Page first=ErMcpFieldUsageService.readPage('Account.Name',null,null,2);
        System.assertEquals(2,first.rows.size());
        System.assertEquals(true,first.hasMore);
        System.assertNotEquals(null,first.nextCursor);
        ErMcpFieldUsageService.Page second=ErMcpFieldUsageService.readPage('Account.Name',String.valueOf(first.snapshotId),first.nextCursor,2);
        System.assertEquals(1,second.rows.size());
        System.assertEquals(false,second.hasMore);
        System.assertEquals(null,second.nextCursor);
        System.assertNotEquals(first.rows[1].Id,second.rows[0].Id);
        Test.stopTest();
    }

    @IsTest static void rejectsStaleSnapshotAndUnboundCursor() {
        Field_Usage_Run__c run=new Field_Usage_Run__c(
            Status__c='Completed',Is_Current__c=true,Completed_At__c=System.now()
        );
        insert run;
        Boolean staleRejected=false;
        try {
            ErMcpFieldUsageService.readPage('Account.Name','a00000000000001AAA',null,2);
        } catch(ErMcpCore.InvalidRequestException ex) { staleRejected=true; }
        System.assertEquals(true,staleRejected);

        Boolean missingSnapshotRejected=false;
        try {
            ErMcpFieldUsageService.readPage('Account.Name',null,String.valueOf(run.Id),2);
        } catch(ErMcpCore.InvalidRequestException ex) { missingSnapshotRejected=true; }
        System.assertEquals(true,missingSnapshotRejected);
    }
}
