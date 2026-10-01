/**
 * Scan coverage interpretation for Field Usage and Field Change Advisor.
 * Pure/read-only module: no Apex, persistence, polling, or UI state.
 * @author Vikas Cohen
 */

const EXPECTED_SOURCE_TYPES = Object.freeze([
    'Apex Class',
    'Apex Trigger',
    'Flow',
    'LWC',
    'Aura',
    'Formula Field',
    'Validation Rule'
]);

export function buildScanCoverage({ snapshotInfo = {}, evidenceSummary = [], scanRunning = false } = {}) {
    const counts = new Map();
    (evidenceSummary || []).forEach(row => {
        const type = row?.sourceType || 'Other';
        counts.set(type, (counts.get(type) || 0) + Number(row?.evidenceRows || 0));
    });

    const categories = EXPECTED_SOURCE_TYPES.map(sourceType => ({
        sourceType,
        evidenceRows: counts.get(sourceType) || 0,
        hasEvidence: (counts.get(sourceType) || 0) > 0
    }));

    return {
        snapshotAvailable: !!snapshotInfo?.available,
        completedAt: snapshotInfo?.completedAt || null,
        dependencyCount: Number(snapshotInfo?.dependencyCount || 0),
        scanRunning: !!scanRunning,
        categories,
        note: 'Coverage describes the metadata categories inspected by the Field Usage capability. Zero detected evidence is not proof that a field has no runtime, report, integration, dynamic-code, or external consumer.'
    };
}

export function coverageFreshnessLabel({ snapshotInfo = {}, scanRunning = false } = {}) {
    if (!snapshotInfo?.available) return scanRunning ? 'First scan in progress' : 'No successful snapshot';
    return scanRunning ? 'Using last successful snapshot while a newer scan runs' : 'Using latest successful snapshot';
}

export { EXPECTED_SOURCE_TYPES };
