/**
 * @author Vikas Cohen
 */
import { LightningElement, api } from 'lwc';

const GROUPS = {
    'Apex Class': 'Code',
    'Apex Trigger': 'Code',
    Flow: 'Automation',
    LWC: 'UI',
    Aura: 'UI',
    'Validation Rule': 'Rules',
    'Formula Field': 'Metadata'
};
const OMNI_TYPES = ['OmniScript', 'Integration Procedure', 'Omni Data Mapper'];

export default class FieldUsageScannerCoverage extends LightningElement {
    @api coverage = [];
    @api progressLog = '';

    get scanners() {
        const rows = this.coverage || [];
        const scanners = rows.filter(row => !OMNI_TYPES.includes(row.name))
            .map(row => ({ ...row, group: GROUPS[row.name] || 'Metadata' }));
        const omniCount = rows.filter(row => OMNI_TYPES.includes(row.name))
            .reduce((total, row) => total + Number(row.count || 0), 0);
        // Older snapshots can contain field evidence without a runtime probe.
        const probe = /^OmniStudio: ([^\n.]+)/m.exec(this.progressLog || '');
        if (omniCount || (probe && /\b(OmniProcess|OmniDataTransform)\b/.test(probe[1]))) {
            scanners.push({
                name: 'OmniStudio',
                group: 'Industry',
                status: omniCount ? 'Evidence found' : 'No field references recorded',
                count: omniCount
            });
        }
        return scanners.map(row => ({
            ...row,
            cssClass: `scanner-node scanner-${String(row.status).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        }));
    }

    get sourceCount() {
        return this.scanners.length;
    }

    get coverageSummary() {
        const sources = this.scanners;
        if (!sources.length) return 'Coverage unavailable';
        return `Field references found in ${sources.filter(row => row.count > 0).length} of ${sources.length} source types`;
    }
}
