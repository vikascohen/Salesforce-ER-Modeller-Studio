import { analyseArchitecture } from 'c/architectureIntelligence';
import { buildArchitectureOverview } from '../architectureExperience';
import { buildArchitectureVisualModel } from '../architectureVisualModel';
import { buildObjectImpactExplorer } from '../impactExplorer';

describe('architecture experience edge cases', () => {
    it('renders an empty model safely', () => {
        const analysis = analyseArchitecture({ entities: [], relationships: [] });
        const overview = buildArchitectureOverview(analysis, 'Empty Model');
        const visual = buildArchitectureVisualModel(analysis);
        expect(overview.headline).toContain('empty');
        expect(visual.nodes).toHaveLength(0);
        expect(visual.edges).toHaveLength(0);
    });

    it('returns no impact view for an unknown object', () => {
        const analysis = analyseArchitecture({ entities: [{ name: 'Account', fields: [] }], relationships: [] });
        expect(buildObjectImpactExplorer(analysis, 'Missing__c')).toBeNull();
    });
});
