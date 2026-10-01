import { buildArchitectureRecommendations } from './architectureRecommendations';

export const ANALYSIS_STAGES = Object.freeze([
    { key: 'prepare', label: 'Preparing model' },
    { key: 'relationships', label: 'Mapping relationships' },
    { key: 'patterns', label: 'Analysing architecture patterns' },
    { key: 'guidance', label: 'Evaluating architecture guidance' },
    { key: 'recommendations', label: 'Building recommendations' },
    { key: 'visuals', label: 'Preparing visualisations' }
]);

export function buildProcessingState(activeStage, completedStages = [], detail = '') {
    const completed = new Set(completedStages);
    return {
        detail,
        stages: ANALYSIS_STAGES.map(stage => ({
            ...stage,
            status: completed.has(stage.key) ? 'complete' : stage.key === activeStage ? 'active' : 'pending'
        }))
    };
}

/**
 * Executive-friendly view model. Algorithms stay in architectureIntelligence;
 * presentation language and drill-down routing stay here.
 */
export function buildArchitectureOverview(analysis, modelLabel = 'Current Diagram') {
    if (!analysis) return null;
    const recommendations = buildArchitectureRecommendations(analysis);
    const top = (analysis.mostConnected || []).slice(0, 5);
    const primary = top[0];
    const attention = recommendations.slice(0, 6);

    return {
        modelLabel,
        scope: `${analysis.entityCount} objects · ${analysis.relationshipCount} relationships`,
        headline: buildHeadline(analysis, primary),
        summary: buildSummary(analysis, primary),
        metrics: [
            { key: 'objects', label: 'Objects', value: analysis.entityCount },
            { key: 'relationships', label: 'Relationships', value: analysis.relationshipCount },
            { key: 'connected', label: 'Highly connected', value: (analysis.hubs || []).length },
            { key: 'standalone', label: 'Standalone', value: (analysis.islands || []).length }
        ],
        relationshipComposition: [
            { label: 'Lookup', value: analysis.lookupCount || 0 },
            { label: 'Master-Detail', value: analysis.masterDetailCount || 0 },
            { label: 'Polymorphic', value: analysis.polymorphicCount || 0 }
        ],
        highestPotentialImpact: top.map((node, index) => ({
            rank: index + 1,
            name: node.name,
            directRelationships: node.degree,
            incoming: node.incoming,
            outgoing: node.outgoing,
            reason: `${node.degree} direct relationships in this model`
        })),
        attention,
        actions: {
            impactExplorer: primary ? { label: `Explore ${primary.name} impact`, objectName: primary.name } : null,
            relationshipFinder: { label: 'Find an object relationship' },
            erDiagram: { label: 'Open ER diagram' }
        }
    };
}

export function buildImpactSummary(analysis, objectAnalysis) {
    if (!analysis || !objectAnalysis) return null;
    const node = (analysis.nodes || []).find(item => item.name === objectAnalysis.name);
    if (!node) return null;
    const recommendations = buildArchitectureRecommendations(analysis)
        .filter(item => item.objectName === node.name || !item.objectName);
    return {
        objectName: node.name,
        headline: `${node.name} has ${node.degree} direct relationship${node.degree === 1 ? '' : 's'} in this model`,
        directConnections: node.degree,
        dependsOn: node.outgoing,
        dependedOnBy: node.incoming,
        widerConnections: objectAnalysis.reachableWithin3 || 0,
        parents: objectAnalysis.parents || [],
        children: objectAnalysis.children || [],
        recommendations,
        disclaimer: 'Potential structural impact is based on the selected ER model. It does not by itself prove business, runtime or implementation impact.'
    };
}

function buildHeadline(analysis, primary) {
    if (!analysis.entityCount) return 'This ER model is empty.';
    if (!analysis.relationshipCount) return 'This model currently contains objects without represented relationships.';
    if (primary) return `${primary.name} sits within one of the most connected areas of this model.`;
    return 'Architecture analysis is ready.';
}

function buildSummary(analysis, primary) {
    const parts = [`This model contains ${analysis.entityCount} objects connected by ${analysis.relationshipCount} relationships.`];
    if (primary) parts.push(`${primary.name} has ${primary.degree} direct relationships, the widest represented connection profile in the current analysis.`);
    if ((analysis.islands || []).length) parts.push(`${analysis.islands.length} standalone object${analysis.islands.length === 1 ? '' : 's'} should be confirmed as intentional or in-scope.`);
    if ((analysis.cycles || []).length) parts.push(`${analysis.cycles.length} circular relationship chain${analysis.cycles.length === 1 ? '' : 's'} deserve review as intentional topology, not automatic defects.`);
    return parts.join(' ');
}
