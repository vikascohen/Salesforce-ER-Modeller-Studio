import { buildFieldImpactExplorer } from '../impactExplorer';

describe('field impact evidence provenance', () => {
    it('does not interpret zero indexed references as proof of zero usage', () => {
        const result = buildFieldImpactExplorer('Account', 'Name', []);
        expect(result.totalReferences).toBe(0);
        expect(result.limitation.toLowerCase()).toContain('not proof');
    });
});
