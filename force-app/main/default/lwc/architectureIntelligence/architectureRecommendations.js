const RECOMMENDATION_BUILDERS = [
    buildHighCouplingRecommendations,
    buildIsolationRecommendations,
    buildCycleRecommendations,
    buildLargeObjectRecommendations
];

/**
 * Converts deterministic ER-model findings into architect-facing recommendations.
 * This module never mutates the model and never claims that a structural signal is
 * automatically a Salesforce defect. Recommendations are decision support only.
 */
export function buildArchitectureRecommendations(analysis) {
    if (!analysis) return [];
    return RECOMMENDATION_BUILDERS.flatMap(builder => builder(analysis));
}

function buildHighCouplingRecommendations(analysis) {
    const average = analysis.averageDegree || 0;
    const threshold = Math.max(4, Math.ceil(average * 2));
    return (analysis.nodes || [])
        .filter(node => node.degree >= threshold)
        .slice(0, 8)
        .map(node => ({
            id: 'relationship-concentration:' + node.name,
            severity: 'review',
            category: 'Change exposure',
            objectName: node.name,
            title: node.name + ' has broad structural connections',
            finding: node.name + ' has ' + node.degree + ' direct relationships in the selected ER model.',
            whyItMatters: 'Changes involving highly connected objects can require review across a wider part of the data model.',
            evidence: [
                node.incoming + ' incoming relationship' + plural(node.incoming),
                node.outgoing + ' outgoing relationship' + plural(node.outgoing),
                'Model average is ' + average + ' relationships per object'
            ],
            recommendation: 'Review whether each direct relationship represents an intentional business association and whether specialised domains are coupled directly to ' + node.name + ' unnecessarily.',
            modellingActions: [
                'Highlight the direct relationships around ' + node.name + ' on the ER diagram.',
                'Review many-to-many associations for an explicit junction object where the association has its own meaning or lifecycle.',
                'Review specialised relationship groups for clearer domain boundaries before changing the schema.'
            ],
            tradeOffs: 'Do not remove relationships merely to reduce a graph metric. Ownership, sharing, automation, reporting, integrations and business semantics may require the current design.',
            limitation: 'Structural connectivity indicates potential change exposure; it does not prove runtime, business or implementation impact.'
        }));
}

function buildIsolationRecommendations(analysis) {
    const islands = analysis.islands || [];
    if (!islands.length) return [];
    return [{
        id: 'isolated-objects',
        severity: 'review',
        category: 'Model scope',
        title: islands.length + ' standalone object' + plural(islands.length) + ' detected',
        finding: 'These objects have no relationships to other objects represented in the selected ER model.',
        whyItMatters: 'Standalone objects may be intentionally independent, outside the current modelling scope, legacy structures, or missing expected relationships.',
        evidence: islands.slice(0, 12).map(node => node.name),
        recommendation: 'Confirm whether these objects are intentionally standalone and whether the selected ER model contains the relationships needed to understand their role.',
        modellingActions: ['Highlight the standalone objects on the ER diagram.', 'Add missing in-scope relationships if the diagram is incomplete.', 'Keep intentional standalone areas separate rather than creating artificial relationships.'],
        tradeOffs: 'An isolated object is not automatically a design problem.',
        limitation: 'The analysis only knows about objects and relationships included in the selected ER model.'
    }];
}

function buildCycleRecommendations(analysis) {
    const cycles = analysis.cycles || [];
    if (!cycles.length) return [];
    return [{
        id: 'relationship-cycles',
        severity: 'review',
        category: 'Relationship structure',
        title: cycles.length + ' circular relationship chain' + plural(cycles.length) + ' detected',
        finding: 'One or more relationship paths return to an object already present in the path.',
        whyItMatters: 'Circular structures can make ownership, dependency and change reasoning harder and deserve explicit architecture review.',
        evidence: cycles.slice(0, 6).map(path => path.join(' → ')),
        recommendation: 'Review each relationship in the highlighted chain and confirm that its direction and business meaning are intentional.',
        modellingActions: ['Highlight each circular chain on the ER diagram.', 'Check whether any relationship represents derived information rather than a required association.', 'Consider an alternative association only when it better represents the business semantics.'],
        tradeOffs: 'Circular relationship topology can be valid. The goal is to understand it, not automatically remove it.',
        limitation: 'This is structural analysis and does not determine whether automation or runtime processing is recursive.'
    }];
}

function buildLargeObjectRecommendations(analysis) {
    const large = (analysis.nodes || []).filter(node => node.fieldCount >= 50).slice(0, 6);
    return large.map(node => ({
        id: 'field-breadth:' + node.name,
        severity: 'informational',
        category: 'Model breadth',
        objectName: node.name,
        title: node.name + ' has a broad field definition',
        finding: node.name + ' contains ' + node.fieldCount + ' fields in the selected ER model.',
        whyItMatters: 'Broad object definitions can deserve additional review because a single object may be serving several concerns.',
        evidence: [node.fieldCount + ' fields represented in this model'],
        recommendation: 'Review whether the fields still represent a cohesive business concept and use Field Usage Intelligence before changing individual fields.',
        modellingActions: ['Inspect the object in the ER diagram.', 'Use field-level impact analysis before schema changes.', 'Do not split an object solely because of field count.'],
        tradeOffs: 'Salesforce objects can legitimately contain many fields; business cohesion matters more than an arbitrary threshold.',
        limitation: 'Field count alone does not establish poor design, performance risk or technical debt.'
    }));
}

function plural(count) {
    return count === 1 ? '' : 's';
}
