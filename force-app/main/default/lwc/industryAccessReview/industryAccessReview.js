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
    runId;
    reviewed = null;
    total = 0;
    finished = 0;
    activity = '';
    stopped = false;

    coverageDetail='';
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
    get showApply(){return this.canUpdate && Boolean(this.reviewed?.some(row=>row.needsObjectRead||row.fields.some(field=>field.eligible)));}
    get noApply(){return !this.showApply || this.noObjects;}
    get noAdmin(){return !this.loading && !this.canUpdate;}
    get hasResults(){return this.results.length > 0;}

    lastApplyRun=null;
    lastFailures=[];
    get hasApplyOutcome(){return Boolean(this.lastApplyRun)&&this.lastApplyRun===this.runId;}
    get hasFailures(){return this.lastFailures.length>0;}
    handleOpen(){return this.loadReview(false);}
    handleRefresh(){return this.loadReview(true);}
    async loadReview(refresh){
        this.open=true;
        this.phase='loading';
        this.results=[];
        this.options=[];this.reviewed=null;
        this.search='';this.coverageDetail='';
        this.status=refresh?'Refreshing remaining objects…':'Checking industry capabilities…';
        try{
            const d=await getReview();
            this.canUpdate=Boolean(d.canUpdate);this.runId=d.runId;
            if(this.lastApplyRun!==d.runId){this.lastApplyRun=null;this.lastFailures=[];}
            if(d.detected&&d.runId)this.coverageDetail=(d.recordedObjectCount??0)+' objects skipped in the last scan. '+(d.objects||[]).length+' objects still have proposed Read changes.';
            this.options=(d.objects||[]).map(name=>({name,selected:false}));
            this.status=this.runId?'Latest scan · SCAN_SKIP:'+this.runId:'Run a new scan to collect skips.';
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
    clearOutcome(){this.status='';this.results=[];this.reviewed=null;}
    handleCancel(){this.stopped=true;}
    handleReview(){return this.processObjects(false);}
    handleApply(){return this.processObjects(true);}

    async processObjects(apply){
        if(this.noObjects || (apply && !this.canUpdate))return;
        const selected=this.selected;
        const plan=this.reviewed||[];
        const completedReviews=[];
        this.clearOutcome();
        this.phase=apply?'apply':'review';
        this.total=selected.length;
        this.finished=0;
        this.stopped=false;
        let failures=0;
        const failedRows=[];
        try{
            const queue=selected.map(o=>o.name);
            const deferred=[];
            const ready=new Set();
            while(queue.length){
                const name=queue.shift();
                if(this.stopped)break;
                this.activity='Checking Read permissions for '+name+'…';
                try{
                    const review=apply?plan.find(r=>r.objectName===name):await getObjectReview({objectName:name,runId:this.runId});
                    if(!apply)completedReviews.push({...review,objectName:name});
                    const fields=(review.fields||[]).filter(f=>f.eligible).map(f=>f.name);
                    const skipped=(review.fields||[]).filter(f=>!f.eligible).map(f=>f.name);
                    const result=apply ? await this.applyObject(name,fields,review.needsObjectRead)
                        : {summary:(review.needsObjectRead?'Object Read missing. ':'')+fields.length+' missing field Read grants.',errors:[]};
                    // Retry only a reviewed dependency which the administrator selected and which later succeeded.
                    const waiting=(result.blockedBy||[]).filter(dep=>selected.some(o=>o.name===dep)&&!ready.has(dep));
                    if(waiting.length&&queue.length&&waiting.some(dep=>queue.includes(dep)||deferred.some(d=>d.name===dep))){
                        deferred.push({name,waiting,result});continue;
                    }
                    if(result.errors.length){failures++;failedRows.push({name,detail:result.errors.join(' · ')});}
                    else if(apply)ready.add(name);
                    const notes=[...result.errors];
                    if(!apply && fields.length)notes.push('Skipped fields eligible for Read: '+fields.join(', ')+'.');
                    if(skipped.length)notes.push('Other recorded skips: '+(review.fields||[]).filter(f=>!f.eligible).map(f=>f.name+' ('+f.message+')').join(', ')+'.');
                    if(review.partial)notes.push('Partial review. Some fields were not inspected.');
                    this.results=[...this.results,{name,summary:result.summary,detail:notes.join(' ')}];
                }catch(e){
                    failures++;failedRows.push({name,detail:this.errorText(e)});
                    this.results=[...this.results,{name,summary:'Could not finish this object.',detail:this.errorText(e)}];
                }
                this.finished++;
                for(let i=deferred.length-1;i>=0;i--){
                    if(deferred[i].waiting.every(dep=>ready.has(dep)))queue.push(deferred.splice(i,1)[0].name);
                }
            }
            if(!this.stopped){
                for(const row of deferred){
                    failures++;this.finished++;failedRows.push({name:row.name,detail:row.result.errors.join(' · ')});
                    this.results=[...this.results,{name:row.name,summary:'Prerequisite Read access is missing.',detail:row.result.errors.join(' ')}];
                }
            }
            if(!apply&&!failures&&!this.stopped&&completedReviews.length===selected.length)this.reviewed=completedReviews;
            const outcome=this.stopped && this.finished<this.total?'Stopped. ':apply?'Update complete. ':'Review complete. ';
            this.status=outcome+this.finished+' of '+this.total+' objects checked.'+(failures?' '+failures+' with errors.':'');
            if(apply){
                this.lastApplyRun=this.runId;this.lastFailures=failedRows;
                if(failures)this.dispatchEvent(new CustomEvent('studioerror',{detail:{source:'Diagnostic Settings',severity:'ERROR',message:'Industry Read update: '+failures+' object(s) with errors. '+failedRows.map(r=>r.name+' '+r.detail).join(' | ').slice(0,2200)},bubbles:true,composed:true}));
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
        const prerequisites=new Set();
        const errors=[],blockedBy=[];
        for(let offset=0;offset<Math.max(1,fields.length);offset+=100){
            const batch=fields.slice(offset,offset+100);
            this.activity=batch.length?'Updating '+name+' · fields '+(offset+1)+'–'+(offset+batch.length)+' of '+fields.length:'Adding Object Read for '+name+'…';
            try{
                const response=await applyReadAccess({objectName:name,fieldNames:batch,includeObjectRead:objectRead,runId:this.runId});
                for(const parent of response.addedPrerequisites||[])prerequisites.add(parent);
                for(const row of response.results||[]){
                    if(!row.eligible)errors.push(row.name+': '+row.message);
                    else if(row.name===name)addedObject=addedObject||row.message==='Object Read added.';
                    else if(row.message==='Read Access added.')granted++;
                }
                if(response.objectSuccess===false){
                    for(const error of errors){
                        const depends=error.split(/depends on permission\(s\):/i)[1]||'';
                        for(const match of depends.matchAll(/\bRead ([A-Za-z][A-Za-z0-9_]*)/g))blockedBy.push(match[1]);
                    }
                    break;
                }
            }catch(e){errors.push(this.errorText(e));break;}
        }
        return {summary:(addedObject?'Object Read added. ':'')+granted+' field Read grants added.'+(prerequisites.size?' Required Object Read added: '+[...prerequisites].join(', ')+'.':''),errors,blockedBy};
    }
    handleClose(){if(!this.busy){this.open=false;this.dispatchEvent(new CustomEvent('reviewclosed'));}}
    errorText(e){
        const body=e?.body;
        const values=[...(Array.isArray(body)?body:[]),...(body?.output?.errors||[]),...(body?.pageErrors||[]),...Object.values(body?.output?.fieldErrors||body?.fieldErrors||{}).flat()];
        return values.map(v=>v.message||v.errorCode).filter(Boolean).join(' | ')||body?.message||(typeof body==='string'&&body)||e?.message||e?.statusText||'Salesforce returned no error detail. Refresh Health Check and review the selected objects again.';
    }
}
