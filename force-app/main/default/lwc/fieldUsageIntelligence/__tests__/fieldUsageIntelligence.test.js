/**
 * Field Usage Intelligence Jest tests
 * @author Vikas Cohen
 */
import { createElement } from 'lwc';
import FieldUsageIntelligence from 'c/fieldUsageIntelligence';

jest.mock('@salesforce/apex/FieldUsageController.saveSchedules', () => ({ default: jest.fn(() => Promise.resolve()) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.deleteSchedule', () => ({ default: jest.fn(() => Promise.resolve()) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getObjects', () => ({ default: jest.fn(() => Promise.resolve(['Account', 'Contact'])) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getFields', () => ({ default: jest.fn(() => Promise.resolve(['Name', 'Industry'])) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getEvidenceSummary', () => ({ default: jest.fn(() => Promise.resolve([])) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.runNow', () => ({ default: jest.fn(() => Promise.resolve('a00000000000001')) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.bootstrap', () => ({ default: jest.fn(() => Promise.resolve()) }), { virtual: true });
jest.mock('@salesforce/apex/FieldUsageController.getStatus', () => ({ default: jest.fn(() => Promise.resolve({ run: null, schedules: [] })) }), { virtual: true });

const getFields = require('@salesforce/apex/FieldUsageController.getFields').default;
const getEvidenceSummary = require('@salesforce/apex/FieldUsageController.getEvidenceSummary').default;
const runScan = require('@salesforce/apex/FieldUsageController.runNow').default;
const getStatus = require('@salesforce/apex/FieldUsageController.getStatus').default;

function flushPromises(){return new Promise((resolve)=>setTimeout(resolve,0));}
function createComponent(){const element=createElement('c-field-usage-intelligence',{is:FieldUsageIntelligence});document.body.appendChild(element);return element;}

describe('c-field-usage-intelligence',()=>{
    afterEach(()=>{while(document.body.firstChild)document.body.removeChild(document.body.firstChild);jest.clearAllMocks();getStatus.mockResolvedValue({run:null,schedules:[]});getEvidenceSummary.mockResolvedValue([]);});

    it('loads objects and keeps Analyse disabled until an object and fields are selected',async()=>{
        const element=createComponent();await flushPromises();
        const analyseButton=Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button)=>button.label==='Analyse Selected Fields');
        expect(analyseButton.disabled).toBe(true);
        element.shadowRoot.querySelector('lightning-combobox').dispatchEvent(new CustomEvent('change',{detail:{value:'Account'}}));await flushPromises();
        expect(getFields).toHaveBeenCalledWith({objectApiName:'Account'});
        element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(new CustomEvent('change',{detail:{value:['Name']}}));await flushPromises();
        expect(analyseButton.disabled).toBe(false);
    });

    it('shows a running state and disables Run Scan Now when a scan is already active',async()=>{
        getStatus.mockResolvedValueOnce({run:{Status__c:'Running'},schedules:[]});const element=createComponent();await flushPromises();
        const runButton=Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button)=>button.label==='Run Scan Now');
        expect(runButton.disabled).toBe(true);expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();expect(element.shadowRoot.textContent).toContain('A field usage snapshot is currently being built.');
    });

    it('starts a manual scan and immediately presents the useful running message',async()=>{
        const element=createComponent();await flushPromises();const runButton=Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button)=>button.label==='Run Scan Now');runButton.click();await flushPromises();
        expect(runScan).toHaveBeenCalledTimes(1);expect(element.shadowRoot.textContent).toContain('Field usage scan is running. Please wait.');expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    });

    it('groups persisted summary by selected field',async()=>{
        getEvidenceSummary.mockResolvedValueOnce([{fieldApiName:'Industry',sourceType:'Formula Field',evidenceRows:1,occurrences:2}]);
        const element=createComponent();await flushPromises();element.shadowRoot.querySelector('lightning-combobox').dispatchEvent(new CustomEvent('change',{detail:{value:'Account'}}));await flushPromises();element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(new CustomEvent('change',{detail:{value:['Industry']}}));await flushPromises();Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button)=>button.label==='Analyse Selected Fields').click();await flushPromises();
        expect(getEvidenceSummary).toHaveBeenCalledWith({objectApiName:'Account',fieldApiNames:['Industry']});expect(element.shadowRoot.textContent).toContain('Industry');expect(element.shadowRoot.textContent).toContain('Formula Field');expect(element.shadowRoot.textContent).toContain('1 evidence row(s)');expect(element.shadowRoot.textContent).toContain('2 occurrence(s)');
    });

    it('renders Apex source summaries from the persisted snapshot',async()=>{
        getEvidenceSummary.mockResolvedValueOnce([{fieldApiName:'Name',sourceType:'Apex Class',evidenceRows:2,occurrences:3},{fieldApiName:'Name',sourceType:'Apex Trigger',evidenceRows:1,occurrences:1}]);
        const element=createComponent();await flushPromises();element.shadowRoot.querySelector('lightning-combobox').dispatchEvent(new CustomEvent('change',{detail:{value:'Account'}}));await flushPromises();element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(new CustomEvent('change',{detail:{value:['Name']}}));await flushPromises();Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button)=>button.label==='Analyse Selected Fields').click();await flushPromises();
        const text=element.shadowRoot.textContent;expect(text).toContain('Apex Class');expect(text).toContain('2 evidence row(s)');expect(text).toContain('3 occurrence(s)');expect(text).toContain('Apex Trigger');
    });

    it('keeps schema-selected fields visible when sparse summary has no dependency row',async()=>{
        getEvidenceSummary.mockResolvedValueOnce([{fieldApiName:'Name',sourceType:'Apex Class',evidenceRows:1,occurrences:1}]);
        const element=createComponent();await flushPromises();element.shadowRoot.querySelector('lightning-combobox').dispatchEvent(new CustomEvent('change',{detail:{value:'Account'}}));await flushPromises();element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(new CustomEvent('change',{detail:{value:['Name','Industry']}}));await flushPromises();Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((button)=>button.label==='Analyse Selected Fields').click();await flushPromises();
        const text=element.shadowRoot.textContent;expect(getEvidenceSummary).toHaveBeenCalledWith({objectApiName:'Account',fieldApiNames:['Name','Industry']});expect(text).toContain('Name');expect(text).toContain('Apex Class');expect(text).toContain('Industry');expect(text).toContain('No dependency detected');expect(text).toContain('0 dependencies');
    });
});
