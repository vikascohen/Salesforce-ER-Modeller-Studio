import { runArchitectureAnalysis } from '../architectureProgress';
import { clearArchitectureAnalysisCache } from '../architecturePerformance';

const model = {
    entities: [{ name: 'Account', fields: [] }, { name: 'Contact', fields: [] }],
    relationships: [{ childEntity: 'Contact', parentEntity: 'Account', childField: 'AccountId', kind: 'lookup' }]
};

describe('progressive architecture analysis', () => {
    beforeEach(() => clearArchitectureAnalysisCache());

    it('reports real named stages and returns the overview', async () => {
        const states = [];
        const result = await runArchitectureAnalysis(model, 'Customer Model', state => states.push(state));
        expect(states.some(state => state.stages?.some(stage => stage.key === 'patterns' && stage.status === 'active'))).toBe(true);
        expect(states[states.length - 1].complete).toBe(true);
        expect(result.overview.modelLabel).toBe('Customer Model');
        expect(result.analysis.entityCount).toBe(2);
    });
});
