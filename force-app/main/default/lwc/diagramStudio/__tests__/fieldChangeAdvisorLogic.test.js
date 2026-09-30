import { FIELD_CHANGE_TYPES, buildFieldProfile, buildChangeAdvice, getAdvisorAvailability } from '../fieldChangeAdvisorLogic';

describe('fieldChangeAdvisorLogic', () => {
    const evidence = [
        { fieldApiName: 'External_Id__c', sourceType: 'Flow', evidenceRows: 2, occurrences: 4 },
        { fieldApiName: 'External_Id__c', sourceType: 'Apex Class', evidenceRows: 1, occurrences: 2 },
        { fieldApiName: 'External_Id__c', sourceType: 'Validation Rule', evidenceRows: 1, occurrences: 1 }
    ];

    it('exposes supported change scenarios', () => {
        expect(FIELD_CHANGE_TYPES.map(x => x.value)).toEqual(expect.arrayContaining([
            'DELETE', 'RENAME', 'DATA_TYPE', 'SIZE', 'REQUIRED', 'UNIQUE', 'EXTERNAL_ID', 'RELATIONSHIP', 'FORMULA'
        ]));
    });

    it('builds a field profile from schema metadata', () => {
        expect(buildFieldProfile({ type: 'Text', required: true, unique: true, externalId: true, indexed: true })).toEqual({
            type: 'Text',
            flags: ['Required', 'Unique', 'External ID', 'Indexed'],
            isRelationship: false,
            isFormula: false
        });
    });

    it('interprets scan summary without hydrating evidence detail', () => {
        const result = buildChangeAdvice({
            objectApiName: 'Account',
            fieldApiName: 'External_Id__c',
            changeType: 'DATA_TYPE',
            fieldMetadata: { type: 'Text', externalId: true, indexed: true },
            evidenceSummary: evidence
        });
        expect(result.fieldKey).toBe('Account.External_Id__c');
        expect(result.totalOccurrences).toBe(7);
        expect(result.sourceTypeCount).toBe(3);
        expect(result.findings.some(x => x.key === 'type-expressions')).toBe(true);
        expect(result.findings.some(x => x.key === 'type-code')).toBe(true);
        expect(result.findings.some(x => x.key === 'profile-external')).toBe(true);
        expect(result.findings.some(x => x.key === 'profile-indexed')).toBe(true);
    });

    it('does not claim zero external impact when scan has no metadata dependency', () => {
        const result = buildChangeAdvice({ objectApiName: 'Account', fieldApiName: 'Unused__c', changeType: 'DELETE' });
        expect(result.findings.some(x => x.key === 'no-dependencies')).toBe(true);
        expect(result.findings.find(x => x.key === 'no-dependencies').detail).toContain('not proof');
    });

    it('requires a successful scan when no snapshot exists', () => {
        const state = getAdvisorAvailability({ snapshotAvailable: false, scanRunning: false });
        expect(state.ready).toBe(false);
        expect(state.state).toBe('SCAN_REQUIRED');
        expect(state.title).toBe('Org scan required');
    });

    it('waits when first scan is still running', () => {
        const state = getAdvisorAvailability({ snapshotAvailable: false, scanRunning: true });
        expect(state.ready).toBe(false);
        expect(state.state).toBe('WAITING');
    });

    it('keeps the last successful snapshot usable during a replacement scan', () => {
        const snapshotInfo = { completedAt: '2026-09-30T08:00:00.000Z', dependencyCount: 42 };
        const state = getAdvisorAvailability({ snapshotAvailable: true, scanRunning: true, snapshotInfo });
        expect(state.ready).toBe(true);
        expect(state.state).toBe('READY_REFRESHING');
        expect(state.snapshotInfo).toBe(snapshotInfo);
    });
});
