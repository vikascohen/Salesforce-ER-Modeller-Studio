import { analyseArchitecture } from 'c/architectureIntelligence';
import { buildArchitectureRecommendations } from '../architectureRecommendations';

describe('architecture recommendation language', () => {
    it('does not claim structural signals are guaranteed violations or breakages', () => {
        const analysis = analyseArchitecture({
            entities: ['A__c', 'B__c', 'C__c', 'D__c', 'E__c', 'F__c'].map(name => ({ name, fields: [] })),
            relationships: ['B__c', 'C__c', 'D__c', 'E__c'].map((child, i) => ({ childEntity: child, parentEntity: 'A__c', childField: `A${i}__c`, kind: 'lookup' }))
        });
        const text = JSON.stringify(buildArchitectureRecommendations(analysis)).toLowerCase();
        expect(text).not.toContain('best practice violation');
        expect(text).not.toContain('will break');
        expect(text).toContain('review');
    });
});
