export const ARCHITECTURE_GUIDANCE = Object.freeze({
    id: 'salesforce-er-architecture-guidance',
    version: '2026.10',
    scope: 'ER-model structural decision support',
    principles: [
        {
            id: 'intentional-relationships',
            title: 'Keep relationships intentional and explainable',
            appliesTo: ['relationship-concentration', 'relationship-cycles'],
            guidance: 'Review relationship structures in the context of business semantics, ownership, sharing, automation, reporting and integration contracts.'
        },
        {
            id: 'change-awareness',
            title: 'Understand dependency before structural change',
            appliesTo: ['relationship-concentration'],
            guidance: 'Use structural reach to identify the areas that deserve review, then use implementation evidence before concluding that a change will break something.'
        },
        {
            id: 'cohesive-model',
            title: 'Keep model responsibilities understandable',
            appliesTo: ['field-breadth', 'isolated-objects'],
            guidance: 'Object breadth and isolation are review signals, not defects. Confirm that each object represents a coherent business concept and that the ER model scope is complete.'
        }
    ]
});

export function guidanceForRecommendation(recommendation) {
    if (!recommendation?.id) return [];
    const findingType = recommendation.id.split(':')[0];
    return ARCHITECTURE_GUIDANCE.principles.filter(item => item.appliesTo.includes(findingType));
}
