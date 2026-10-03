import { LightningElement, api } from 'lwc';
import getObjectIntelligence from '@salesforce/apex/ObjectIntelligenceController.getObjectIntelligence';

// Session cache: reopening Intelligence or returning to an object is instant and
// does not repeat Tooling API traffic during the same Studio session.
const objectIntelligenceCache = new Map();
const objectIntelligencePending = new Map();

export default class ObjectArchitectureHealth extends LightningElement {
    _objectApiName=''; _fields=[]; _usageEvidence=[]; _automation=[]; _validationRules=[]; _recordTypes=[]; _layouts=[]; _triggers=[]; _flows=[];
    _toolingLoaded=false; _snapshotLoaded=false; _metadataLoading=false; _metadataMessage=''; _analysis=null;

    @api get objectApiName(){return this._objectApiName;}
    set objectApiName(value){
        const next=String(value||'');
        if(next===this._objectApiName)return;
        this._objectApiName=next;
        this.loadObjectMetadata();
        this.rebuildAnalysis();
    }
    @api get fields(){return this._fields;} set fields(v){this._fields=Array.isArray(v)?v:[];this.rebuildAnalysis();}
    @api get usageEvidence(){return this._usageEvidence;} set usageEvidence(v){this._usageEvidence=Array.isArray(v)?v:[];this.rebuildAnalysis();}
    @api get automation(){return this._automation;} set automation(v){this._automation=Array.isArray(v)?v:[];this.rebuildAnalysis();}
    @api get validationRules(){return this._validationRules;} set validationRules(v){this._validationRules=Array.isArray(v)?v:[];this.rebuildAnalysis();}
    @api get recordTypes(){return this._recordTypes;} set recordTypes(v){this._recordTypes=Array.isArray(v)?v:[];this.rebuildAnalysis();}
    @api get layouts(){return this._layouts;} set layouts(v){this._layouts=Array.isArray(v)?v:[];this.rebuildAnalysis();}

    async loadObjectMetadata(){
        const name=this._objectApiName;
        if(!name)return;
        this._metadataLoading=true;this._metadataMessage='';
        try{
            let data=objectIntelligenceCache.get(name);
            if(!data){
                let pending=objectIntelligencePending.get(name);
                if(!pending){pending=getObjectIntelligence({objectApiName:name});objectIntelligencePending.set(name,pending);}
                data=await pending;
                objectIntelligencePending.delete(name);
                objectIntelligenceCache.set(name,data||{});
            }
            if(name!==this._objectApiName)return;
            this._recordTypes=Array.isArray(data.recordTypes)?data.recordTypes:[];
            this._layouts=Array.isArray(data.layouts)?data.layouts:[];
            this._triggers=Array.isArray(data.triggers)?data.triggers:[];
            this._validationRules=Array.isArray(data.validationRules)?data.validationRules:[];
            this._flows=Array.isArray(data.flows)?data.flows:[];
            this._toolingLoaded=data.toolingLoaded===true;
            this._snapshotLoaded=data.snapshotLoaded===true;
            this._metadataMessage=data.toolingMessage||'';
        }catch(e){
            if(name===this._objectApiName)this._metadataMessage=e?.body?.message||e?.message||'Object metadata could not be loaded.';
        }finally{
            if(name===this._objectApiName){this._metadataLoading=false;this.rebuildAnalysis();}
        }
    }

    normalise(v){return String(v||'').replace(/__(c|r|x)$/i,'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[^a-zA-Z0-9]+/g,' ').toLowerCase().trim();}
    tokens(v){return new Set(this.normalise(v).split(/\s+/).filter(Boolean));}
    similarity(a,b){const A=this.tokens(a),B=this.tokens(b);if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>{if(B.has(x))n++;});return n/Math.max(A.size,B.size);}
    itemNames(items){return (items||[]).map(x=>x?.name).filter(Boolean).join(', ');}

    rebuildAnalysis(){
        const rows=Array.isArray(this._fields)?this._fields:[], businessFields=rows.filter(f=>!f.isPrimaryKey), customFields=businessFields.filter(f=>f.isCustom), standardFields=businessFields.filter(f=>!f.isCustom);
        const relationships=businessFields.filter(f=>f.isRelationship), derivedFields=businessFields.filter(f=>String(f.dataType||'').toLowerCase().includes('formula')||f.isRollupSummary), customWithDescription=customFields.filter(f=>String(f.description||'').trim()), missingDescription=customFields.filter(f=>!String(f.description||'').trim()), requiredCustom=customFields.filter(f=>f.required);
        const possibleOverlapPairs=[];
        for(let i=0;i<businessFields.length&&possibleOverlapPairs.length<12;i++)for(let j=i+1;j<businessFields.length&&possibleOverlapPairs.length<12;j++){
            const a=businessFields[i],b=businessFields[j];if(String(a.dataType||'')!==String(b.dataType||''))continue;
            const score=Math.max(this.similarity(a.label||a.apiName,b.label||b.apiName),this.similarity(a.apiName,b.apiName));
            if(score>=.75&&this.normalise(a.apiName)!==this.normalise(b.apiName))possibleOverlapPairs.push(`${a.apiName} ↔ ${b.apiName}`);
        }
        const findings=[],add=(severity,title,evidence,recommendation,key)=>findings.push({key:key||`${severity}-${findings.length}`,severity,title,evidence,recommendation,css:`health-finding health-${severity.toLowerCase()}`});
        if(missingDescription.length)add('Review','Missing custom-field descriptions',`${missingDescription.length} of ${customFields.length} custom fields have no description: ${missingDescription.slice(0,8).map(f=>f.apiName).join(', ')}${missingDescription.length>8?' …':''}`,'Add business-purpose descriptions where they are genuinely missing.','missing-desc');
        if(possibleOverlapPairs.length)add('Attention','Possible duplicate / semantic overlap',possibleOverlapPairs.join('; '),'These are similarity candidates only. Review field purpose and data type before deciding whether fields are duplicates.','overlap');
        if(relationships.length>=10)add('Review','Relationship concentration',`${relationships.length} relationship fields are present on this object.`,'Review whether each relationship still serves a distinct purpose.','relationships');
        if(requiredCustom.length)add('Info','Required custom fields',`${requiredCustom.length} custom fields are marked required.`,'Confirm requiredness is intentional across integrations, automation and record-creation paths.','required');

        const status=(key,label,items,loaded)=>({key,label,value:loaded?String(items.length):(this._metadataLoading?'Loading…':'Not loaded'),detail:loaded?(items.length?this.itemNames(items):'None found'):'',css:loaded?'health-evidence health-evidence-verified':'health-evidence health-evidence-unloaded'});
        const metadataStatus=[
            status('triggers','Apex Triggers',this._triggers,this._toolingLoaded),
            status('validation','Validation Rules',this._validationRules,this._toolingLoaded),
            status('flows','Flows (scan evidence)',this._flows,this._snapshotLoaded),
            status('record-types','Record Types',this._recordTypes,true),
            status('layouts','Page Layouts',this._layouts,this._toolingLoaded)
        ];
        this._analysis={businessFields,customFields,standardFields,relationships,derivedFields,customWithDescription,missingDescription,requiredCustom,possibleOverlapPairs,findings,metadataStatus};
    }
    get analysis(){if(!this._analysis)this.rebuildAnalysis();return this._analysis;}
    get businessFieldCount(){return this.analysis.businessFields.length;} get standardCount(){return this.analysis.standardFields.length;} get customCount(){return this.analysis.customFields.length;} get relationshipCount(){return this.analysis.relationships.length;} get derivedCount(){return this.analysis.derivedFields.length;}
    get descriptionCoverageText(){const total=this.analysis.customFields.length;return total?`${this.analysis.customWithDescription.length}/${total}`:'No custom fields';}
    get missingDescriptionCount(){return this.analysis.missingDescription.length;} get possibleOverlapCount(){return this.analysis.possibleOverlapPairs.length;} get findings(){return this.analysis.findings;} get findingCount(){return this.analysis.findings.length;} get attentionCount(){return this.analysis.findings.filter(f=>f.severity==='Attention').length;} get reviewCount(){return this.analysis.findings.filter(f=>f.severity==='Review').length;} get hasFindings(){return this.analysis.findings.length>0;} get metadataStatus(){return this.analysis.metadataStatus;}
    get metadataMessage(){return this._metadataMessage;} get hasMetadataMessage(){return !!this._metadataMessage;} get metadataLoading(){return this._metadataLoading;}
    get summary(){return `${this.businessFieldCount} business fields · ${this.standardCount} standard · ${this.customCount} custom · ${this.relationshipCount} relationships`;}
}