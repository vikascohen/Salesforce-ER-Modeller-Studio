/**
 * Backs the "Search for Field Usage" screen. Deliberately Tooling-API-free
 * by explicit choice, not because it was overlooked — see
 * CONTRIBUTING.md's Scope section for the full reasoning, including why
 * a feature that "acts on a field from the outside" is here at all given
 * this app's own stated rule against exactly that. That means Apex
 * classes, Apex triggers, and Page Layouts are NOT covered here and
 * cannot be added without a Named Credential (a real, separate
 * admin-setup decision, not something this class works around).
 *
 * Two real data sources, both plain SOQL, no Tooling API, no Named
 * Credential:
 *   1. FlowDefinitionView — which flows are associated with the OBJECT.
 *      This is object-level, not field-level: Flow's own internal
 *      elements (which field a specific Assignment or Decision element
 *      reads) live inside the flow's Tooling-API-only definition, which
 *      this class deliberately does not reach. Every field on the same
 *      object gets the same flow list for this reason — that is not a
 *      bug, it is the actual limit of what this signal can tell you.
 *   2. OmniProcess / OmniProcessElement — OmniScript and Integration
 *      Procedure definitions, stored as plain custom-object-shaped
 *      records (confirmed via a working `sf data export tree` example,
 *      not guessed), with each element's configuration in a
 *      PropertySetConfig JSON field. Searched as plain text for the
 *      field's own name, which is a real but crude signal: a field
 *      literally named "Name" could false-positive on any element whose
 *      label happens to contain the word "Name". Only the newer Core
 *      OmniStudio schema (OmniProcess/OmniProcessElement) is supported —
 *      older vlocity_cmt__/vlocity_ins__-namespaced installs use a
 *      schema this class has not verified, so those orgs get an honest
 *      "not supported yet" rather than a guessed query that might be
 *      wrong.
 */
public with sharing class FieldUsageController {

    public class FlowHit {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String processType;
    }

    public class OmniHit {
        @AuraEnabled public String omniScriptName;
        @AuraEnabled public String omniScriptType;
        @AuraEnabled public String elementName;
    }

    public class FieldUsageResult {
        @AuraEnabled public String fieldApiName;
        @AuraEnabled public List<FlowHit> objectFlows;      // object-level — same list for every field on this object
        @AuraEnabled public Boolean omniStudioAvailable;    // false if the Core OmniStudio schema isn't installed in this org
        @AuraEnabled public List<OmniHit> omniStudioHits;   // field-level — a real text match for this specific field
    }

    private static Boolean isSafeIdentifier(String s) {
        return s != null && Pattern.matches('^[A-Za-z0-9_]+$', s);
    }

    @AuraEnabled
    public static List<FieldUsageResult> searchFieldUsage(String objectApiName, List<String> fieldApiNames) {
        if (!isSafeIdentifier(objectApiName)) {
            throw new AuraHandledException('Invalid object API name.');
        }
        for (String f : fieldApiNames) {
            if (!isSafeIdentifier(f)) {
                throw new AuraHandledException('Invalid field API name: ' + f);
            }
        }

        List<FlowHit> objectFlows = getFlowsForObject(objectApiName);
        Boolean omniAvailable = isOmniStudioAvailable();

        List<FieldUsageResult> results = new List<FieldUsageResult>();
        for (String fieldName : fieldApiNames) {
            FieldUsageResult r = new FieldUsageResult();
            r.fieldApiName = fieldName;
            r.objectFlows = objectFlows;
            r.omniStudioAvailable = omniAvailable;
            r.omniStudioHits = omniAvailable ? searchOmniStudio(fieldName) : new List<OmniHit>();
            results.add(r);
        }
        return results;
    }

    /**
     * Flow's own filter (TriggerObjectOrEventLabel) is by the object's
     * LABEL, not its API name — the two differ for custom objects (e.g.
     * API name "Order__c", label "Order"), so the label is resolved from
     * describe first rather than passing the API name straight through.
     */
    private static List<FlowHit> getFlowsForObject(String objectApiName) {
        List<FlowHit> hits = new List<FlowHit>();
        try {
            Schema.SObjectType sot = Schema.getGlobalDescribe().get(objectApiName);
            if (sot == null) return hits;
            String objectLabel = sot.getDescribe().getLabel();

            List<FlowDefinitionView> flows = [
                SELECT ApiName, Label, ProcessType
                FROM FlowDefinitionView
                WHERE TriggerObjectOrEventLabel = :objectLabel AND IsActive = true
                LIMIT 200
            ];
            for (FlowDefinitionView fv : flows) {
                FlowHit h = new FlowHit();
                h.apiName = fv.ApiName;
                h.label = fv.Label;
                h.processType = fv.ProcessType;
                hits.add(h);
            }
        } catch (Exception e) {
            // FlowDefinitionView access can be restricted in some orgs —
            // degrade to "no flows found" rather than surface an error
            // for a signal that is inherently best-effort.
        }
        return hits;
    }

    private static Boolean isOmniStudioAvailable() {
        // Only the newer Core OmniStudio schema is checked for — see the
        // class-level comment for why the older vlocity_cmt__/vlocity_ins__
        // namespaces are not guessed at here.
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        return gd.containsKey('OmniProcess') && gd.containsKey('OmniProcessElement');
    }

    private static List<OmniHit> searchOmniStudio(String fieldApiName) {
        List<OmniHit> hits = new List<OmniHit>();
        try {
            String pattern = '%' + fieldApiName + '%';
            // Deliberately fully dynamic (Database.query() returning
            // List<SObject>, fields read via .get() rather than dot
            // notation) rather than statically typed List<OmniProcessElement>
            // as an earlier version of this method used. This isn't just
            // stylistic: Apex compiles an entire class per org, and a
            // class that merely REFERENCES OmniProcessElement/OmniProcess
            // as a static type fails to deploy at all in any org that
            // doesn't have OmniStudio installed -- confirmed directly
            // against a real deployment failure, not a hypothetical, since
            // isOmniStudioAvailable() gating the CALL to this method at
            // runtime does nothing to prevent a compile-time failure that
            // happens regardless of whether the method ever actually runs.
            // Dynamic SOQL sidesteps this entirely: the query itself only
            // fails at runtime (already handled by the catch block below)
            // if these objects genuinely don't exist, rather than blocking
            // the whole class from deploying in the first place.
            List<SObject> elements = Database.query(
                'SELECT Id, Name, OmniProcessId FROM OmniProcessElement WHERE PropertySetConfig LIKE :pattern LIMIT 200'
            );
            if (elements.isEmpty()) return hits;

            Set<Id> processIds = new Set<Id>();
            for (SObject el : elements) processIds.add((Id) el.get('OmniProcessId'));
            Map<Id, SObject> processes = new Map<Id, SObject>(
                Database.query('SELECT Id, Name, Type FROM OmniProcess WHERE Id IN :processIds')
            );

            for (SObject el : elements) {
                SObject p = processes.get((Id) el.get('OmniProcessId'));
                OmniHit h = new OmniHit();
                h.omniScriptName = p != null ? (String) p.get('Name') : '(unknown)';
                h.omniScriptType = p != null ? (String) p.get('Type') : null;
                h.elementName = (String) el.get('Name');
                hits.add(h);
            }
        } catch (Exception e) {
            // Same reasoning as the empty-catch above in getFlowsForObject —
            // a best-effort signal degrades quietly rather than erroring.
        }
        return hits;
    }
}
