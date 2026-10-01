import { analyseArchitecture } from 'c/architectureIntelligence';
import { buildRelationshipFinderResult } from '../relationshipFinderExperience';

const analysis = analyseArchitecture({
    entities: ['Account', 'Opportunity', 'OpportunityLineItem', 'Product2'].map(name => ({ name, fields: [] })),
    relationships: [
        { childEntity: 'Opportunity', parentEntity: 'Account', childField: 'AccountId', kind: 'lookup' },
        { childEntity: 'OpportunityLineItem', parentEntity: 'Opportunity', childField: 'OpportunityId', kind: 'master-detail' },
        { childEntity: 'OpportunityLineItem', parentEntity: 'Product2', childField: 'Product2Id', kind: 'lookup' }
    ]
});

describe('Relationship Finder experience', () => {
    it('describes the path in relationships rather than graph hops', () => {
        const result = buildRelationshipFinderResult(analysis, 'Account', 'Product2');
        expect(result.found).toBe(true);
        expect(result.relationshipCount).toBe(3);
        expect(result.headline).toContain('3 relationships');
        expect(result.headline.toLowerCase()).not.toContain('hop');
        expect(result.explanation).toContain('OpportunityLineItem');
    });
});
