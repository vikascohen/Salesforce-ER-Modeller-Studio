import { LightningElement, api } from 'lwc';
import getStatus from '@salesforce/apex/FieldUsageController.getStatus';
import runNow from '@salesforce/apex/FieldUsageController.runNow';
import getScheduledJobs from '@salesforce/apex/FieldUsageController.getScheduledJobs';
import getSourceTypes from '@salesforce/apex/FieldUsageController.getSourceTypes';

export default class FieldUsageSettings extends LightningElement {
    @api schedules = [];
    status;
    jobs = [];
    sourceTypes = [];
    busy = false;
    message = '';

    connectedCallback() { this.refresh(); }

    async refresh() {
        this.busy = true;
        try {
            const [status, jobs, sourceTypes] = await Promise.all([
                getStatus({ runId: null }), getScheduledJobs(), getSourceTypes()
            ]);
            this.status = status;
            this.jobs = jobs || [];
            this.sourceTypes = sourceTypes || [];
            this.message = '';
        } catch (e) {
            this.message = e?.body?.message || e?.message || 'Unable to load Field Usage status.';
        } finally { this.busy = false; }
    }

    async handleRunNow() {
        if (this.scanRunning) return;
        this.busy = true;
        try {
            await runNow();
            this.message = 'Field Usage scan queued.';
            await this.refresh();
        } catch (e) {
            this.message = e?.body?.message || e?.message || 'Unable to start Field Usage scan.';
            this.busy = false;
        }
    }

    get run() { return this.status?.run || null; }
    get scanRunning() { return ['Queued','Running','Holding','Preparing','Processing'].includes(this.run?.Status__c) || ['Holding','Queued','Preparing','Processing'].includes(this.status?.jobStatus); }
    get snapshotState() { return this.run?.Is_Current__c && this.run?.Status__c === 'Completed' ? 'Current' : (this.run?.Status__c || 'Not scanned'); }
    get healthState() { return this.scanRunning ? 'Processing' : ((this.run?.Error_Count__c || 0) > 0 ? 'Attention' : (this.run?.Is_Current__c ? 'Healthy' : 'Not scanned')); }
    get dependencyCount() { return this.run?.Dependency_Count__c || 0; }
    get errorCount() { return this.run?.Error_Count__c || 0; }
    get progress() { return this.run?.Progress_Percent__c || 0; }
    get phase() { return this.run?.Progress_Phase__c || 'Idle'; }
    get lastCompleted() { return this.run?.Completed_At__c || '—'; }
    get hasJobs() { return this.jobs.length > 0; }
    get jobsView() { return this.jobs.map(j => ({...j, key:j.scheduleId || j.cronTriggerId || j.jobName, next:j.nextFireTime || '—', previous:j.previousFireTime || '—', state:j.state || (j.enabled?'Scheduled':'Paused')})); }
    get coverageRows() { return this.sourceTypes.map((name, i) => ({ key:`coverage-${i}`, name, status:'Supported' })); }
}