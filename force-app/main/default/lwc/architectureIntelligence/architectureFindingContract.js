import { guidanceForRecommendation } from './architectureFramework';

export function normaliseArchitectureFinding(recommendation) {
    if (!recommendation) return null;
    return {
        id: recommendation.id,
        severity: recommendation.severity || 'informational',
        category: recommendation.category || 'Architecture observation',
        objectName: recommendation.objectName || '',
        whatWeFound: recommendation.finding || recommendation.title || '',
        whyItMatters: recommendation.whyItMatters || '',
        evidence: recommendation.evidence || [],
        recommendation: recommendation.recommendation || '',
        erDiagramSuggestions: recommendation.modellingActions || [],
        tradeOffs: recommendation.tradeOffs || '',
        limitations: recommendation.limitation || '',
        guidance: guidanceForRecommendation(recommendation),
        actions: {
            highlightOnDiagram: true,
            openImpactExplorer: !!recommendation.objectName,
            reanalyse: true
        }
    };
}

export function normaliseArchitectureFindings(recommendations) {
    return (recommendations || []).map(normaliseArchitectureFinding).filter(Boolean);
}
