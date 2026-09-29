/**
 * Field Usage Intelligence
 *
 * @author Vikas Cohen
 */
import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import saveSchedules from '@salesforce/apex/FieldUsageController.saveSchedules';
import deleteSchedule from '@salesforce/apex/FieldUsageController.deleteSchedule';
import getObjects from '@salesforce/apex/FieldUsageController.getObjects';
import getFields from '@salesforce/apex/FieldUsageController.getFields';
import getEvidence from '@salesforce/apex/FieldUsageController.getEvidence';
import runScan from '@salesforce/apex/FieldUsageController.runNow';
import bootstrap from '@salesforce/apex/FieldUsageController.bootstrap';
import getStatus from '@salesforce/apex/FieldUsageController.getStatus';

export default class FieldUsageIntelligence extends LightningElement {
    @track objectOptions = [];
    @track fieldOptions = [];
    @track selectedFields = [];
    @track groups = [];
    @track schedules = [];

    selectedObject;
    running = false;
    message;

    connectedCallback() {
        this.initialise();
    }

    async initialise() {
        try {
            await bootstrap();
            const [objects, status] = await Promise.all([getObjects(), getStatus()]);
            this.objectOptions = objects.map((value) => ({ label: value, value }));
            this.applyStatus(status);
        } catch (error) {
            this.handleError(error);
        }
    }

    async handleObject(event) {
        this.selectedObject = event.detail.value;
        this.selectedFields = [];
        this.groups = [];

        try {
            const fields = await getFields({ objectApiName: this.selectedObject });
            this.fieldOptions = fields.map((value) => ({ label: value, value }));
        } catch (error) {
            this.handleError(error);
        }
    }

    handleFields(event) {
        this.selectedFields = event.detail.value;
    }

    get disableAnalyse() {
        return !this.selectedObject || !this.selectedFields.length;
    }

    async loadEvidence() {
        try {
            const rows = await getEvidence({
                objectApiName: this.selectedObject,
                fieldApiNames: this.selectedFields
            });
            const byField = {};

            rows.forEach((row, index) => {
                if (!byField[row.Field_API_Name__c]) {
                    byField[row.Field_API_Name__c] = [];
                }

                byField[row.Field_API_Name__c].push({
                    key: `${row.Field_Key__c}-${index}`,
                    source: row.Source_Type__c,
                    component: row.Component_Name__c,
                    type: row.Evidence_Type__c,
                    confidence: row.Confidence__c,
                    count: row.Occurrence_Count__c || 1,
                    location: row.Location__c || row.Evidence_Type__c || 'Evidence'
                });
            });

            this.groups = [...this.selectedFields]
                .sort()
                .map((field) => ({
                    key: field,
                    field,
                    noDependency: !byField[field]?.length,
                    items: byField[field] || []
                }));

            this.message = undefined;
        } catch (error) {
            this.handleError(error);
        }
    }

    async runNow() {
        try {
            this.running = true;
            this.message = 'Starting field usage scan…';
            await runScan();
            this.message =
                'Field usage scan is running. Please wait. The last successful snapshot remains available.';
        } catch (error) {
            this.handleError(error);
            await this.refreshStatus();
        }
    }

    async refreshStatus() {
        try {
            this.applyStatus(await getStatus());
        } catch (error) {
            this.handleError(error);
        }
    }

    scheduleChange(event) {
        const index = Number(event.target.dataset.index);
        const field = event.target.dataset.field;
        const rows = this.schedules.map((row) => ({ ...row }));

        rows[index][field] =
            field === 'Enabled__c'
                ? event.target.checked
                : field === 'Name'
                  ? event.target.value
                  : Number(event.target.value);

        this.schedules = rows;
    }

    addSchedule() {
        this.schedules = [
            ...this.schedules,
            {
                key: `new-${Date.now()}`,
                Name: 'Additional Scan',
                Hour__c: 12,
                Minute__c: 0,
                Enabled__c: true
            }
        ];
    }

    async removeSchedule(event) {
        const index = Number(event.currentTarget.dataset.index);
        const row = this.schedules[index];

        try {
            if (row.Id) {
                await deleteSchedule({ scheduleId: row.Id });
            }
            this.schedules = this.schedules.filter((_, rowIndex) => rowIndex !== index);
            this.message = 'Schedule removed.';
        } catch (error) {
            this.handleError(error);
        }
    }

    async saveSchedule() {
        try {
            await saveSchedules({
                rows: this.schedules.map(({ key, minuteDisplay, ...row }) => row)
            });
            this.message = 'Automatic scan schedule saved.';
            await this.refreshStatus();
        } catch (error) {
            this.handleError(error);
        }
    }

    applyStatus(status) {
        this.schedules = (status.schedules || []).map((row) => ({
            ...row,
            key: row.Id,
            minuteDisplay: String(row.Minute__c || 0).padStart(2, '0')
        }));

        this.running =
            !!status.run && ['Queued', 'Running'].includes(status.run.Status__c);

        if (status.run) {
            this.message =
                'Latest scan: ' +
                status.run.Status__c +
                (status.run.Completed_At__c
                    ? ' · ' + new Date(status.run.Completed_At__c).toLocaleString()
                    : '');
        }
    }

    handleError(error) {
        this.running = false;
        const message = error?.body?.message || error?.message || 'Unexpected error';
        this.message = message;
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Field Usage Intelligence',
                message,
                variant: 'error'
            })
        );
    }
}
