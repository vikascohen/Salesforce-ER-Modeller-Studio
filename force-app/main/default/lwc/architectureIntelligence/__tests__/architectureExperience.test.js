import { analyseArchitecture, analyseObject } from 'c/architectureIntelligence';
import { buildArchitectureRecommendations } from '../architectureRecommendations';
import { ANALYSIS_STAGES, buildArchitectureOverview, buildImpactSummary, buildProcessingState } from '../architectureExperience';

const model = {
    entities: [
        { name: 'Account', fields: Array.from({ length: 55 }, (_, i) => ({ name: 'F' + i })) },
        { name: 'Contact', fields: [] },
        { name: 'Case', fields: [] },
        { name: 'Opportunity', fields: [] },
        { name: 'Order', fields: [] },
        { name: 'Island__c', fields: [] }
    ],
    relationships: [
        { childEntity: 'Contact', parentEntity: 'Account', kind: 'lookup' },
        { childEntity: 'Case', parentEntity: 'Account', kind: 'lookup' },
        { childEntity: 'Opportunity', parentEntity: 'Account', kind: 'lookup' },
        { childEntity: 'Order', parentEntity: 'Account', kind: 'lookup' }
    ]
};

describe('architecture recommendation engine', () => {
    it('turns graph evidence into actionable, qualified recommendations', () => {
        const analysis = analyseArchitecture(model);
        const recommendations = buildArchitectureRecommendations(analysis);
        const account = recommendations.find(item => item.objectName === 'Account' && item.category === 'Change exposure');
        expect(account).toBeDefined();
        expect(account.finding).toContain('4 direct relationships');
        expect(account.recommendation).toContain('Review');
        expect(account.modellingActions.length).toBeGreaterThan(0);
        expect(account.tradeOffs).toBeTruthy();
        expect(account.limitation).toContain('does not prove');
        expect(recommendations.some(item => item.id === 'isolated-objects')).toBe(true);
    });

    it('does not call structural observations automatic defects', () => {
        const cycleModel = {
            entities: ['A', 'B', 'C'].map(name => ({ name, fields: [] })),
            relationships: [
                { childEntity: 'A', parentEntity: 'B', kind: 'lookup' },
                { childEntity: 'B', parentEntity: 'C', kind: 'lookup' },
                { childEntity: 'C', parentEntity: 'A', kind: 'lookup' }
            ]
        };
        const cycle = buildArchitectureRecommendations(analyseArchitecture(cycleModel)).find(item => item.id === 'relationship-cycles');
        expect(cycle).toBeDefined();
        expect(cycle.tradeOffs).toContain('can be valid');
    });
});

describe('architecture experience view models', () => {
    it('builds an executive overview without exposing graph jargon as the primary story', () => {
        const overview = buildArchitectureOverview(analyseArchitecture(model), 'Customer Service Model');
        expect(overview.modelLabel).toBe('Customer Service Model');
        expect(overview.scope).toBe('6 objects · 4 relationships');
        expect(overview.headline).toContain('Account');
        expect(overview.highestPotentialImpact[0].name).toBe('Account');
        expect(overview.attention.length).toBeGreaterThan(0);
        expect(JSON.stringify(overview)).not.toContain('hop');
    });

    it('builds object impact from the same graph analysis', () => {
        const analysis = analyseArchitecture(model);
        const impact = buildImpactSummary(analysis, analyseObject(analysis, 'Account'));
        expect(impact.objectName).toBe('Account');
        expect(impact.directConnections).toBe(4);
        expect(impact.dependedOnBy).toBe(4);
        expect(impact.disclaimer).toContain('selected ER model');
    });

    it('provides transparent processing stages without fake percentages', () => {
        const state = buildProcessingState('patterns', ['prepare', 'relationships'], 'Customer Service Model');
        expect(state.stages).toHaveLength(ANALYSIS_STAGES.length);
        expect(state.stages.find(stage => stage.key === 'prepare').status).toBe('complete');
        expect(state.stages.find(stage => stage.key === 'patterns').status).toBe('active');
        expect(state.stages.find(stage => stage.key === 'visuals').status).toBe('pending');
        expect(state.percentage).toBeUndefined();
    });
});
