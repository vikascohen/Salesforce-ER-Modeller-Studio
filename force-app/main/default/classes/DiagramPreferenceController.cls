/**
 * Per-user theme preference for Diagram Studio, backed by the
 * Diagram_Studio_Pref__c hierarchy custom setting so it follows the user
 * across sessions and devices rather than being tied to one browser
 * (which is all localStorage could ever offer).
 *
 * Custom settings aren't subject to object/field-level security the way
 * regular sObjects are — any Apex in the org can read/write them once the
 * class itself is accessible — so there's no CRUD/FLS check needed here,
 * consistent with how Hierarchy custom settings are always used.
 *
 * @author Vikas Cohen
 */
public with sharing class DiagramPreferenceController {

    // Deliberately NOT cacheable — this is called once per page load, and a
    // client-side cached result (from before the user ever had a saved
    // preference) could otherwise keep winning over a theme saved after
    // that first load, which would look exactly like "my theme choice
    // never sticks."
    @AuraEnabled
    public static String getTheme() {
        Diagram_Studio_Pref__c pref = Diagram_Studio_Pref__c.getInstance(UserInfo.getUserId());
        return (pref != null) ? pref.Theme__c : null;
    }

    @AuraEnabled
    public static void saveTheme(String theme) {
        Diagram_Studio_Pref__c pref = Diagram_Studio_Pref__c.getInstance(UserInfo.getUserId());
        if (pref == null || pref.Id == null) {
            pref = new Diagram_Studio_Pref__c(SetupOwnerId = UserInfo.getUserId());
        }
        pref.Theme__c = theme;
        upsert pref;
    }
}
