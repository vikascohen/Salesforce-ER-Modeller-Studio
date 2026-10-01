import { normaliseArchitectureFinding } from '../architectureFindingContract';

describe('architecture finding contract', () => {
    it('always exposes action, evidence, recommendation, trade-off and limitation slots', () => {
        const finding = normaliseArchitectureFinding({
            id: 'relationship-concentration:Account',
            objectName: 'Account',
            finding: 'Account has broad structural connections.',
            whyItMatters: 'Changes may deserve wider review.',
            evidence: ['18 relationships'],
            recommendation: 'Review the relationship responsibilities.',
            modellingActions: ['Highlight Account on the ER diagram.'],
            tradeOffs: 'Do not redesign solely to reduce a metric.',
            limitation: 'Structural evidence does not prove runtime impact.'
        });
        expect(finding.whatWeFound).toContain('Account');
        expect(finding.evidence).toHaveLength(1);
        expect(finding.erDiagramSuggestions).toHaveLength(1);
        expect(finding.tradeOffs).toBeTruthy();
        expect(finding.limitations).toBeTruthy();
        expect(finding.actions.openImpactExplorer).toBe(true);
    });
});
