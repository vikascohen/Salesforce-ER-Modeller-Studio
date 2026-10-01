const MAX_CACHE_ENTRIES = 8;
const analysisCache = new Map();

/** Stable, inexpensive model fingerprint used to avoid recalculating an unchanged ER model. */
export function fingerprintArchitectureModel(model) {
    const entities = (model?.entities || []).map(entity => `${entity.name}:${(entity.fields || []).length}`).sort();
    const relationships = (model?.relationships || []).map(rel => [
        rel.childEntity || '', rel.childField || rel.fieldName || rel.field || '', rel.kind || '', rel.parentEntity || ''
    ].join(':')).sort();
    return entities.join('|') + '::' + relationships.join('|');
}

export function getCachedArchitectureAnalysis(model, analyse) {
    const key = fingerprintArchitectureModel(model);
    if (analysisCache.has(key)) {
        const value = analysisCache.get(key);
        analysisCache.delete(key);
        analysisCache.set(key, value);
        return { analysis: value, cacheHit: true, fingerprint: key };
    }
    const value = analyse(model);
    analysisCache.set(key, value);
    while (analysisCache.size > MAX_CACHE_ENTRIES) {
        analysisCache.delete(analysisCache.keys().next().value);
    }
    return { analysis: value, cacheHit: false, fingerprint: key };
}

export function clearArchitectureAnalysisCache() {
    analysisCache.clear();
}

/**
 * Decides how much visual detail to render initially. Large models remain
 * navigable instead of creating thousands of DOM nodes at once.
 */
export function architectureRenderPlan(analysis) {
    const objects = analysis?.entityCount || 0;
    const relationships = analysis?.relationshipCount || 0;
    if (objects <= 100 && relationships <= 400) return { mode: 'full', nodeLimit: objects, progressive: false };
    if (objects <= 500 && relationships <= 2000) return { mode: 'progressive', nodeLimit: 150, progressive: true };
    return { mode: 'clustered', nodeLimit: 100, progressive: true };
}
