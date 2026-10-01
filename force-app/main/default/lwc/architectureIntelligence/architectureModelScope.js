export function buildArchitectureModelScope(modelLabel, analysis, source = 'current') {
    return {
        label: modelLabel || (source === 'saved' ? 'Saved ER Model' : 'Current Diagram'),
        source,
        objectCount: analysis?.entityCount || 0,
        relationshipCount: analysis?.relationshipCount || 0,
        fieldCount: analysis?.fieldCount || 0,
        scopeText: `${analysis?.entityCount || 0} objects · ${analysis?.relationshipCount || 0} relationships`,
        provenance: 'Structural findings are derived from the selected ER model.',
        implementationProvenance: 'Field Usage Intelligence uses the latest successful indexed Salesforce metadata snapshot when explicitly requested.'
    };
}
