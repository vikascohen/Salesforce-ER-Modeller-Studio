import { analyseBlastRadius, analyseObject } from 'c/architectureIntelligence';
import { buildArchitectureRecommendations } from './architectureRecommendations';

export function buildObjectImpactExplorer(analysis, objectName) {
    if (!analysis || !objectName) return null;
    const detail = analyseObject(analysis, objectName);
    if (!detail) return null;
    const node = (analysis.nodes || []).find(item => item.name === objectName);
    if (!node) return null;
    const reach = analyseBlastRadius(analysis, objectName, 3);
    const relationships = (analysis.relationships || []).filter(rel => rel.childEntity === objectName || rel.parentEntity === objectName);
    const incoming = relationships.filter(rel => rel.parentEntity === objectName);
    const outgoing = relationships.filter(rel => rel.childEntity === objectName);
    const recommendations = buildArchitectureRecommendations(analysis).filter(item => item.objectName === objectName);

    return {
        mode: 'object',
        objectName,
        headline: `${objectName} connects directly to ${node.degree} relationship${node.degree === 1 ? '' : 's'} in this ER model.`,
        metrics: {
            directRelationships: node.degree,
            dependedOnBy: incoming.length,
            dependsOn: outgoing.length,
            widerConnections: reach?.total || 0
        },
        incoming: incoming.map((rel, index) => relationshipRow(rel, index, 'incoming')),
        outgoing: outgoing.map((rel, index) => relationshipRow(rel, index, 'outgoing')),
        recommendations,
        nextActions: {
            fieldUsage: { label: 'Analyse field implementation usage', objectName },
            relationshipFinder: { label: 'Find connection to another object', sourceObject: objectName },
            erDiagram: { label: 'Highlight on ER diagram', objectName }
        },
        limitation: 'This view shows potential structural impact inside the selected ER model. Use Field Usage Intelligence and org-specific evidence before concluding that a change will break an implementation.'
    };
}

export function buildFieldImpactExplorer(objectName, fieldName, evidence = []) {
    const groups = new Map();
    (evidence || []).forEach(row => {
        const source = row.sourceType || row.Source_Type__c || 'Other';
        if (!groups.has(source)) groups.set(source, { sourceType: source, references: 0, rows: [] });
        const group = groups.get(source);
        group.references += Number(row.occurrences || row.Occurrence_Count__c || row.evidenceRows || 1);
        group.rows.push(row);
    });
    return {
        mode: 'field',
        objectName,
        fieldName,
        fieldKey: objectName && fieldName ? `${objectName}.${fieldName}` : '',
        implementationUsage: [...groups.values()].sort((a, b) => b.references - a.references || a.sourceType.localeCompare(b.sourceType)),
        totalReferences: [...groups.values()].reduce((sum, group) => sum + group.references, 0),
        limitation: 'Field Usage reflects the successful indexed metadata snapshot and supported scanners. Absence of evidence is not proof that a field is unused everywhere.'
    };
}

function relationshipRow(rel, index, direction) {
    return {
        key: `${direction}-${index}-${rel.childEntity}-${rel.parentEntity}`,
        child: rel.childEntity,
        parent: rel.parentEntity,
        field: rel.childField || rel.fieldName || rel.field || '',
        kind: rel.kind || 'Lookup',
        direction
    };
}
