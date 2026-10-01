import { analyseArchitecture, findArchitecturePath } from 'c/architectureIntelligence';

function chainModel(size) {
    const entities = Array.from({ length: size }, (_, i) => ({ name: `Node${i}__c`, fields: [{ name: 'Name' }] }));
    const relationships = Array.from({ length: Math.max(0, size - 1) }, (_, i) => ({
        childEntity: entities[i + 1].name,
        parentEntity: entities[i].name,
        childField: `Parent${i}__c`,
        kind: i % 7 === 0 ? 'master-detail' : 'lookup'
    }));
    return { entities, relationships };
}

describe('enterprise architecture scale regressions', () => {
    it('analyses a 1000 object sparse model deterministically', () => {
        const analysis = analyseArchitecture(chainModel(1000));
        expect(analysis.entityCount).toBe(1000);
        expect(analysis.relationshipCount).toBe(999);
        expect(analysis.nodes).toHaveLength(1000);
    });

    it('finds a path without requiring all possible paths to be precomputed', () => {
        const analysis = analyseArchitecture(chainModel(300));
        const result = findArchitecturePath(analysis, 'Node0__c', 'Node299__c');
        expect(result.found).toBe(true);
        expect(result.path[0]).toBe('Node0__c');
        expect(result.path[result.path.length - 1]).toBe('Node299__c');
    });
});
