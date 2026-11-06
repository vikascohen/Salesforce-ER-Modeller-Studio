/** Bounded traversal shared by the UI and regression tests. No org mutations. */
export function componentKey(component) {
    return `${component.type}|${component.name}`.toLowerCase();
}
export async function collectAppScope(scope, expand, { includeAutomation = true, onProgress = () => {} } = {}) {
    const seen = new Map();
    const fieldUsage = new Map();
    const verifiedComponents = new Map();
    const reasons = new Set();
    const warnings = new Set(scope.warnings || []);
    let frontier = scope.components || [];
    let requests = 0;
    while (frontier.length) {
        const batch = [];
        for (const component of frontier) {
            if (!component?.name || !component?.type) continue;
            const key = componentKey(component);
            if (!seen.has(key)) { seen.set(key, component); batch.push(component); }
        }
        if (seen.size > 2000) throw new Error('App scope exceeds 2,000 components. No diagram was replaced.');
        if (!batch.length) break;
        const next = [];
        for (let offset = 0; offset < batch.length; offset += 40) {
            const components = batch.slice(offset, offset + 40);
            let cursor = null;
            const cursors = new Set();
            do {
                if (++requests > 150) throw new Error('App discovery exceeded 150 requests. No partial diagram was created.');
                onProgress(`Discovering app dependencies (${seen.size} components, request ${requests})`);
                const page = await expand({ runId: scope.runId, components, cursor, includeAutomation });
                next.push(...(page.components || []));
                for (const component of page.verifiedComponents || []) verifiedComponents.set(componentKey(component), component);
                for (const field of page.fieldUsage || []) {
                    if (!field.objectApiName || !field.fieldApiName) continue;
                    const key = `${field.objectApiName}.${field.fieldApiName}`.toLowerCase();
                    if (!fieldUsage.has(key)) fieldUsage.set(key, {objectApiName:field.objectApiName,fieldApiName:field.fieldApiName,sources:new Set()});
                    const source = `${field.sourceType || 'Component'} ${field.componentName || ''}${field.location ? ' — ' + field.location : ''}`.trim();
                    fieldUsage.get(key).sources.add(source);
                    next.push({type:'Object',name:field.objectApiName});
                    reasons.add(`${source} → ${field.objectApiName}: uses ${field.fieldApiName}`);
                }
                for (const reason of page.reasons || []) reasons.add(reason);
                for (const warning of page.warnings || []) warnings.add(warning);
                cursor = page.nextCursor || null;
                if (cursor && cursors.has(cursor)) throw new Error('Salesforce repeated a dependency page. No partial diagram was created.');
                if (cursor) cursors.add(cursor);
            } while (cursor);
        }
        frontier = next;
    }
    const objects = [...seen.values()].filter(component => component.type === 'Object').map(component => component.name).sort();
    if (!objects.length) {
        const error = new Error('No resolvable Salesforce objects were found for this app. Review component coverage.');
        error.code = 'APP_OBJECTS_NOT_RESOLVED';
        error.scanAvailable = !!scope.runId;
        error.appLabel = scope.appLabel || 'the selected app';
        error.coverageWarnings = [...warnings];
        throw error;
    }
    return { objects, components: [...verifiedComponents.values()], fields: [...fieldUsage.values()].map(field => ({...field,sources:[...field.sources]})), reasons: [...reasons].sort(), warnings: [...warnings], componentCount: seen.size };
}
export async function describeInChunks(names, describe, onProgress = () => {}) {
    const objects = [];
    for (let index = 0; index < names.length; index += 10) {
        onProgress(`Loading object metadata (${index + 1}–${Math.min(index + 10, names.length)} of ${names.length})`);
        objects.push(...(await describe({ objectApiNames: names.slice(index, index + 10) }) || []));
    }
    const found = new Set(objects.map(object => object.apiName.toLowerCase()));
    const missing = names.filter(name => !found.has(name.toLowerCase()));
    if (missing.length) throw new Error(`Object metadata could not be loaded for: ${missing.join(', ')}. No partial diagram was created.`);
    return objects;
}

// Deliberately explicit and conservative. Standard business tables and custom
// objects stay visible; an object's being standard is not a reason to hide it.
const PLATFORM_OBJECT_GROUPS = {
    'Security and access': ['PermissionSet','PermissionSetAssignment','PermissionSetGroup','PermissionSetGroupComponent','PermissionSetLicense','PermissionSetLicenseAssign','MutingPermissionSet','PermissionSetTabSetting','PermissionSetApplicationVisibility','ObjectPermissions','FieldPermissions','Profile','SetupEntityAccess','UserPermissionAccess'],
    'Identity and sharing': ['User','UserRole','UserLogin','UserRecordAccess','Group','GroupMember','Name','UserPreference','UserAppInfo','UserAppMenuCustomization'],
    'Licensing': ['UserLicense','PackageLicense','UserPackageLicense','PermissionSetLicense','PermissionSetLicenseAssign'],
    'Platform metadata': ['OmniProcess','OmniProcessElement','OmniDataTransform','OmniDataTransformItem','ApexClass','ApexTrigger','Flow','FlowDefinition','FlowDefinitionView','FlowVersionView','FlowInterview','FlowRecordRelation','LightningComponentBundle','AuraDefinitionBundle','EntityDefinition','FieldDefinition','EntityParticle','RelationshipDomain','RelationshipInfo','AppDefinition','AppMenuItem','RecordType','CustomPermission','Organization'],
    'Presentation metadata': ['Image','Report','Dashboard'],
    'Platform operations': ['AggregateResult','ApexEmailNotification','PlatformCachePartitionType','ApexLog','AsyncApexJob','CronTrigger','CronJobDetail','SetupAuditTrail','LoginHistory','LoginGeo','AuthSession','EventLogFile']
};
const PLATFORM_CATEGORIES = new Map();
Object.entries(PLATFORM_OBJECT_GROUPS).forEach(([category,names]) => names.forEach(name => PLATFORM_CATEGORIES.set(name.toLowerCase(),category)));

export function selectAppObjects(result, { includePlatform = false, navigationObjects = [], appLabel = 'the selected app' } = {}) {
    const names = [...new Map((result.objects || []).map(name => [name.toLowerCase(),name])).values()].sort();
    const reasons = new Map(names.map(name => [name.toLowerCase(),new Set()]));
    for (const reason of result.reasons || []) {
        const arrow = reason.indexOf(' → ');
        if (arrow < 0) continue;
        const target = reason.substring(arrow + 3).match(/^([A-Za-z_][A-Za-z0-9_]*)(?=[:\s(]|$)/)?.[1];
        if (target && reasons.has(target.toLowerCase())) reasons.get(target.toLowerCase()).add(reason);
    }
    for (const name of navigationObjects) if (reasons.has(name.toLowerCase())) reasons.get(name.toLowerCase()).add(`Object navigation item in ${appLabel}.`);
    const details = names.map(apiName => {
        const category = PLATFORM_CATEGORIES.get(apiName.toLowerCase()) || 'Application data';
        const platform = PLATFORM_CATEGORIES.has(apiName.toLowerCase());
        const included = includePlatform || !platform;
        const evidence = [...reasons.get(apiName.toLowerCase())];
        if (!evidence.length) evidence.push('Reached through the app dependency graph; detailed source evidence was not returned.');
        return { apiName, category, included, status: included ? 'Included' : 'Hidden by scope', scopeClass: included ? 'app-object-included' : 'app-object-hidden', evidence: evidence.map((message,index) => ({key:`${apiName}-${index}`,message})) };
    });
    const visible = details.filter(row => row.included).map(row => row.apiName);
    const hidden = details.filter(row => !row.included);
    if (!visible.length) {
        const error = new Error('No application data objects remain after hiding Salesforce system objects. Turn on Include Salesforce system, security and licensing objects to view this app’s technical dependencies.');
        error.code = 'APP_PLATFORM_ONLY';
        throw error;
    }
    if (visible.length > 150) throw new Error('The selected model scope contains more than 150 objects. Generate a narrower model.');
    return { visible, hidden, details };
}

export function prepareAppSchema(objects, { visibleNames, fieldUsage = [] } = {}) {
    const names = new Set(visibleNames.map(name => name.toLowerCase()));
    const used = new Map();
    for (const field of fieldUsage) {
        const object = field.objectApiName.toLowerCase();
        if (!used.has(object)) used.set(object,new Set());
        used.get(object).add(field.fieldApiName.toLowerCase());
    }
    if (![...used.keys()].some(object => names.has(object))) {
        const error = new Error('No field-level usage could be established for this app in the selected object scope. No model was created. The app needs resolvable field evidence in the org scan; fields will not be guessed or expanded to the full object schema.');
        error.code = 'APP_FIELDS_NOT_RESOLVED';throw error;
    }
    return objects.filter(object => names.has(object.apiName.toLowerCase())).map(object => {
        const fields = used.get(object.apiName.toLowerCase()) || new Set();
        const described = new Set((object.fields || []).map(field => field.apiName.toLowerCase()));
        const missing = [...fields].filter(field => field !== 'id' && !described.has(field));
        if (missing.length) throw new Error(`Scanned app fields no longer match the org schema: ${object.apiName}.${missing.join(', ')}. Refresh the org scan before generating.`);
        return {...object,fields:(object.fields || []).filter(field => fields.has(field.apiName.toLowerCase()))};
    });
}

// Typed cards preserve component identity separately from Salesforce entities.
export function buildAppComponentSource(components = []) {
    const unique = new Map();
    for (const component of components) {
        if (!['ApexClass','Flow'].includes(component.type) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(component.name)) continue;
        unique.set(`${component.type}:${component.name}`.toLowerCase(),component);
    }
    if (unique.size > 300) throw new Error('The app exceeds 300 component cards. Turn off Show Apex and Flow component names and generate the data model only.');
    return [...unique.values()].sort((a,b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`)).map(component => `component ${component.type} ${component.name}`).join('\n');
}
