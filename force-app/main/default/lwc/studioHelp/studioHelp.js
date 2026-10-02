import { LightningElement, api } from 'lwc';

const MANUAL_SECTIONS = [
    { key: 'getting-started', title: 'Getting Started', text: 'Create, import and edit Salesforce ER models from the Studio. Use the diagram workspace for modelling and Architecture Intelligence for analysis.' },
    { key: 'architecture', title: 'Architecture Intelligence', text: 'Architecture Intelligence analyses the current ER model, including topology, relationships, object impact, paths, hotspots and architecture findings.' },
    { key: 'field-usage', title: 'Field Usage', text: 'Field Usage is part of Architecture Intelligence. Select an object and field to inspect persisted dependency evidence across Apex Classes, Apex Triggers, Flows, LWC, Aura, Validation Rules and Formula Fields. Formula dependencies can originate on other objects.' },
    { key: 'field-usage-admin', title: 'Field Usage Administration', text: 'Settings > Field Usage is the operational control centre. It shows snapshot health, Run Scan Now progress, automatic schedules, scan jobs and history, and scanner coverage. Scans build a persisted snapshot so analysis does not repeatedly call Salesforce metadata APIs.' },
    { key: 'data-dictionary', title: 'Data Dictionary', text: 'Browse accessible Salesforce objects and fields, inspect metadata and usage information, and export dictionary data.' },
    { key: 'system', title: 'System Information', text: 'Settings > System Information shows Studio and Salesforce environment information useful for diagnostics and support.' }
];

export default class StudioHelp extends LightningElement {
    @api initialSection = 'configuration';
    section = 'configuration';
    searchText = '';

    connectedCallback() {
        this.section = this.initialSection === 'manual' ? 'manual' : 'configuration';
    }

    get configurationOpen() { return this.section === 'configuration'; }
    get manualOpen() { return this.section === 'manual'; }
    get configurationClass() { return this.configurationOpen ? 'nav-item active' : 'nav-item'; }
    get manualClass() { return this.manualOpen ? 'nav-item active' : 'nav-item'; }
    get manualSections() {
        const q = (this.searchText || '').trim().toLowerCase();
        return q ? MANUAL_SECTIONS.filter(x => `${x.title} ${x.text}`.toLowerCase().includes(q)) : MANUAL_SECTIONS;
    }
    get noManualResults() { return this.manualSections.length === 0; }

    showConfiguration() { this.section = 'configuration'; this.searchText = ''; }
    showManual() { this.section = 'manual'; }
    handleSearch(event) { this.searchText = event.target.value || ''; }
    clearSearch() { this.searchText = ''; }
    close() { this.dispatchEvent(new CustomEvent('close')); }
}