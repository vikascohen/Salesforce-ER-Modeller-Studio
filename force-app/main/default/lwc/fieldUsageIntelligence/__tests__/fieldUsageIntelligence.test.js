/**
 * Field Usage Intelligence Jest tests
 *
 * @author Vikas Cohen
 */
import { createElement } from 'lwc';
import FieldUsageIntelligence from 'c/fieldUsageIntelligence';

jest.mock('@salesforce/apex/FieldUsageController.saveSchedules', () => ({ default: jest.fn(() => Promise.resolve()) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.deleteSchedule', () => ({ default: jest.fn(() => Promise.resolve()) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getObjects', () => ({ default: jest.fn(() => Promise.resolve(['Account', 'Contact'])) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getFields', () => ({ default: jest.fn(() => Promise.resolve(['Name', 'Industry'])) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getEvidence', () => ({ default: jest.fn(() => Promise.resolve([])) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.runNow', () => ({ default: jest.fn(() => Promise.resolve('a00000000000001')) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.bootstrap', () => ({ default: jest.fn(() => Promise.resolve()) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getStatus', () => ({ default: jest.fn(() => Promise.resolve({ run: null, schedules: [] })) }), { virtual: true });

const getFields = require('@salesforce/apex/FieldUsageController.getFields').default;
const getEvidence = require('@salesforce/apex/FieldUsageController.getEvidence').default;
const runScan = require('@salesforce/apex/FieldUsageController.runNow').default;
const getStatus = require('@salesforce/apex/FieldUsageController.getStatus').default;

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createComponent() {
    const element = createElement('c-field-usage-intelligence', {
        is: FieldUsageIntelligence
    });
    document.body.appendChild(element);
    return element;
}

describe('c-field-usage-intelligence', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
        getStatus.mockResolvedValue({ run: null, schedules: [] });
        getEvidence.mockResolvedValue([]);
    });

    it('loads objects and keeps Analyse disabled until an object and fields are selected', async () => {
        const element = createComponent();
        await flushPromises();

        const analyseButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === 'Analyse Selected Fields');

        expect(analyseButton.disabled).toBe(true);

        const objectPicker = element.shadowRoot.querySelector('lightning-combobox');
        objectPicker.dispatchEvent(
            new CustomEvent('change', { detail: { value: 'Account' } })
        );
        await flushPromises();

        expect(getFields).toHaveBeenCalledWith({ objectApiName: 'Account' });

        const fieldPicker = element.shadowRoot.querySelector('lightning-dual-listbox');
        fieldPicker.dispatchEvent(
            new CustomEvent('change', { detail: { value: ['Name'] } })
        );
        await flushPromises();

        expect(analyseButton.disabled).toBe(false);
    });

    it('shows a running state and disables Run Scan Now when a scan is already active', async () => {
        getStatus.mockResolvedValueOnce({
            run: { Status__c: 'Running' },
            schedules: []
        });

        const element = createComponent();
        await flushPromises();

        const runButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === 'Run Scan Now');

        expect(runButton.disabled).toBe(true);
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
        expect(element.shadowRoot.textContent).toContain(
            'A field usage snapshot is currently being built.'
        );
    });

    it('starts a manual scan and immediately presents the useful running message', async () => {
        const element = createComponent();
        await flushPromises();

        const runButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === 'Run Scan Now');

        runButton.click();
        await flushPromises();

        expect(runScan).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.textContent).toContain(
            'Field usage scan is running. Please wait.'
        );
        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    });

    it('groups persisted evidence by selected field', async () => {
        getEvidence.mockResolvedValueOnce([
            {
                Field_Key__c: 'Account.Industry',
                Field_API_Name__c: 'Industry',
                Source_Type__c: 'Formula Field',
                Component_Name__c: 'Risk_Score__c',
                Evidence_Type__c: 'Formula Reference',
                Confidence__c: 'High'
            }
        ]);

        const element = createComponent();
        await flushPromises();

        const objectPicker = element.shadowRoot.querySelector('lightning-combobox');
        objectPicker.dispatchEvent(
            new CustomEvent('change', { detail: { value: 'Account' } })
        );
        await flushPromises();

        const fieldPicker = element.shadowRoot.querySelector('lightning-dual-listbox');
        fieldPicker.dispatchEvent(
            new CustomEvent('change', { detail: { value: ['Industry'] } })
        );
        await flushPromises();

        const analyseButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === 'Analyse Selected Fields');
        analyseButton.click();
        await flushPromises();

        expect(getEvidence).toHaveBeenCalledWith({
            objectApiName: 'Account',
            fieldApiNames: ['Industry']
        });
        expect(element.shadowRoot.textContent).toContain('Industry');
        expect(element.shadowRoot.textContent).toContain('Formula Field');
        expect(element.shadowRoot.textContent).toContain('Risk_Score__c');
    });

    it('keeps an empty snapshot useful instead of rendering a blank result area', async () => {
        const element = createComponent();
        await flushPromises();

        const objectPicker = element.shadowRoot.querySelector('lightning-combobox');
        objectPicker.dispatchEvent(
            new CustomEvent('change', { detail: { value: 'Account' } })
        );
        await flushPromises();

        const fieldPicker = element.shadowRoot.querySelector('lightning-dual-listbox');
        fieldPicker.dispatchEvent(
            new CustomEvent('change', { detail: { value: ['Name'] } })
        );
        await flushPromises();

        const analyseButton = Array.from(
            element.shadowRoot.querySelectorAll('lightning-button')
        ).find((button) => button.label === 'Analyse Selected Fields');
        analyseButton.click();
        await flushPromises();

        expect(element.shadowRoot.textContent).toContain(
            'No persisted dependency evidence was found'
        );
    });
});
