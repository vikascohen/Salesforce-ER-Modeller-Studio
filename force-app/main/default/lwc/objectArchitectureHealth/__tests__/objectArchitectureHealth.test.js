import { createElement } from 'lwc';
import ObjectArchitectureHealth from 'c/objectArchitectureHealth';

function flushPromises(){ return Promise.resolve(); }
function make(){ const el=createElement('c-object-architecture-health',{is:ObjectArchitectureHealth}); document.body.appendChild(el); return el; }

describe('c-object-architecture-health',()=>{
    afterEach(()=>{ while(document.body.firstChild) document.body.removeChild(document.body.firstChild); });

    it('renders deterministic architecture findings from supplied metadata',async()=>{
        const el=make();
        el.objectApiName='Account';
        el.fields=[
            {apiName:'Id',label:'Account ID',dataType:'Id',isPrimaryKey:true},
            {apiName:'Customer_Number__c',label:'Customer Number',dataType:'Text',isCustom:true,description:'',required:true},
            {apiName:'Customer_No__c',label:'Customer No',dataType:'Text',isCustom:true,description:''},
            {apiName:'OwnerId',label:'Owner',dataType:'Lookup',isRelationship:true}
        ];
        await flushPromises();
        expect(el.shadowRoot.textContent).toContain('Account');
        expect(el.shadowRoot.textContent).toContain('Missing custom-field descriptions');
        expect(el.shadowRoot.textContent).toContain('Dependency evidence unavailable');
        expect(el.shadowRoot.textContent).toContain('Required custom fields');
    });

    it('reports usage evidence when a snapshot is supplied',async()=>{
        const el=make();
        el.objectApiName='Contact';
        el.fields=[{apiName:'Email',label:'Email',dataType:'Email'}];
        el.usageEvidence=[{sourceType:'Apex',componentName:'ContactService'}];
        await flushPromises();
        expect(el.shadowRoot.textContent).toContain('Field Usage evidence available');
        expect(el.shadowRoot.textContent).toContain('1 dependency evidence rows');
    });

    it('flags record type and layout proliferation as review signals',async()=>{
        const el=make();
        el.objectApiName='Case';
        el.fields=[];
        el.recordTypes=new Array(6).fill({});
        el.layouts=new Array(8).fill({});
        await flushPromises();
        expect(el.shadowRoot.textContent).toContain('Record type proliferation');
        expect(el.shadowRoot.textContent).toContain('Layout proliferation');
    });
});