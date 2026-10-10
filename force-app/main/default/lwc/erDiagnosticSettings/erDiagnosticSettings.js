import { LightningElement, track } from 'lwc';
import load from '@salesforce/apex/ErDiagnosticConfigController.load';
import save from '@salesforce/apex/ErDiagnosticConfigController.save';
import validateObject from '@salesforce/apex/ErDiagnosticConfigController.validateObject';
import validateField from '@salesforce/apex/ErDiagnosticConfigController.validateField';
const blank=()=>({enabled:false,objectApi:'',messageField:'',severityEnabled:false,severityField:'',errorValue:'ERROR',warningValue:'WARN',requiredFields:[]});
export default class ErDiagnosticSettings extends LightningElement {
    @track config=blank(); @track notices={}; @track busy=false; @track feedback=''; sequence=0; fieldTokens={};
    connectedCallback(){this.initialise();}
    async initialise(){this.busy=true;try{this.config={...blank(),...JSON.parse(await load())};}catch(e){this.feedback=this.error(e);}finally{this.busy=false;}}
    get enabled(){return this.config.enabled;}
    get severityEnabled(){return this.config.severityEnabled;}
    get fields(){return (this.config.requiredFields||[]).map((f,index)=>({...f,index,notice:this.notices['required-'+index]||''}));}
    get objectNotice(){return this.notices.objectApi||'';}
    get messageNotice(){return this.notices.messageField||'';}
    get severityNotice(){return this.notices.severityField||'';}
    get disabledSave(){return this.busy;}
    error(e){const message=e?.body?.message||e?.message||'Operation failed.';this.dispatchEvent(new CustomEvent('studioerror',{detail:{source:'Diagnostic Settings',message,severity:'ERROR'},bubbles:true,composed:true}));return message;}
    update(e){const name=e.target.dataset.name;const value=e.target.type==='checkbox'?e.target.checked:e.target.value;this.config={...this.config,[name]:value};this.feedback='';if(name==='objectApi'){this.sequence++;this.notices={};}}
    updateRequired(e){const index=Number(e.target.dataset.index),name=e.target.dataset.name;this.config={...this.config,requiredFields:this.config.requiredFields.map((f,i)=>i===index?{...f,[name]:e.target.value}:f)};}
    addField(){this.config={...this.config,requiredFields:[...this.config.requiredFields,{field:'',value:''}]};}
    removeField(e){const index=Number(e.currentTarget.dataset.index);this.config={...this.config,requiredFields:this.config.requiredFields.filter((f,i)=>i!==index)};this.notices={};}
    async validate(e){if(!this.config.enabled)return;const name=e.target.dataset.name;if(!name)return;const token=++this.sequence;this.fieldTokens[name]=token;const value=this.config[name];if(!value){this.notices={...this.notices,[name]:'Enter an API name.'};return;}try{const r=name==='objectApi'?await validateObject({objectApi:value}):await validateField({objectApi:this.config.objectApi,fieldApi:value,forMessage:name==='messageField'});if(token===this.fieldTokens[name])this.notices={...this.notices,[name]:r.message+(r.valid&&r.maxLength?' Maximum length: '+r.maxLength+'.':'')};}catch(err){if(token===this.fieldTokens[name])this.notices={...this.notices,[name]:this.error(err)};}}
    async validateRequired(e){if(!this.config.enabled)return;const index=Number(e.target.dataset.index),f=this.config.requiredFields[index];if(!f?.field)return;const key='required-'+index;const token=++this.sequence;this.fieldTokens[key]=token;try{const r=await validateField({objectApi:this.config.objectApi,fieldApi:f.field,forMessage:false});if(token===this.fieldTokens[key])this.notices={...this.notices,['required-'+index]:r.message};}catch(err){if(token===this.fieldTokens[key])this.notices={...this.notices,['required-'+index]:this.error(err)};}}
    async saveConfig(){this.busy=true;this.feedback='';try{await save({jsonConfig:JSON.stringify(this.config)});this.feedback='Error logging configuration saved.';}catch(e){this.feedback=this.error(e);}finally{this.busy=false;}}
}
