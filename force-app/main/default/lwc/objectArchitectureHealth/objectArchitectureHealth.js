import { LightningElement, api } from 'lwc';

export default class ObjectArchitectureHealth extends LightningElement {
    @api objectApiName=''; @api fields=[]; @api usageEvidence=[]; @api automation=[]; @api validationRules=[]; @api recordTypes=[]; @api layouts=[];
    normalise(v){return String(v||'').replace(/__(c|r|x)$/i,'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[^a-zA-Z0-9]+/g,' ').toLowerCase().trim();}
    tokens(v){return new Set(this.normalise(v).split(/\s+/).filter(Boolean));}
    similarity(a,b){const A=this.tokens(a),B=this.tokens(b);if(!A.size||!B.size)return 0;let n=0;A.forEach(x=>{if(B.has(x))n++;});return n/Math.max(A.size,B.size);}
    get rows(){return Array.isArray(this.fields)?this.fields:[];}
    get businessFields(){return this.rows.filter(f=>!f.isPrimaryKey);}
    get customCount(){return this.businessFields.filter(f=>f.isCustom).length;}
    get relationshipCount(){return this.businessFields.filter(f=>f.isRelationship).length;}
    get derivedCount(){return this.businessFields.filter(f=>String(f.dataType||'').toLowerCase().includes('formula')||f.isRollupSummary).length;}
    get missingDescription(){return this.businessFields.filter(f=>f.isCustom&&!String(f.description||'').trim());}
    get requiredCustom(){return this.businessFields.filter(f=>f.isCustom&&f.required);}
    get findings(){const out=[];const add=(severity,title,evidence,recommendation,key)=>out.push({key:key||`${severity}-${out.length}`,severity,title,evidence,recommendation,css:`health-finding health-${severity.toLowerCase()}`});
        if(this.missingDescription.length)add('Review','Missing custom-field descriptions',`${this.missingDescription.length} custom fields have no description: ${this.missingDescription.slice(0,8).map(f=>f.apiName).join(', ')}${this.missingDescription.length>8?' …':''}`,'Add business-purpose descriptions so future architects can distinguish intent from implementation.','missing-desc');
        const odd=this.businessFields.filter(f=>f.isCustom&&(/\d{2,}/.test(f.apiName||'')||/_{2,}/.test(String(f.apiName||'').replace(/__c$/i,''))||this.normalise(f.apiName).length<3));
        if(odd.length)add('Review','Naming clarity candidates',`${odd.length} custom field names may be difficult to interpret consistently: ${odd.slice(0,8).map(f=>f.apiName).join(', ')}`,'Review against the organisation naming standard; this is a candidate signal, not an automatic defect.','naming');
        const pairs=[];for(let i=0;i<this.businessFields.length;i++){for(let j=i+1;j<this.businessFields.length;j++){const a=this.businessFields[i],b=this.businessFields[j];const sameType=String(a.dataType||'')===String(b.dataType||'');const score=Math.max(this.similarity(a.label||a.apiName,b.label||b.apiName),this.similarity(a.apiName,b.apiName));if(sameType&&score>=0.75&&this.normalise(a.apiName)!==this.normalise(b.apiName))pairs.push(`${a.apiName} ↔ ${b.apiName}`);if(pairs.length>=8)break;}if(pairs.length>=8)break;}
        if(pairs.length)add('Attention','Possible semantic overlap',pairs.join('; '),'Confirm whether these fields represent distinct business concepts before adding further dependencies.','overlap');
        if(this.relationshipCount>=10)add('Review','Relationship concentration',`${this.relationshipCount} relationship fields are present on this object.`,'Review whether the relationship footprint remains understandable and whether all relationships still serve distinct purposes.','relationships');
        if(this.requiredCustom.length)add('Info','Required custom fields',`${this.requiredCustom.length} custom fields are marked required.`,'Confirm requiredness is intentional across integrations, automation and record-creation paths.','required');
        if(!this.usageEvidence?.length)add('Info','Dependency evidence unavailable','No Field Usage evidence was supplied for this object.','Run Field Usage Intelligence for dependency-backed automation and change-impact evidence.','usage');
        else add('Info','Field Usage evidence available',`${this.usageEvidence.length} dependency evidence rows are available for this object.`,'Use dependency evidence when reviewing fields before changing or retiring metadata.','usage');
        if((this.recordTypes||[]).length>=6)add('Review','Record type proliferation',`${this.recordTypes.length} record types are associated with this object.`,'Review whether each record type still represents a distinct operational process.','record-types');
        if((this.layouts||[]).length>=8)add('Review','Layout proliferation',`${this.layouts.length} layouts are associated with this object.`,'Review layout-to-record-type assignments and retire redundant presentation variants where appropriate.','layouts');
        return out;
    }
    get findingCount(){return this.findings.length;}
    get attentionCount(){return this.findings.filter(f=>f.severity==='Attention').length;}
    get reviewCount(){return this.findings.filter(f=>f.severity==='Review').length;}
    get summary(){return `${this.businessFields.length} business fields · ${this.customCount} custom · ${this.relationshipCount} relationships · ${this.derivedCount} derived`;}
    get hasFindings(){return this.findings.length>0;}
}