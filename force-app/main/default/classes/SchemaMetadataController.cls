/**
 * Read only schema introspection used by the ER Diagram Builder LWC and
 * the Data Dictionary. Returns object and field metadata, including
 * relationship type (Master Detail, Lookup, Polymorphic Lookup) for
 * reference fields, and — for the dictionary specifically — field
 * descriptions, last-modified dates, and on-demand field usage
 * percentages.
 *
 * @author Vikas Cohen
 */
public with sharing class SchemaMetadataController {

    public class FieldWrap {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String dataType;
        @AuraEnabled public Boolean isRelationship;
        @AuraEnabled public String relatesTo;
        @AuraEnabled public String relationshipType;
        @AuraEnabled public Boolean required;
        @AuraEnabled public Boolean isCustom;
        @AuraEnabled public Boolean isPrimaryKey;
        @AuraEnabled public Boolean isRollupSummary; // computed on both describe paths — see isRollupSummaryField()
        @AuraEnabled public String friendlyType;     // Setup-style label for plain (non-relationship) fields only — computed on both describe paths, additive alongside the raw dataType above, which stays untouched for describeObjects() (DSL) callers that already depend on its exact format
        @AuraEnabled public String description;      // Data Dictionary only — from FieldDefinition
        @AuraEnabled public String lastModifiedDate; // Data Dictionary only — from FieldDefinition, yyyy-MM-dd
    }

    public class ObjectWrap {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public Boolean isCustom;
        @AuraEnabled public List<FieldWrap> fields;
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getAllObjectNames() {
        List<String> names = new List<String>();
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        for (String key : gd.keySet()) {
            Schema.DescribeSObjectResult dr = gd.get(key).getDescribe();
            // Deliberately NOT gated on dr.isAccessible() — this tool is a
            // schema/structure viewer, not a data viewer, so it's shown to
            // every user of the tool regardless of their own object
            // permissions in the org; restricting it defeats the point of
            // an ER diagram tool (see docs/SECURITY.md). isQueryable() stays
            // -- that's a capability of the object itself (some system
            // objects are describe-only), not a per-user permission, and
            // dropping it would surface objects nothing else in this app
            // can actually do anything useful with.
            if (dr.isQueryable()) {
                names.add(dr.getName());
            }
        }
        names.sort();
        return names;
    }

    @AuraEnabled(cacheable=true)
    public static List<ObjectWrap> describeObjects(List<String> objectApiNames) {
        return describeObjectsInternal(objectApiNames, false);
    }

    /**
     * Same as describeObjects, but also prepends a synthetic "Id" row
     * (isPrimaryKey = true) to each object's field list — used by the Data
     * Dictionary, which wants to show the primary key explicitly. The
     * regular describeObjects() output is left exactly as it always was,
     * so DSL parsing/intellisense/relationship-linter/drift-check — which
     * all assume "Id" is implicit and never appears in the field list —
     * are completely unaffected by this addition.
     */
    @AuraEnabled(cacheable=false)
    public static List<ObjectWrap> describeObjectsForDictionary(List<String> objectApiNames) {
        List<ObjectWrap> objects = describeObjectsInternal(objectApiNames, true);
        enrichWithFieldDefinitions(objects);
        return objects;
    }

    private static List<ObjectWrap> describeObjectsInternal(List<String> objectApiNames, Boolean includePrimaryKeyRow) {
        List<ObjectWrap> result = new List<ObjectWrap>();
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();

        for (String rawName : objectApiNames) {
            if (rawName == null) {
                continue;
            }
            String key = rawName.trim().toLowerCase();
            if (!gd.containsKey(key)) {
                continue;
            }
            Schema.DescribeSObjectResult dr = gd.get(key).getDescribe();

            ObjectWrap ow = new ObjectWrap();
            ow.apiName = dr.getName();
            ow.label = dr.getLabel();
            ow.isCustom = dr.isCustom();
            ow.fields = new List<FieldWrap>();

            if (includePrimaryKeyRow) {
                FieldWrap pk = new FieldWrap();
                pk.apiName = 'Id';
                pk.label = 'Record ID';
                pk.dataType = 'ID';
                pk.isRelationship = false;
                pk.required = false;
                pk.isCustom = false;
                pk.isPrimaryKey = true;
                pk.isRollupSummary = false;
                pk.friendlyType = 'ID';
                ow.fields.add(pk);
            }

            // Authoritative relationship-type source, straight from Setup's own
            // metadata catalog — sidesteps a describe-API quirk where
            // getRelationshipOrder()/isCascadeDelete() can both fail to flag a
            // genuine Master-Detail field (confirmed on CartItem.CartId, a
            // standard Salesforce Commerce object). Used as an override below
            // when present; the existing describe-based logic remains as a
            // fallback for any field FieldDefinition doesn't return a row for.
            Map<String, String> fieldDefRelationshipType = getRelationshipTypesFromFieldDefinition(ow.apiName);

            Map<String, Schema.SObjectField> fieldsMap = dr.fields.getMap();
            List<String> fieldKeys = new List<String>(fieldsMap.keySet());
            fieldKeys.sort();

            for (String fKey : fieldKeys) {
                Schema.DescribeFieldResult fdr = fieldsMap.get(fKey).getDescribe();
                // Deliberately NOT gated on fdr.isAccessible() — same reasoning
                // as getAllObjectNames() above: every field on an object shown
                // to one user of this tool is shown to every user of it,
                // regardless of that specific user's own field-level security
                // elsewhere in the org. This is a structure viewer, not a
                // data viewer (see docs/SECURITY.md).

                FieldWrap fw = new FieldWrap();
                fw.apiName = fdr.getName();
                fw.label = fdr.getLabel();
                fw.dataType = String.valueOf(fdr.getType()); // raw Apex enum — kept as-is for describeObjects() (DSL) callers
                // required is a real, reported bug fix, not the original
                // "not nillable alone" version -- that version marked every
                // Checkbox field (DoNotCall, IsEmailBounced...) and every
                // true system field (CreatedDate, LastModifiedDate,
                // SystemModstamp, IsDeleted) as required on every single
                // object, which is wrong and was visibly wrong on canvas.
                // Two things were missing:
                //   1. Checkbox fields are EXCLUDED entirely. A checkbox can
                //      never be null by platform design (confirmed directly
                //      against Salesforce's own help docs: "a checkbox field
                //      is inherently required because it cannot be null") --
                //      isNillable() returning false for a Checkbox is a
                //      platform artifact, not a "you must fill this in"
                //      signal the way it is for a Text or Number field.
                //   2. isCreateable() is back as an AND condition. The
                //      earlier version deliberately dropped it, reasoning
                //      that two different users could see two different
                //      Required flags on the same field based on their own
                //      FLS -- a real concern for a custom field where an
                //      admin has revoked Create access for one profile.
                //      But CreatedDate/LastModifiedDate/SystemModstamp/
                //      IsDeleted are TRUE system fields: read-only for
                //      every user, always, with no FLS toggle that could
                //      ever make them createable for anyone (confirmed
                //      against Salesforce's own system-fields
                //      documentation) -- isCreateable() for these is a
                //      structural fact of the field, not a per-viewer FLS
                //      fact, so it does not reintroduce the same
                //      per-viewer inconsistency for THOSE fields. It could,
                //      in principle, still do so for a genuinely required
                //      custom field with Create FLS deliberately revoked
                //      for one profile -- a real but far rarer edge case,
                //      and the right tradeoff against every standard
                //      object showing several fields incorrectly marked
                //      required for every user, which is what shipped
                //      without this.
                fw.required = fdr.getType() != Schema.DisplayType.BOOLEAN
                    && !fdr.isNillable()
                    && fdr.isCreateable();
                fw.isRelationship = false;
                fw.isCustom = fdr.isCustom();
                fw.isPrimaryKey = false;
                fw.isRollupSummary = isRollupSummaryField(fdr); // cheap (no extra query) — computed unconditionally on both describe paths

                if (fdr.getType() == Schema.DisplayType.REFERENCE) {
                    List<Schema.SObjectType> refs = fdr.getReferenceTo();
                    if (!refs.isEmpty()) {
                        fw.isRelationship = true;

                        if (fdr.isNamePointing() || refs.size() > 1) {
                            // Polymorphic, e.g. Task.WhoId / WhatId
                            fw.relatesTo = refs[0].getDescribe().getName();
                            fw.relationshipType = 'Polymorphic Lookup';
                        } else {
                            fw.relatesTo = refs[0].getDescribe().getName();

                            // FieldDefinition.DataType override, when available —
                            // this is Setup's own classification, straight from
                            // the metadata catalog, so it wins over the
                            // describe-based heuristics below when both exist.
                            String overrideType = fieldDefRelationshipType.get(fw.apiName);
                            if (overrideType != null) {
                                fw.relationshipType = overrideType;
                            } else {
                                // getRelationshipOrder() (non-null only for Master-Detail)
                                // is the standard signal for CUSTOM Master-Detail fields.
                                // isCascadeDelete() is a second, independently
                                // documented signal for that same underlying behavior.
                                // Kept as a fallback for any field FieldDefinition
                                // doesn't return a row for.
                                fw.relationshipType = (fdr.getRelationshipOrder() != null || fdr.isCascadeDelete())
                                    ? 'Master-Detail'
                                    : 'Lookup';
                            }
                        }
                    }
                }

                // Friendly type for plain (non-relationship) fields only —
                // relationship fields already carry their type info via
                // relationshipType/relatesTo, shown separately by callers.
                if (!fw.isRelationship) {
                    fw.friendlyType = friendlyDataType(fdr, null);
                }

                // The Data Dictionary wants Setup's actual field-type labels
                // (Text, Number, Lookup Relationship...), not the raw Apex
                // enum name — only overwrite dataType here, on the dictionary
                // path, so describeObjects() (DSL parsing/intellisense/import/
                // linter/drift-check) never sees a different dataType format.
                if (includePrimaryKeyRow) {
                    fw.dataType = friendlyDataType(fdr, fw.relationshipType);
                }

                ow.fields.add(fw);
            }
            result.add(ow);
        }
        return result;
    }

    /**
     * Field-level relationship type straight from Setup's own metadata
     * catalog (FieldDefinition.DataType), e.g. "Master-Detail(Cart)" or
     * "Lookup(Account)". More reliable than the describe-API signals
     * (getRelationshipOrder()/isCascadeDelete()) for some standard/managed
     * objects. Returns only the fields FieldDefinition has a relationship
     * DataType for — callers fall back to describe-based logic for
     * anything missing from this map. One query per object (same SOQL
     * restrictions as EntityDefinition — no IN/OR/NOT/LIMIT), wrapped so a
     * failure here doesn't break the rest of describe.
     */
    private static Map<String, String> getRelationshipTypesFromFieldDefinition(String objectApiName) {
        Map<String, String> result = new Map<String, String>();
        try {
            List<FieldDefinition> defs = [
                SELECT QualifiedApiName, DataType
                FROM FieldDefinition
                WHERE EntityDefinition.QualifiedApiName = :objectApiName
            ];
            for (FieldDefinition fd : defs) {
                if (fd.DataType == null) {
                    continue;
                }
                if (fd.DataType.startsWith('Master-Detail')) {
                    result.put(fd.QualifiedApiName, 'Master-Detail');
                } else if (fd.DataType.startsWith('Lookup')) {
                    result.put(fd.QualifiedApiName, 'Lookup');
                }
                // Polymorphic lookups are already handled by isNamePointing()/
                // refs.size() > 1 in describeObjectsInternal and aren't
                // overridden here.
            }
        } catch (Exception e) {
            // Leave the map empty for this object — callers fall back to the
            // describe-based logic for every field.
        }
        return result;
    }

    /**
     * Maps a field's describe info to the field-type label Setup actually
     * shows (Object Manager > Fields & Relationships), rather than the raw
     * Schema.DisplayType enum name. Relationship types reuse the
     * relationshipType already computed above. Text Area vs Text Area
     * (Long) is a length heuristic (regular Text Area fields top out at
     * 255 characters; Long Text Area goes well beyond that) since plain
     * Apex describe doesn't expose the distinction directly — refined to
     * Rich Text Area afterward in enrichWithFieldDefinitions(), which has
     * access to FieldDefinition.ExtraTypeInfo. Roll-Up Summary fields are
     * distinguished from genuine Formula fields via isRollupSummaryField()
     * below.
     */
    // isCalculated() is true for BOTH formula fields and roll-up summary
    // fields -- its own docs only mention formula fields and say nothing
    // about roll-ups. getCalculatedFormula() is what actually distinguishes
    // them: non-blank for a genuine formula, blank for a roll-up summary
    // (a verified, documented technique, not assumed). Shared by
    // friendlyDataType() (Data Dictionary label) and the base describe loop
    // (isRollupSummary, used by the DSL/canvas import path) so both stay
    // in sync automatically rather than duplicating this logic twice.
    private static Boolean isRollupSummaryField(Schema.DescribeFieldResult fdr) {
        return fdr.isCalculated() && String.isBlank(fdr.getCalculatedFormula());
    }

    private static String friendlyDataType(Schema.DescribeFieldResult fdr, String relationshipType) {
        if (relationshipType == 'Master-Detail') return 'Master-Detail Relationship';
        if (relationshipType == 'Lookup') return 'Lookup Relationship';
        if (relationshipType == 'Polymorphic Lookup') return 'Lookup Relationship (Polymorphic)';

        String base;
        switch on fdr.getType() {
            when STRING          { base = 'Text'; }
            when TEXTAREA        { base = (fdr.getLength() != null && fdr.getLength() > 255) ? 'Text Area (Long)' : 'Text Area'; }
            when BOOLEAN         { base = 'Checkbox'; }
            when DOUBLE          { base = 'Number'; }
            when INTEGER         { base = 'Number'; }
            when CURRENCY        { base = 'Currency'; }
            when PERCENT         { base = 'Percent'; }
            when DATE            { base = 'Date'; }
            when DATETIME        { base = 'Date/Time'; }
            when TIME            { base = 'Time'; }
            when EMAIL           { base = 'Email'; }
            when PHONE           { base = 'Phone'; }
            when URL             { base = 'URL'; }
            when PICKLIST        { base = 'Picklist'; }
            when MULTIPICKLIST   { base = 'Picklist (Multi-Select)'; }
            when COMBOBOX        { base = 'Picklist'; }
            when ID              { base = 'ID'; }
            when BASE64          { base = 'File'; }
            when ANYTYPE         { base = 'Any'; }
            when ENCRYPTEDSTRING { base = 'Text (Encrypted)'; }
            when LOCATION        { base = 'Geolocation'; }
            when else            { base = String.valueOf(fdr.getType()); }
        }

        // isCalculated() is true for BOTH formula fields and roll-up summary
        // fields -- its own docs only mention formula fields and say
        // nothing about roll-ups, so this alone would mislabel every
        // roll-up as a Formula. getCalculatedFormula() is what actually
        // distinguishes them: non-blank for a genuine formula, blank for a
        // roll-up summary (a verified, documented technique, not assumed).
        if (fdr.isCalculated()) {
            return isRollupSummaryField(fdr)
                ? 'Roll-Up Summary'
                : 'Formula (' + base + ')';
        }
        if (fdr.isAutoNumber())  return 'Auto Number';
        return base;
    }

    /**
     * Adds Description and LastModifiedDate to each field, sourced from
     * FieldDefinition — metadata not available via the regular describe
     * API at all. Also refines Text Area / Text Area (Long) to Rich Text
     * Area using ExtraTypeInfo, which plain Apex describe doesn't expose.
     * FieldDefinition is a metadata catalog object (plain SOQL, not
     * Tooling-API-only, since API v45.0) but shares the same SOQL
     * restrictions as EntityDefinition (no IN/OR/NOT/LIMIT), so this is
     * one query per object, wrapped so a single object's lookup failing
     * doesn't blank out descriptions for every other object in the batch.
     */
    private static void enrichWithFieldDefinitions(List<ObjectWrap> objects) {
        for (ObjectWrap ow : objects) {
            try {
                Map<String, FieldWrap> byApiName = new Map<String, FieldWrap>();
                for (FieldWrap fw : ow.fields) {
                    byApiName.put(fw.apiName, fw);
                }

                List<FieldDefinition> defs = [
                    SELECT QualifiedApiName, Description, LastModifiedDate, ExtraTypeInfo
                    FROM FieldDefinition
                    WHERE EntityDefinition.QualifiedApiName = :ow.apiName
                ];
                for (FieldDefinition fd : defs) {
                    FieldWrap fw = byApiName.get(fd.QualifiedApiName);
                    if (fw != null) {
                        fw.description = fd.Description;
                        fw.lastModifiedDate = fd.LastModifiedDate != null
                            ? fd.LastModifiedDate.format('yyyy-MM-dd')
                            : null;
                        if (fd.ExtraTypeInfo == 'richtextarea'
                            && (fw.dataType == 'Text Area' || fw.dataType == 'Text Area (Long)')) {
                            fw.dataType = 'Rich Text Area';
                        }
                    }
                }
            } catch (Exception e) {
                // Leave description/lastModifiedDate null for this object's
                // fields rather than failing the whole batch.
            }
        }
    }

    public class SharingWrap {
        @AuraEnabled public String internalModel;
        @AuraEnabled public String externalModel; // null on orgs without a Communities/Experience Cloud license — external sharing doesn't apply there
    }

    /**
     * Returns each object's org-wide default sharing model — both internal
     * (regular org users) and external (Experience Cloud / community /
     * guest users), sourced from EntityDefinition — the same data Setup
     * shows under Object Manager > Sharing Settings, but not available via
     * the regular describe API. For a Master-Detail child, InternalSharingModel
     * naturally comes back as 'ControlledByParent', which is exactly what
     * tells the ER canvas that object's sharing is inherited rather than
     * independently configured.
     *
     * Read-only, single-equality queries only (EntityDefinition is a
     * metadata catalog object with its own SOQL restrictions — no IN/OR/NOT/
     * LIMIT) — one query per requested object, each wrapped so a single
     * unresolvable or inaccessible name can't fail the whole batch.
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, SharingWrap> getSharingModels(List<String> objectApiNames) {
        Map<String, SharingWrap> result = new Map<String, SharingWrap>();
        for (String rawName : objectApiNames) {
            String name = rawName == null ? null : rawName.trim();
            if (String.isBlank(name)) {
                continue;
            }
            try {
                List<EntityDefinition> rows = [
                    SELECT InternalSharingModel, ExternalSharingModel
                    FROM EntityDefinition
                    WHERE QualifiedApiName = :name
                ];
                if (!rows.isEmpty() && (rows[0].InternalSharingModel != null || rows[0].ExternalSharingModel != null)) {
                    SharingWrap sw = new SharingWrap();
                    sw.internalModel = rows[0].InternalSharingModel;
                    sw.externalModel = rows[0].ExternalSharingModel;
                    result.put(name, sw);
                }
            } catch (Exception e) {
                // Object not found, not resolvable via EntityDefinition, or any
                // other edge case — skip this one entity's badge, don't fail the batch.
            }
        }
        return result;
    }

    /**
     * Record count per object, for the canvas heatmap — a plain COUNT(),
     * nothing about the records themselves is read. Deliberately scoped to
     * whatever's currently on the canvas (the caller decides which objects
     * to ask about), never run against every object in the org at once.
     * One query per object, each wrapped so a single object failing (huge
     * table timing out, no access, etc.) doesn't blank out the rest.
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Integer> getRecordCounts(List<String> objectApiNames) {
        Map<String, Integer> result = new Map<String, Integer>();
        for (String rawName : objectApiNames) {
            String name = rawName == null ? null : rawName.trim();
            if (!isSafeIdentifier(name)) {
                continue;
            }
            try {
                result.put(name, Database.countQuery('SELECT COUNT() FROM ' + name, AccessLevel.USER_MODE));
            } catch (Exception e) {
                // Skip this one object's count, don't fail the batch.
            }
        }
        return result;
    }

    /**
     * On-demand field population percentage for the Data Dictionary — how
     * many of an object's existing records have a non-blank value in each
     * field. This scans actual DATA (not just metadata), so unlike every
     * other method in this class it's deliberately opt-in per object, not
     * automatic, and is never run in bulk across many objects at once
     * (Export All skips it entirely) to stay well inside governor limits.
     *
     * COUNT(fieldName) in SOQL counts only non-null rows, so a handful of
     * fields can share one aggregate query — batched in small groups so a
     * single field type SOQL doesn't like (e.g. some long-text variants)
     * only takes out its own small batch rather than the whole object.
     */
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getFieldUsageStats(String objectApiName, List<String> fieldApiNames) {
        Map<String, Object> result = new Map<String, Object>();
        Map<String, Double> percentages = new Map<String, Double>();
        result.put('percentages', percentages);

        if (!isSafeIdentifier(objectApiName)) {
            result.put('error', 'Invalid object name.');
            return result;
        }

        Integer totalCount;
        try {
            String countQuery = 'SELECT COUNT() FROM ' + objectApiName;
            totalCount = Database.countQuery(countQuery, AccessLevel.USER_MODE);
        } catch (Exception e) {
            result.put('error', 'Could not count records: ' + e.getMessage());
            return result;
        }
        result.put('totalRecords', totalCount);

        List<String> safeFields = new List<String>();
        for (String f : fieldApiNames) {
            if (isSafeIdentifier(f)) {
                safeFields.add(f);
            }
        }

        if (totalCount == 0 || safeFields.isEmpty()) {
            for (String f : safeFields) {
                percentages.put(f, 0.0);
            }
            return result;
        }

        Integer batchSize = 15;
        for (Integer i = 0; i < safeFields.size(); i += batchSize) {
            Integer endIdx = Math.min(i + batchSize, safeFields.size());
            List<String> batch = new List<String>();
            for (Integer j = i; j < endIdx; j++) {
                batch.add(safeFields[j]);
            }

            try {
                List<String> selectParts = new List<String>();
                for (String f : batch) {
                    selectParts.add('COUNT(' + f + ')');
                }
                String q = 'SELECT ' + String.join(selectParts, ', ') + ' FROM ' + objectApiName;
                List<AggregateResult> ars = Database.query(q, AccessLevel.USER_MODE);
                if (!ars.isEmpty()) {
                    AggregateResult ar = ars[0];
                    for (Integer k = 0; k < batch.size(); k++) {
                        Object val = ar.get('expr' + k);
                        Integer cnt = val == null ? 0 : (Integer) val;
                        percentages.put(batch[k], (Double) cnt / totalCount * 100.0);
                    }
                }
            } catch (Exception e) {
                // This batch's fields fall back to "not available" (absent
                // from the map) rather than failing every other batch.
            }
        }

        return result;
    }

    // Object/field API names are always letters, digits, and underscores,
    // starting with a letter — since these names get concatenated directly
    // into dynamic SOQL (object/field names can't be bind variables), this
    // is required validation, not a convenience check.
    private static Boolean isSafeIdentifier(String name) {
        return name != null && Pattern.matches('^[A-Za-z][A-Za-z0-9_]*$', name);
    }
}
