import { LightningElement, api } from 'lwc';
import getFieldDetail from '@salesforce/apex/DataDictionaryFieldDetailController.getFieldDetail';

export default class DataDictionaryFieldDetail extends LightningElement {
    _objectApiName;
    _fieldApiName;
    @api field;
    detail;
    loading = false;
    error = '';

    @api
    get objectApiName(){ return this._objectApiName; }
    set objectApiName(value){ this._objectApiName=value; this.load(); }

    @api
    get fieldApiName(){ return this._fieldApiName; }
    set fieldApiName(value){ this._fieldApiName=value; this.load(); }

    async load(){
        if(!this._objectApiName || !this._fieldApiName) return;
        this.loading=true; this.error='';
        try{
            this.detail=await getFieldDetail({objectApiName:this._objectApiName,fieldApiName:this._fieldApiName});
        }catch(e){
            this.detail=null;
            this.error=e?.body?.message||e?.message||'Unable to load field metadata.';
        }finally{ this.loading=false; }
    }

    handleClose(){ this.dispatchEvent(new CustomEvent('close')); }
    get title(){ return this.field?.apiName||this._fieldApiName||'Field'; }
    get label(){ return this.field?.label||this.detail?.label||''; }
    get description(){ return this.field?.description||'No description provided.'; }
    get type(){ return this.field?.dataType||this.detail?.dataType||'—'; }
    get required(){ return this.field?.required||'No'; }
    get custom(){ return this.field?.custom||'No'; }
    get usage(){ return this.field?.usage||'Not calculated'; }
    get lastModified(){ return this.field?.lastModified||'—'; }
    get relationshipType(){ return this.detail?.relationshipType||'—'; }
    get relationshipName(){ return this.detail?.relationshipName||'—'; }
    get targets(){ return (this.detail?.relatedObjects||[]).join(', ')||'—'; }
    get hasFormula(){ return !!this.detail?.formulaField && !!this.detail?.formula; }
    get hasRelationship(){ return !!this.detail?.relationship; }
    get isRollup(){ return !!this.detail?.rollupSummary; }
    get hasSpecialDetail(){ return this.hasFormula||this.hasRelationship||this.isRollup; }
    get detailMessage(){ return this.detail?.detailMessage||''; }
}