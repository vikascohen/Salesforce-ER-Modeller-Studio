import * as experience from '../architectureExports';

describe('Architecture Intelligence redesigned public facade', () => {
    it('exports the three primary experience builders and shared map helpers', () => {
        expect(typeof experience.buildArchitectureOverview).toBe('function');
        expect(typeof experience.buildObjectImpactExplorer).toBe('function');
        expect(typeof experience.buildRelationshipFinderResult).toBe('function');
        expect(typeof experience.buildArchitectureVisualModel).toBe('function');
        expect(typeof experience.fitArchitectureMap).toBe('function');
        expect(typeof experience.runArchitectureAnalysis).toBe('function');
    });
});
