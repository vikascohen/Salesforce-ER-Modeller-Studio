import { LightningElement } from 'lwc';
import getReview from '@salesforce/apex/StudioDiagnosticsController.getIndustryReview';
import getObjectReview from '@salesforce/apex/StudioDiagnosticsController.getIndustryObjectReview';
import applyReadAccess from '@salesforce/apex/StudioDiagnosticsController.applyIndustryReadAccess';
import runDiagnostics from '@salesforce/apex/StudioDiagnosticsController.runDiagnostics';

export default class IndustryAccessReview extends LightningElement {
    open=false; busy=false; canUpdate=false; options=[]; reviews=[]; results=[]; search=''; status=''; progress=0; partial=false; cancelled=false;
    get visibleOptions(){const q=this.search.toLowerCase();return this.options.filter(o=>o.name.toLowerCase().includes(q));}
    get hasReviews(){return this.reviews.length>0;}
    get hasResults(){return this.results.length>0;}
    get noObjects(){return !this.options.some(o=>o.selected)||this.busy;}
    get noApply(){return this.busy||!this.canUpdate||!this.reviews.some(o=>o.selected||o.fields.some(f=>f.selected));}
    get noAdmin(){return !this.canUpdate;}
    get selectedCount(){return this.reviews.reduce((n,o)=>n+(o.selected?1:0)+o.fields.filter(f=>f.selected).length,0);}
    get progressLabel(){return this.status+' ('+this.progress+'%)';}
    async handleOpen(){
        this.open=true;this.busy=true;this.status='Detecting Industry Cloud capabilities…';
        try{
            const d=await getReview();this.canUpdate=!!d.canUpdate;this.partial=!!d.partial;
            this.options=(d.objects||[]).map(name=>({name,selected:false}));
            this.status=d.detected?'Choose objects to review. No permissions have changed.':'No supported Industry Cloud capabilities detected.';
            if(d.partial)this.status+=' Detection is partial; only verified objects are listed.';
        }catch(e){this.fail(e);}finally{this.busy=false;}
    }
    handleSearch(e){this.search=e.target.value;}
    handleObject(e){const name=e.target.dataset.name;this.options=this.options.map(o=>o.name===name?{...o,selected:e.target.checked}:o);}
    handleAllObjects(){this.options=this.options.map(o=>({...o,selected:true}));}
    handleClearObjects(){this.options=this.options.map(o=>({...o,selected:false}));}
    handleCancel(){this.cancelled=true;}
    async handleReview(){
        const names=this.options.filter(o=>o.selected).map(o=>o.name);
        this.busy=true;this.cancelled=false;this.reviews=[];this.results=[];this.progress=0;
        try{
            for(let i=0;i<names.length;i++){
                if(this.cancelled)break;
                this.status='Reviewing '+names[i]+' · '+(i+1)+' of '+names.length;
                try{
                    const r=await getObjectReview({objectName:names[i]});
                    this.reviews=[...this.reviews,{...r,selected:false,objectReadLocked:!r.objectOnlyAllowed,fields:(r.fields||[]).map(f=>({...f,key:names[i]+'.'+f.name,selected:false,disabled:!f.eligible}))}];
                }catch(e){this.results=[...this.results,{key:'review-'+names[i],name:names[i],message:this.errorText(e),css:'failure'}];}
                this.progress=Math.round((i+1)*100/names.length);
            }
            this.status=this.cancelled?'Review stopped. Only loaded objects can be selected.':'Review complete. Select eligible Read permissions below. Nothing has been applied.';
        }finally{this.busy=false;}
    }
    handleObjectRead(e){const name=e.target.dataset.object;this.reviews=this.reviews.map(o=>o.objectName===name?{...o,selected:e.target.checked,fields:o.fields.map(f=>({...f,selected:!e.target.checked&&o.needsObjectRead?false:f.selected}))}:o);}
    handleField(e){
        const {object,field}=e.target.dataset;
        this.reviews=this.reviews.map(row=>{
            if(row.objectName!==object)return row;
            const fields=row.fields.map(item=>item.name===field?{...item,selected:item.eligible&&e.target.checked}:item);
            return {...row,fields,selected:row.needsObjectRead&&(fields.some(item=>item.selected)||(row.objectOnlyAllowed&&row.selected))};
        });
    }
    handleSelectAll(){this.reviews=this.reviews.map(o=>({...o,selected:o.needsObjectRead,fields:o.fields.map(f=>({...f,selected:!!f.eligible}))}));}
    handleClear(){this.reviews=this.reviews.map(o=>({...o,selected:false,fields:o.fields.map(f=>({...f,selected:false}))}));}
    async handleApply(){
        if(this.noApply)return;
        const work=[];
        for(const o of this.reviews){
            const fields=o.fields.filter(f=>f.selected&&f.eligible).map(f=>f.name);
            if(!o.selected&&!fields.length)continue;
            if(!fields.length)work.push({objectName:o.objectName,fieldNames:[],includeObjectRead:o.selected});
            for(let i=0;i<fields.length;i+=100)work.push({objectName:o.objectName,fieldNames:fields.slice(i,i+100),includeObjectRead:o.selected});
        }
        this.busy=true;this.cancelled=false;this.progress=0;this.results=[];
        let completed=0,failures=0;
        for(const request of work){
            if(this.cancelled)break;
            this.status='Updating '+request.objectName+' · '+(completed+1)+' of '+work.length+' batches';
            try{
                const r=await applyReadAccess(request);
                for(const item of r.results||[]){
                    if(!item.eligible)failures++;
                    this.results=[...this.results,{key:String(this.results.length),name:item.name,message:item.message,css:item.eligible?'success':'failure'}];
                }
            }catch(e){failures++;this.results=[...this.results,{key:String(this.results.length),name:request.objectName,message:this.errorText(e),css:'failure'}];}
            completed++;this.progress=Math.round(completed*100/work.length);
        }
        this.status=(this.cancelled?'Stopped after ':'Finished ')+completed+' of '+work.length+' batches. '+failures+' item(s) could not be applied. Completed changes remain saved.';
        if(failures)this.dispatchEvent(new CustomEvent('studioerror',{detail:{source:'Diagnostic Settings',severity:'ERROR',message:'Industry Read access update: '+failures+' item(s) failed. '+this.results.filter(r=>r.css==='failure').map(r=>r.name+': '+r.message).join(' | ').slice(0,3000)},bubbles:true,composed:true}));
        try{
            const health=await runDiagnostics();
            const check=(health.checks||[]).find(c=>c.key==='scanAccess');
            this.status+=' Recheck: '+(check?.detail||health.summary);
        }catch(e){this.status+=' Recheck failed: '+this.errorText(e);}
        this.reviews=[];this.busy=false;
    }
    handleClose(){if(this.busy)return;this.open=false;this.dispatchEvent(new CustomEvent('reviewclosed'));}
    fail(e){this.status=this.errorText(e);}
    errorText(e){return e?.body?.message||e?.message||'Unable to complete the access review.';}
}
