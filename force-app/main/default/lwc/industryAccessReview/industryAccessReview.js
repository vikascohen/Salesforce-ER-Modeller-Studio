import { LightningElement } from 'lwc';
import getReview from '@salesforce/apex/StudioDiagnosticsController.getIndustryReview';
import getObjectReview from '@salesforce/apex/StudioDiagnosticsController.getIndustryObjectReview';
import applyReadAccess from '@salesforce/apex/StudioDiagnosticsController.applyIndustryReadAccess';
import runDiagnostics from '@salesforce/apex/StudioDiagnosticsController.runDiagnostics';

export default class IndustryAccessReview extends LightningElement {
    open = false;
    canUpdate = false;
    options = [];
    results = [];
    search = '';
    status = '';
    phase = '';
    total = 0;
    finished = 0;
    activity = '';
    stopped = false;

    get busy(){return Boolean(this.phase);}
    get loading(){return this.phase === 'loading';}
    get working(){return this.phase === 'review' || this.phase === 'apply' || this.phase === 'recheck';}
    get stopDisabled(){return this.stopped || this.phase === 'recheck';}
    get reviewButtonLabel(){return this.phase === 'review' ? 'Reviewing objects…' : 'Review selected objects';}
    get applyButtonLabel(){return this.phase === 'apply' ? 'Applying Read permissions…' : 'Apply Fix';}
    get visibleOptions(){return this.options.filter(o=>o.name.toLowerCase().includes(this.search.toLowerCase()));}
    get selected(){return this.options.filter(o=>o.selected);}
    get selectionCount(){return this.selected.length;}
    get noObjects(){return this.busy || !this.selectionCount;}
    get noApply(){return !this.canUpdate || this.noObjects;}
    get noAdmin(){return !this.loading && !this.canUpdate;}
    get hasResults(){return this.results.length > 0;}

    async handleOpen(){
        this.open=true;
        this.phase='loading';
        this.results=[];
        this.options=[];
        this.search='';
        this.status='Checking industry capabilities…';
        try{
            const d=await getReview();
            this.canUpdate=Boolean(d.canUpdate);
            this.options=(d.objects||[]).map(name=>({name,selected:false}));
            this.status=d.partial ? 'Partial inventory. Choose from the verified objects below.' : '';
        }catch(e){this.status=this.errorText(e);}
        finally{this.phase='';}
    }
    handleSearch(e){this.search=e.target.value;}
    handleObject(e){
        this.options=this.options.map(o=>o.name===e.target.dataset.name?{...o,selected:e.target.checked}:o);
        this.clearOutcome();
    }
    handleAllObjects(){this.options=this.options.map(o=>({...o,selected:true}));this.clearOutcome();}
    handleClearObjects(){this.options=this.options.map(o=>({...o,selected:false}));this.clearOutcome();}
    clearOutcome(){this.status='';this.results=[];}
    handleCancel(){this.stopped=true;}
    handleReview(){return this.processObjects(false);}
    handleApply(){return this.processObjects(true);}

    async processObjects(apply){
        if(this.noObjects || (apply && !this.canUpdate))return;
        const selected=this.selected;
        this.clearOutcome();
        this.phase=apply?'apply':'review';
        this.total=selected.length;
        this.finished=0;
        this.stopped=false;
        let failures=0;
        try{
            for(const {name} of selected){
                if(this.stopped)break;
                this.activity='Checking Read permissions for '+name+'…';
                try{
                    const review=await getObjectReview({objectName:name});
                    const fields=(review.fields||[]).filter(f=>f.eligible).map(f=>f.name);
                    const skipped=(review.fields||[]).filter(f=>!f.eligible).map(f=>f.name);
                    const result=apply ? await this.applyObject(name,fields,review.needsObjectRead)
                        : {summary:(review.needsObjectRead?'Object Read missing. ':'')+fields.length+' missing field Read grants.',errors:[]};
                    if(result.errors.length)failures++;
                    const notes=[...result.errors];
                    if(skipped.length)notes.push('Unavailable: '+skipped.join(', ')+'.');
                    if(review.partial)notes.push('Partial review. Some fields were not inspected.');
                    this.results=[...this.results,{name,summary:result.summary,detail:notes.join(' ')}];
                }catch(e){
                    failures++;
                    this.results=[...this.results,{name,summary:'Could not finish this object.',detail:this.errorText(e)}];
                }
                this.finished++;
            }
            const outcome=this.stopped && this.finished<this.total?'Stopped. ':apply?'Update complete. ':'Review complete. ';
            this.status=outcome+this.finished+' of '+this.total+' objects checked.'+(failures?' '+failures+' with errors.':'');
            if(apply){
                if(failures)this.dispatchEvent(new CustomEvent('studioerror',{detail:{source:'Diagnostic Settings',severity:'ERROR',message:'Industry Read update: '+failures+' object(s) with errors. '+this.results.filter(r=>r.detail).map(r=>r.name+' '+r.detail).join(' | ').slice(0,2200)},bubbles:true,composed:true}));
                this.phase='recheck';
                this.activity='Rechecking Diagram Studio User…';
                try{
                    const health=await runDiagnostics();
                    this.status+=' '+((health.checks||[]).find(c=>c.key==='scanAccess')?.detail||health.summary||'');
                }catch(e){this.status+=' Recheck failed: '+this.errorText(e);}
            }
        }finally{this.phase='';}
    }
    async applyObject(name,fields,objectRead){
        if(!objectRead && !fields.length)return {summary:'No missing configurable Read permissions.',errors:[]};
        let granted=0, addedObject=false;
        const errors=[];
        for(let offset=0;offset<Math.max(1,fields.length);offset+=100){
            const batch=fields.slice(offset,offset+100);
            this.activity=batch.length?'Updating '+name+' · fields '+(offset+1)+'–'+(offset+batch.length)+' of '+fields.length:'Adding Object Read for '+name+'…';
            try{
                const response=await applyReadAccess({objectName:name,fieldNames:batch,includeObjectRead:objectRead});
                for(const row of response.results||[]){
                    if(!row.eligible)errors.push(row.name+': '+row.message);
                    else if(row.name===name)addedObject=addedObject||row.message==='Object Read added.';
                    else if(row.message==='Read Access added.')granted++;
                }
                if(response.objectSuccess===false)break;
            }catch(e){errors.push(this.errorText(e));break;}
        }
        return {summary:(addedObject?'Object Read added. ':'')+granted+' field Read grants added.',errors};
    }
    handleClose(){if(!this.busy){this.open=false;this.dispatchEvent(new CustomEvent('reviewclosed'));}}
    errorText(e){return e?.body?.message||e?.message||'Unable to complete the access review.';}
}
