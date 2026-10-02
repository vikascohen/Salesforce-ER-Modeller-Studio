import { LightningElement, api } from 'lwc';

const DEFAULT_SCANNERS = [
    ['Apex Class', 'Code'],
    ['Apex Trigger', 'Code'],
    ['Flow', 'Automation'],
    ['LWC', 'UI'],
    ['Aura', 'UI'],
    ['Validation Rule', 'Rules'],
    ['Formula Field', 'Metadata']
];

export default class FieldUsageScannerCoverage extends LightningElement {
    @api coverage = [];

    get scanners() {
        const supplied = new Map((this.coverage || []).map(item => [item.name, item]));
        return DEFAULT_SCANNERS.map(([name, group]) => {
            const value = supplied.get(name) || {};
            const status = value.status || 'Ready';
            return {
                name,
                group,
                status,
                count: Number(value.count || 0),
                detail: value.detail || '',
                cssClass: `scanner-node scanner-${String(status).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
            };
        });
    }

    get healthyCount() {
        return this.scanners.filter(item => ['Ready', 'Completed', 'Healthy'].includes(item.status)).length;
    }

    get coverageSummary() {
        return `${this.healthyCount}/${this.scanners.length} scanners operational`;
    }
}