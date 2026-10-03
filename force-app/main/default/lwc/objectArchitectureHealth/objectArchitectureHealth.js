import { LightningElement, api } from 'lwc';

export default class ObjectArchitectureHealth extends LightningElement {
    _fields = [];
    _usageEvidence = [];
    _automation = [];
    _validationRules = [];
    _recordTypes = [];
    _layouts = [];
    _analysis = null;

    @api objectApiName = '';

    @api
    get fields() { return this._fields; }
    set fields(value) {
        this._fields = Array.isArray(value) ? value : [];
        this.rebuildAnalysis();
    }

    @api
    get usageEvidence() { return this._usageEvidence; }
    set usageEvidence(value) {
        this._usageEvidence = Array.isArray(value) ? value : [];
        this.rebuildAnalysis();
    }

    @api
    get automation() { return this._automation; }
    set automation(value) {
        this._automation = Array.isArray(value) ? value : [];
        this.rebuildAnalysis();
    }

    @api
    get validationRules() { return this._validationRules; }
    set validationRules(value) {
        this._validationRules = Array.isArray(value) ? value : [];
        this.rebuildAnalysis();
    }

    @api
    get recordTypes() { return this._recordTypes; }
    set recordTypes(value) {
        this._recordTypes = Array.isArray(value) ? value : [];
        this.rebuildAnalysis();
    }

    @api
    get layouts() { return this._layouts; }
    set layouts(value) {
        this._layouts = Array.isArray(value) ? value : [];
        this.rebuildAnalysis();
    }

    normalise(v) {
        return String(v || '')
            .replace(/__(c|r|x)$/i, '')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .toLowerCase()
            .trim();
    }

    tokens(v) {
        return new Set(this.normalise(v).split(/\s+/).filter(Boolean));
    }

    similarity(a, b) {
        const A = this.tokens(a);
        const B = this.tokens(b);
        if (!A.size || !B.size) return 0;
        let n = 0;
        A.forEach((x) => { if (B.has(x)) n++; });
        return n / Math.max(A.size, B.size);
    }

    rebuildAnalysis() {
        const rows = Array.isArray(this._fields) ? this._fields : [];
        const businessFields = rows.filter((f) => !f.isPrimaryKey);
        const customFields = businessFields.filter((f) => f.isCustom);
        const standardFields = businessFields.filter((f) => !f.isCustom);
        const relationships = businessFields.filter((f) => f.isRelationship);
        const derivedFields = businessFields.filter((f) => String(f.dataType || '').toLowerCase().includes('formula') || f.isRollupSummary);
        const customWithDescription = customFields.filter((f) => String(f.description || '').trim());
        const missingDescription = customFields.filter((f) => !String(f.description || '').trim());
        const requiredCustom = customFields.filter((f) => f.required);

        // Build possible-overlap evidence once per input change instead of on every render.
        // The previous getter repeated O(n^2) comparisons several times during one LWC
        // render, which made "Expand Intelligence" appear frozen on wide objects.
        const possibleOverlapPairs = [];
        for (let i = 0; i < businessFields.length && possibleOverlapPairs.length < 12; i++) {
            const a = businessFields[i];
            for (let j = i + 1; j < businessFields.length && possibleOverlapPairs.length < 12; j++) {
                const b = businessFields[j];
                const sameType = String(a.dataType || '') === String(b.dataType || '');
                if (!sameType) continue;
                const score = Math.max(
                    this.similarity(a.label || a.apiName, b.label || b.apiName),
                    this.similarity(a.apiName, b.apiName)
                );
                if (score >= 0.75 && this.normalise(a.apiName) !== this.normalise(b.apiName)) {
                    possibleOverlapPairs.push(`${a.apiName} ↔ ${b.apiName}`);
                }
            }
        }

        const findings = [];
        const add = (severity, title, evidence, recommendation, key) => findings.push({
            key: key || `${severity}-${findings.length}`,
            severity,
            title,
            evidence,
            recommendation,
            css: `health-finding health-${severity.toLowerCase()}`
        });

        if (missingDescription.length) {
            add(
                'Review',
                'Missing custom-field descriptions',
                `${missingDescription.length} of ${customFields.length} custom fields have no description: ${missingDescription.slice(0, 8).map((f) => f.apiName).join(', ')}${missingDescription.length > 8 ? ' …' : ''}`,
                'Add business-purpose descriptions where they are genuinely missing.',
                'missing-desc'
            );
        }

        if (possibleOverlapPairs.length) {
            add(
                'Attention',
                'Possible duplicate / semantic overlap',
                possibleOverlapPairs.join('; '),
                'These are similarity candidates only. Review the field purpose and data type before deciding whether any fields are duplicates.',
                'overlap'
            );
        }

        if (relationships.length >= 10) {
            add(
                'Review',
                'Relationship concentration',
                `${relationships.length} relationship fields are present on this object.`,
                'Review whether the relationship footprint remains understandable and whether each relationship still serves a distinct purpose.',
                'relationships'
            );
        }

        if (requiredCustom.length) {
            add(
                'Info',
                'Required custom fields',
                `${requiredCustom.length} custom fields are marked required.`,
                'Confirm requiredness is intentional across integrations, automation and record-creation paths.',
                'required'
            );
        }

        const sourceCounts = {};
        (this._usageEvidence || []).forEach((row) => {
            const source = row.sourceType || row.Source_Type__c || 'Unknown';
            sourceCounts[source] = (sourceCounts[source] || 0) + Number(row.evidenceRows || row.Occurrence_Count__c || 1);
        });

        const metadataStatus = [
            { key: 'triggers', label: 'Apex Trigger evidence', value: sourceCounts['Apex Trigger'] != null ? String(sourceCounts['Apex Trigger']) : 'Not loaded', verified: sourceCounts['Apex Trigger'] != null },
            { key: 'validation', label: 'Validation Rule evidence', value: sourceCounts['Validation Rule'] != null ? String(sourceCounts['Validation Rule']) : (this._validationRules.length ? String(this._validationRules.length) : 'Not loaded'), verified: sourceCounts['Validation Rule'] != null || this._validationRules.length > 0 },
            { key: 'flows', label: 'Flow evidence', value: sourceCounts.Flow != null ? String(sourceCounts.Flow) : 'Not loaded', verified: sourceCounts.Flow != null },
            { key: 'record-types', label: 'Record Types', value: this._recordTypes.length ? String(this._recordTypes.length) : 'Not loaded', verified: this._recordTypes.length > 0 },
            { key: 'layouts', label: 'Page Layouts', value: this._layouts.length ? String(this._layouts.length) : 'Not loaded', verified: this._layouts.length > 0 }
        ].map((row) => ({ ...row, css: row.verified ? 'health-evidence health-evidence-verified' : 'health-evidence health-evidence-unloaded' }));

        this._analysis = {
            rows,
            businessFields,
            customFields,
            standardFields,
            relationships,
            derivedFields,
            customWithDescription,
            missingDescription,
            requiredCustom,
            possibleOverlapPairs,
            findings,
            metadataStatus
        };
    }

    get analysis() {
        if (!this._analysis) this.rebuildAnalysis();
        return this._analysis;
    }

    get businessFields() { return this.analysis.businessFields; }
    get businessFieldCount() { return this.analysis.businessFields.length; }
    get standardCount() { return this.analysis.standardFields.length; }
    get customCount() { return this.analysis.customFields.length; }
    get relationshipCount() { return this.analysis.relationships.length; }
    get derivedCount() { return this.analysis.derivedFields.length; }
    get descriptionCoverageText() {
        const total = this.analysis.customFields.length;
        if (!total) return 'No custom fields';
        return `${this.analysis.customWithDescription.length}/${total}`;
    }
    get missingDescriptionCount() { return this.analysis.missingDescription.length; }
    get possibleOverlapCount() { return this.analysis.possibleOverlapPairs.length; }
    get findings() { return this.analysis.findings; }
    get findingCount() { return this.analysis.findings.length; }
    get attentionCount() { return this.analysis.findings.filter((f) => f.severity === 'Attention').length; }
    get reviewCount() { return this.analysis.findings.filter((f) => f.severity === 'Review').length; }
    get hasFindings() { return this.analysis.findings.length > 0; }
    get metadataStatus() { return this.analysis.metadataStatus; }
    get summary() {
        return `${this.businessFieldCount} business fields · ${this.standardCount} standard · ${this.customCount} custom · ${this.relationshipCount} relationships`;
    }
}