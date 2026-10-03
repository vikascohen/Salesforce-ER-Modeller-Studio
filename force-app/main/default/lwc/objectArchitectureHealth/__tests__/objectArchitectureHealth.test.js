import { createElement } from 'lwc';
import ObjectArchitectureHealth from 'c/objectArchitectureHealth';
import getObjectIntelligence from '@salesforce/apex/ObjectIntelligenceController.getObjectIntelligence';

jest.mock('@salesforce/apex/ObjectIntelligenceController.getObjectIntelligence',()=>({default:jest.fn()}),{virtual:true});

function flushPromises(){ return Promise.resolve(); }
function make(){ const el=createElement('c-object-architecture-health',{is:ObjectArchitectureHealth}); document.body.appendChild(el); return el; }

async function renderObject(objectApiName, metadata={}){
    getObjectIntelligence.mockResolvedValue({
        recordTypes:[], layouts:[], triggers:[], validationRules:[], flows:[],
        toolingLoaded:true, snapshotLoaded:true, toolingMessage:'',
        ...metadata
    });
    const el=make();
    el.objectApiName=objectApiName;
    await flushPromises();
    await flushPromises();
    return el;
}

describe('c-object-architecture-health',()=>{
    afterEach(()=>{ while(document.body.firstChild) document.body.removeChild(document.body.firstChild); jest.clearAllMocks(); });

    it('renders current architecture review signals from supplied metadata',async()=>{
        const el=await renderObject('Account');
        el.fields=[
            {apiName:'Id',label:'Account ID',dataType:'Id',isPrimaryKey:true},
            {apiName:'Customer_Number__c',label:'Customer Number',dataType:'Text',isCustom:true,description:'',required:true},
            {apiName:'Customer_No__c',label:'Customer No',dataType:'Text',isCustom:true,description:''},
            {apiName:'OwnerId',label:'Owner',dataType:'Lookup',isRelationship:true}
        ];
        await flushPromises();
        const text=el.shadowRoot.textContent;
        expect(text).toContain('Account');
        expect(text).toContain('Dependency & Object Intelligence');
        expect(text).toContain('Architecture review signals');
        expect(text).toContain('Required custom fields');
        expect(text).toContain('2 custom');
    });

    it('renders verified dependency and object metadata names and counts',async()=>{
        const el=await renderObject('Contact',{
            triggers:[{name:'ContactTrigger'}],
            validationRules:[{name:'Require_Email'}],
            flows:[{name:'Contact_After_Save'}],
            recordTypes:[{name:'Customer'}],
            layouts:[{name:'Contact Layout'}]
        });
        el.fields=[{apiName:'Email',label:'Email',dataType:'Email'}];
        await flushPromises();
        const text=el.shadowRoot.textContent;
        expect(text).toContain('Apex Triggers');
        expect(text).toContain('ContactTrigger');
        expect(text).toContain('Require_Email');
        expect(text).toContain('Contact_After_Save');
        expect(text).toContain('Customer');
        expect(text).toContain('Contact Layout');
    });

    it('does not claim record type or layout counts are architecture defects',async()=>{
        const el=await renderObject('Case',{
            recordTypes:Array.from({length:6},(_,i)=>({name:`Record Type ${i+1}`})),
            layouts:Array.from({length:8},(_,i)=>({name:`Layout ${i+1}`}))
        });
        el.fields=[];
        await flushPromises();
        const text=el.shadowRoot.textContent;
        expect(text).toContain('Record Types');
        expect(text).toContain('Page Layouts');
        expect(text).not.toContain('Record type proliferation');
        expect(text).not.toContain('Layout proliferation');
        expect(text).toContain('No architecture-health review signals');
    });
});