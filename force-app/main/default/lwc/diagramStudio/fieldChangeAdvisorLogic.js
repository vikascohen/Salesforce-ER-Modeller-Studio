/**
 * Field Change Advisor intelligence for ER Modeller Studio.
 *
 * Pure/read-only module. It never starts scans, performs Apex calls, mutates
 * snapshots, or owns UI state. The caller supplies field metadata and the
 * compact summary produced by the latest successful Field Usage snapshot.
 *
 * @author Vikas Cohen
 */

export const FIELD_CHANGE_TYPES = Object.freeze([
    { label: 'Delete field', value: 'DELETE' },
    { label: 'Rename / API name', value: 'RENAME' },
    { label: 'Change data type', value: 'DATA_TYPE' },
    { label: 'Change length / precision', value: 'SIZE' },
    { label: 'Make required / optional', value: 'REQUIRED' },
    { label: 'Change Unique', value: 'UNIQUE' },
    { label: 'Change External ID', value: 'EXTERNAL_ID' },
    { label: 'Change relationship', value: 'RELATIONSHIP' },
    { label: 'Change formula', value: 'FORMULA' }
]);

const SOURCE_RULES = Object.freeze({
    'Apex Class': { area: 'Code', review: 'Review compile-time and runtime field references in Apex.' },
    'Apex Trigger': { area: 'Automation', review: 'Review trigger logic, DML paths and field assumptions.' },
    Flow: { area: 'Automation', review: 'Review assignments, decisions, filters and record operations.' },
    LWC: { area: 'UI', review: 'Review UI API/schema imports, data binding and client-side assumptions.' },
    Aura: { area: 'UI', review: 'Review component bindings, Apex calls and field-name references.' },
    'Formula Field': { area: 'Calculated logic', review: 'Review operators, functions and return-type compatibility.' },
    'Validation Rule': { area: 'Validation', review: 'Review expressions and type-dependent comparisons.' }
});

function normaliseSummary(rows = []) {
    return rows
        .filter(row => row && !row._detail && (row.sourceType || row.Source_Type__c))
        .map(row => ({
            sourceType: row.sourceType || row.Source_Type__c,
            occurrences: Number(row.occurrences ?? row.evidenceRows ?? row.Occurrence_Count__c ?? 0),
            components: Number(row.components ?? row.componentCount ?? 0)
        }));
}

function addFinding(findings, key, title, detail, category, priority = 2) {
    if (findings.some(f => f.key === key)) return;
    findings.push({ key, title, detail, category, priority });
}

export function buildFieldProfile(metadata = {}) {
    const flags = [];
    const type = metadata.type || metadata.dataType || metadata.typeName || 'Unknown';
    if (metadata.required || metadata.nillable === false) flags.push('Required');
    if (metadata.unique) flags.push('Unique');
    if (metadata.externalId || metadata.externalId === true) flags.push('External ID');
    if (metadata.indexed || metadata.isIndexed) flags.push('Indexed');
    if (metadata.calculated || metadata.formula) flags.push('Formula');
    if (metadata.referenceTo || metadata.relationshipName) flags.push('Relationship');
    return { type, flags, isRelationship: flags.includes('Relationship'), isFormula: flags.includes('Formula') };
}

export function buildChangeAdvice({ objectApiName, fieldApiName, changeType, fieldMetadata = {}, evidenceSummary = [] } = {}) {
    const summary = normaliseSummary(evidenceSummary);
    const profile = buildFieldProfile(fieldMetadata);
    const findings = [];
    const reviewAreas = new Map();
    let totalOccurrences = 0;

    summary.forEach(row => {
        totalOccurrences += row.occurrences;
        const rule = SOURCE_RULES[row.sourceType] || { area: row.sourceType, review: `Review ${row.sourceType} references before changing the field.` };
        const existing = reviewAreas.get(rule.area) || { area: rule.area, occurrences: 0, sources: new Set(), actions: new Set() };
        existing.occurrences += row.occurrences;
        existing.sources.add(row.sourceType);
        existing.actions.add(rule.review);
        reviewAreas.set(rule.area, existing);
    });

    if (summary.length) {
        addFinding(findings, 'dependencies', 'Detected metadata dependencies', `${totalOccurrences} detected occurrence${totalOccurrences === 1 ? '' : 's'} across ${summary.length} source type${summary.length === 1 ? '' : 's'} in the current successful scan.`, 'Dependency', 1);
    } else {
        addFinding(findings, 'no-dependencies', 'No dependency detected in the current scan', 'This means the successful snapshot contains no detected metadata reference for this field. It is not proof that external integrations, reports, unmanaged runtime references or data consumers do not exist.', 'Evidence', 3);
    }

    switch (changeType) {
        case 'DELETE':
            if (summary.length) addFinding(findings, 'delete-deps', 'Resolve detected consumers before deletion', 'Deleting the field while detected metadata consumers remain can leave broken or invalid references. Open each finding and review the underlying evidence.', 'Change', 1);
            addFinding(findings, 'delete-data', 'Confirm data retention and downstream consumers', 'Field Usage scans Salesforce metadata references; deletion review should also consider stored data, reporting, integrations and external consumers.', 'Data', 2);
            break;
        case 'RENAME':
            if (summary.length) addFinding(findings, 'rename-refs', 'Review API-name references', 'Detected consumers may depend on the current field API name. Review evidence before changing the API name.', 'Change', 1);
            break;
        case 'DATA_TYPE':
            if (summary.some(x => ['Flow', 'Formula Field', 'Validation Rule'].includes(x.sourceType))) addFinding(findings, 'type-expressions', 'Expression compatibility requires review', 'Flows, formulas or validation expressions can depend on the current data type, operators and coercion behaviour.', 'Logic', 1);
            if (summary.some(x => ['Apex Class', 'Apex Trigger', 'LWC', 'Aura'].includes(x.sourceType))) addFinding(findings, 'type-code', 'Code and UI contracts require review', 'Typed Apex variables, serialization and UI handling can assume the current field type.', 'Code', 1);
            break;
        case 'SIZE':
            addFinding(findings, 'size-data', 'Check existing and incoming values', 'Reducing length, precision or scale can affect stored values and consumers even when metadata references remain valid.', 'Data', 1);
            break;
        case 'REQUIRED':
            addFinding(findings, 'required-data', 'Check null population paths', 'Making a field required can affect existing records and create/update paths that do not currently populate it.', 'Data', 1);
            if (summary.some(x => ['Flow', 'Apex Class', 'Apex Trigger'].includes(x.sourceType))) addFinding(findings, 'required-writers', 'Review write-path automation', 'Detected automation or code may create/update records without supplying this field.', 'Automation', 1);
            break;
        case 'UNIQUE':
            addFinding(findings, 'unique-data', 'Check duplicate data before enabling uniqueness', 'Uniqueness is a data constraint as well as a schema characteristic. Existing duplicates and integration behaviour should be reviewed.', 'Data', 1);
            break;
        case 'EXTERNAL_ID':
            addFinding(findings, 'external-id', 'Review integration and upsert assumptions', 'External ID characteristics can be part of integration matching and upsert contracts that are not fully visible to metadata scanning.', 'Integration', 1);
            break;
        case 'RELATIONSHIP':
            addFinding(findings, 'relationship', 'Review structural relationship impact', 'Relationship changes can alter parent/child access, requiredness and model paths. Combine this finding with the ER relationship view.', 'Architecture', 1);
            break;
        case 'FORMULA':
            addFinding(findings, 'formula', 'Review calculated-logic consumers', 'Changing a formula can alter values without changing the field API name. Review downstream automation, validation, code and UI consumers.', 'Logic', 1);
            break;
        default:
            addFinding(findings, 'choose-change', 'Select a proposed change', 'Choose what you plan to change so the Advisor can prioritise the relevant evidence and review actions.', 'Advisor', 3);
    }

    if (profile.flags.includes('External ID') && changeType !== 'EXTERNAL_ID') addFinding(findings, 'profile-external', 'External ID field', 'Treat integration/upsert consumers as an additional review area even if they are not present in the metadata snapshot.', 'Integration', 2);
    if (profile.flags.includes('Unique') && ['DATA_TYPE', 'SIZE', 'DELETE'].includes(changeType)) addFinding(findings, 'profile-unique', 'Unique constraint present', 'Review the effect of the proposed change on uniqueness and data-quality assumptions.', 'Data', 2);
    if (profile.flags.includes('Indexed')) addFinding(findings, 'profile-indexed', 'Indexed field', 'Query/selectivity behaviour may be relevant to this change. The Advisor reports this as a review consideration, not a prediction of performance impact.', 'Performance', 3);

    const areas = [...reviewAreas.values()].map(x => ({
        area: x.area,
        occurrences: x.occurrences,
        sources: [...x.sources],
        actions: [...x.actions]
    })).sort((a, b) => b.occurrences - a.occurrences || a.area.localeCompare(b.area));

    findings.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
    return {
        fieldKey: objectApiName && fieldApiName ? `${objectApiName}.${fieldApiName}` : fieldApiName || '',
        changeType: changeType || '',
        profile,
        totalOccurrences,
        sourceTypeCount: summary.length,
        findings,
        reviewAreas: areas
    };
}

export function getAdvisorAvailability({ snapshotAvailable, scanRunning, snapshotInfo } = {}) {
    if (!snapshotAvailable) {
        return {
            state: scanRunning ? 'WAITING' : 'SCAN_REQUIRED',
            ready: false,
            title: scanRunning ? 'Org scan in progress' : 'Org scan required',
            message: scanRunning
                ? 'Field Change Advisor needs a successful org scan. The current scan is still running.'
                : 'Field Change Advisor uses dependency evidence collected by the Full Org Scan. Run a Full Scan first to enable dependency-aware change analysis.'
        };
    }
    return {
        state: scanRunning ? 'READY_REFRESHING' : 'READY',
        ready: true,
        title: scanRunning ? 'Using last successful scan' : 'Advisor ready',
        message: scanRunning
            ? 'A newer org scan is running. Advisor will continue using the last successful snapshot until the replacement scan completes successfully.'
            : 'Advice is based on the latest successful Field Usage snapshot.',
        snapshotInfo: snapshotInfo || null
    };
}
