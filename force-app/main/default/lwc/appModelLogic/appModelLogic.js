/** Bounded traversal shared by the UI and regression tests. No org mutations. */
export function componentKey(component) {
    return `${component.type}|${component.name}`.toLowerCase();
}
export async function collectAppScope(scope, expand, { includeAutomation = true, onProgress = () => {} } = {}) {
    const seen = new Map();
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
    if (objects.length > 150) throw new Error('This app reaches more than 150 objects. Generate a narrower model.');
    if (!objects.length) throw new Error('No resolvable Salesforce objects were found for this app. Review component coverage.');
    return { objects, reasons: [...reasons].sort(), warnings: [...warnings], componentCount: seen.size };
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
