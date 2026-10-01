import { ARCHITECTURE_GUIDANCE, guidanceForRecommendation } from '../architectureFramework';

describe('architecture guidance registry', () => {
    it('is explicitly versioned and scoped', () => {
        expect(ARCHITECTURE_GUIDANCE.version).toBeTruthy();
        expect(ARCHITECTURE_GUIDANCE.scope).toContain('ER-model');
    });

    it('maps findings to guidance without calling them automatic violations', () => {
        const guidance = guidanceForRecommendation({ id: 'relationship-concentration:Account' });
        expect(guidance.length).toBeGreaterThan(0);
        expect(JSON.stringify(guidance).toLowerCase()).not.toContain('violation');
    });
});
