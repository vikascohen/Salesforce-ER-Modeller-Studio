import { analyseArchitecture } from 'c/architectureIntelligence';
import { buildFieldImpactExplorer, buildObjectImpactExplorer } from '../impactExplorer';

const analysis = analyseArchitecture({
    entities: [{ name: 'Account', fields: [] }, { name: 'Contact', fields: [] }, { name: 'Case', fields: [] }],
    relationships: [
        { childEntity: 'Contact', parentEntity: 'Account', childField: 'AccountId', kind: 'lookup' },
        { childEntity: 'Case', parentEntity: 'Account', childField: 'AccountId', kind: 'lookup' }
    ]
});

describe('Impact Explorer', () => {
    it('explains object impact without duplicating path finding', () => {
        const impact = buildObjectImpactExplorer(analysis, 'Account');
        expect(impact.mode).toBe('object');
        expect(impact.metrics.directRelationships).toBe(2);
        expect(impact.metrics.dependedOnBy).toBe(2);
        expect(impact.nextActions.relationshipFinder.sourceObject).toBe('Account');
        expect(impact.path).toBeUndefined();
    });

    it('groups field implementation evidence in the same conceptual workspace', () => {
        const impact = buildFieldImpactExplorer('Account', 'Status__c', [
            { sourceType: 'Apex', occurrences: 3 },
            { sourceType: 'Flow', occurrences: 2 },
            { sourceType: 'Apex', occurrences: 1 }
        ]);
        expect(impact.fieldKey).toBe('Account.Status__c');
        expect(impact.totalReferences).toBe(6);
        expect(impact.implementationUsage[0].sourceType).toBe('Apex');
        expect(impact.implementationUsage[0].references).toBe(4);
    });
});
