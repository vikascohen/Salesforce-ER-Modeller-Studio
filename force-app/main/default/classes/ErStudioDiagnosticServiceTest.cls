/**
 * @author Vikas Cohen
 */
@IsTest
private class ErStudioDiagnosticServiceTest {
    private class SampleException extends Exception {}
    @IsTest static void disabledDoesNotBreakApplication() {
        Test.startTest();
        System.assertEquals(false,ErStudioDiagnosticService.error('Field Usage','Scan','Test error'));
        System.assertEquals(false,ErStudioDiagnosticService.warning('Hosted MCP','Tool','Test warning'));
        System.assertEquals(false,ErStudioDiagnosticService.exception('Studio','Test',new SampleException('test')));
        Test.stopTest();
    }
    @IsTest static void rejectsNonStudioSources() {
        Test.startTest();
        System.assertEquals(false,ErStudioDiagnosticService.error('Unrelated Salesforce App','Transaction','Not a Studio issue'));
        System.assertEquals(false,ErStudioDiagnosticService.warning('Platform Monitor','Limits','Not a Studio issue'));
        Test.stopTest();
    }
    @IsTest static void boundedFailuresNeverThrow() {
        Test.startTest();
        for(Integer i=0;i<20;i++)ErStudioDiagnosticService.error('Studio','Operation '+i,'Failure '+i);
        System.assertEquals(false,ErStudioDiagnosticService.error('Studio','After cap','ignored'));
        Test.stopTest();
    }
}
