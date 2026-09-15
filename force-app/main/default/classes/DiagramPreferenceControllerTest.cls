/**
 * Tests for DiagramPreferenceController — get/save of the per-user theme
 * preference backed by the Diagram_Studio_Pref__c hierarchy custom setting.
 *
 * @author Vikas Cohen
 */
@isTest
private class DiagramPreferenceControllerTest {

    @isTest
    static void testGetThemeReturnsNullWhenNothingSavedYet() {
        Test.startTest();
        String theme = DiagramPreferenceController.getTheme();
        Test.stopTest();

        Assert.isNull(theme, 'No preference saved yet for this user, so this should be null, not an error');
    }

    @isTest
    static void testSaveThemeThenGetThemeRoundTrips() {
        Test.startTest();
        DiagramPreferenceController.saveTheme('theme-monokai');
        String theme = DiagramPreferenceController.getTheme();
        Test.stopTest();

        Assert.areEqual('theme-monokai', theme);
    }

    @isTest
    static void testSaveThemeTwiceUpdatesRatherThanDuplicating() {
        Test.startTest();
        DiagramPreferenceController.saveTheme('theme-dark-plus');
        DiagramPreferenceController.saveTheme('theme-solarized-light');
        String theme = DiagramPreferenceController.getTheme();
        Test.stopTest();

        Assert.areEqual('theme-solarized-light', theme, 'The second save should overwrite the first, not create a second row');
        Assert.areEqual(
            1,
            [SELECT COUNT() FROM Diagram_Studio_Pref__c WHERE SetupOwnerId = :UserInfo.getUserId()],
            'Exactly one preference row should exist for this user'
        );
    }
}
