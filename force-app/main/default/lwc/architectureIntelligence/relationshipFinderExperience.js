import { findArchitecturePath } from 'c/architectureIntelligence';

export function buildRelationshipFinderResult(analysis, source, target) {
    if (!analysis || !source || !target) return null;
    const result = findArchitecturePath(analysis, source, target);
    if (!result?.found) {
        return {
            found: false,
            source,
            target,
            headline: `No relationship path between ${source} and ${target} is represented in this ER model.`,
            limitation: 'This only describes relationships represented in the selected ER model.'
        };
    }
    const path = result.path || [];
    return {
        found: true,
        source,
        target,
        path,
        relationshipCount: Math.max(0, path.length - 1),
        headline: `${source} and ${target} are connected through ${Math.max(0, path.length - 1)} relationship${path.length - 1 === 1 ? '' : 's'}.`,
        explanation: path.join(' → '),
        technicalDetails: result,
        limitation: 'The displayed route is a structural connection in the selected ER model; it does not by itself establish runtime or business dependency.'
    };
}
