import { EXPECTED_SOURCE_TYPES, buildScanCoverage, coverageFreshnessLabel } from '../fieldUsageCoverageLogic';

describe('fieldUsageCoverageLogic', () => {
    it('keeps coverage interpretation independent from detailed evidence hydration', () => {
        const result = buildScanCoverage({
            snapshotInfo: { available: true, completedAt: '2026-10-01T01:00:00.000Z', dependencyCount: 12 },
            evidenceSummary: [
                { sourceType: 'Flow', evidenceRows: 5 },
                { sourceType: 'Apex Class', evidenceRows: 7 }
            ]
        });
        expect(result.snapshotAvailable).toBe(true);
        expect(result.dependencyCount).toBe(12);
        expect(result.categories.find(x => x.sourceType === 'Flow').evidenceRows).toBe(5);
        expect(result.categories.find(x => x.sourceType === 'LWC').evidenceRows).toBe(0);
    });

    it('documents all V3 scanner categories in one place', () => {
        expect(EXPECTED_SOURCE_TYPES).toEqual(expect.arrayContaining([
            'Apex Class', 'Apex Trigger', 'Flow', 'LWC', 'Aura', 'Formula Field', 'Validation Rule'
        ]));
    });

    it('does not describe zero evidence as proof of no usage', () => {
        expect(buildScanCoverage().note).toContain('not proof');
    });

    it('keeps a successful snapshot usable while replacement scan runs', () => {
        expect(coverageFreshnessLabel({ snapshotInfo: { available: true }, scanRunning: true }))
            .toBe('Using last successful snapshot while a newer scan runs');
    });
});
