import { LightningElement } from 'lwc';
import getStatus from '@salesforce/apex/FieldUsageController.getStatus';
import runNow from '@salesforce/apex/FieldUsageController.runNow';
import saveSchedules from '@salesforce/apex/FieldUsageController.saveSchedules';
import deleteSchedule from '@salesforce/apex/FieldUsageController.deleteSchedule';
import getScheduledJobs from '@salesforce/apex/FieldUsageController.getScheduledJobs';
import pauseSchedule from '@salesforce/apex/FieldUsageController.pauseSchedule';
import resumeSchedule from '@salesforce/apex/FieldUsageController.resumeSchedule';
import getSourceTypes from '@salesforce/apex/FieldUsageController.getSourceTypes';
import getRecentRuns from '@salesforce/apex/FieldUsageController.getRecentRuns';

export default class FieldUsageSettings extends LightningElement {
    status; jobs=[]; sourceTypes=[]; schedules=[]; history=[]; busy=false; message=''; scheduleSeq=0; poller=null; activeRunId=null;

    connectedCallback(){ this.refresh(); this.startPolling(); }
    disconnectedCallback(){ this.stopPolling(); }
    startPolling(){
        this.stopPolling();
        this.poller=window.setInterval(async()=>{
            try{ await this.refresh(false); }catch(_){/* retry next poll */}
        },3000);
    }
    stopPolling(){ if(this.poller){window.clearInterval(this.poller);this.poller=null;} }

    async refresh(showBusy=true){
        if(showBusy)this.busy=true;
        try{
            const requestedRunId=this.activeRunId;
            const [status,jobs,sourceTypes,history]=await Promise.all([
                getStatus({runId:requestedRunId}), getScheduledJobs(), getSourceTypes(), getRecentRuns({rowLimit:10})
            ]);
            const returnedRun=status?.run||null;
            const returnedRunning=['Queued','Running','Holding','Preparing','Processing'].includes(returnedRun?.Status__c)||['Holding','Queued','Preparing','Processing'].includes(status?.jobStatus);
            if(requestedRunId && returnedRun && !returnedRunning){
                this.activeRunId=null;
                const latest=await getStatus({runId:null});
                this.status=latest;
                this.schedules=(latest?.schedules||[]).map(r=>({...r,_key:r.Id||`new-${++this.scheduleSeq}`}));
            }else{
                this.status=status;
                this.schedules=(status?.schedules||[]).map(r=>({...r,_key:r.Id||`new-${++this.scheduleSeq}`}));
            }
            this.jobs=jobs||[];
            this.sourceTypes=sourceTypes||[];
            this.history=(history||[]).slice(0,10);
            if(showBusy)this.message='';
        }catch(e){ this.message=this.errorText(e,'Unable to load Field Usage operations.'); }
        finally{ if(showBusy)this.busy=false; }
    }

    async handleRunNow(){
        if(this.scanRunning)return;
        this.busy=true; this.message='Starting Field Usage scan...';
        this.status={...(this.status||{}),run:{Status__c:'Queued',Progress_Percent__c:0,Progress_Phase__c:'Waiting for background scan to start',Objects_Processed__c:0,Objects_Total__c:0,Dependency_Count__c:0,Error_Count__c:0},jobStatus:'Queued',jobProcessed:0,jobTotal:0,jobErrors:0};
        try{
            const runId=await runNow(); this.activeRunId=runId;
            this.status={...(this.status||{}),run:{...(this.status?.run||{}),Id:runId,Status__c:'Queued',Progress_Percent__c:0,Progress_Phase__c:'Waiting for background scan to start'}};
            this.message='Field Usage scan queued.'; this.startPolling(); await this.refresh(false);
        }catch(e){
            this.message=this.errorText(e,'Unable to start Field Usage scan.');
            if(/already running/i.test(this.message)){this.activeRunId=null;await this.refresh(false);}
        }finally{this.busy=false;}
    }

    handleAddSchedule(){this.schedules=[...this.schedules,{_key:`new-${++this.scheduleSeq}`,Name:'Field Usage Schedule',Enabled__c:true,Hour__c:3,Minute__c:0}];}
    changeSchedule(key,patch){this.schedules=this.schedules.map(r=>r._key===key?{...r,...patch}:r);}
    handleName(e){this.changeSchedule(e.currentTarget.dataset.key,{Name:e.target.value});}
    handleEnabled(e){this.changeSchedule(e.currentTarget.dataset.key,{Enabled__c:e.target.checked});}
    handleHour(e){this.changeSchedule(e.currentTarget.dataset.key,{Hour__c:Number(e.target.value)});}
    handleMinute(e){this.changeSchedule(e.currentTarget.dataset.key,{Minute__c:Number(e.target.value)});}
    async handleSaveSchedules(){this.busy=true;try{const rows=this.schedules.map(r=>({Id:r.Id,Name:r.Name||'Field Usage Schedule',Enabled__c:!!r.Enabled__c,Hour__c:Number(r.Hour__c),Minute__c:Number(r.Minute__c)}));await saveSchedules({rows});this.message='Automatic scan schedules saved.';await this.refresh(false);}catch(e){this.message=this.errorText(e,'Unable to save schedules.');}finally{this.busy=false;}}
    async handleDeleteSchedule(e){const key=e.currentTarget.dataset.key,row=this.schedules.find(r=>r._key===key);this.busy=true;try{if(row?.Id)await deleteSchedule({scheduleId:row.Id});this.schedules=this.schedules.filter(r=>r._key!==key);this.message='Schedule deleted.';await this.refresh(false);}catch(err){this.message=this.errorText(err,'Unable to delete schedule.');}finally{this.busy=false;}}
    async handlePause(e){await this.jobAction(pauseSchedule,e.currentTarget.dataset.id,'Schedule paused.');}
    async handleResume(e){await this.jobAction(resumeSchedule,e.currentTarget.dataset.id,'Schedule resumed.');}
    async handleDeleteJob(e){await this.jobAction(deleteSchedule,e.currentTarget.dataset.id,'Schedule deleted.');}
    async jobAction(fn,id,success){this.busy=true;try{await fn({scheduleId:id});this.message=success;await this.refresh(false);}catch(e){this.message=this.errorText(e,'Unable to update scheduled job.');}finally{this.busy=false;}}
    errorText(e,fallback){return e?.body?.message||e?.message||fallback;}
    get run(){return this.status?.run||null;}
    get scanRunning(){return ['Queued','Running','Holding','Preparing','Processing'].includes(this.run?.Status__c)||['Holding','Queued','Preparing','Processing'].includes(this.status?.jobStatus);}
    get snapshotState(){return this.run?.Is_Current__c&&this.run?.Status__c==='Completed'?'Current':(this.run?.Status__c||'Not scanned');}
    get healthState(){return this.scanRunning?'Processing':((this.run?.Error_Count__c||0)>0?'Attention':(this.run?.Is_Current__c?'Healthy':'Not scanned'));}
    get dependencyCount(){return this.run?.Dependency_Count__c||0;}
    get objectsProcessed(){return Number(this.run?.Objects_Processed__c||0);}
    get objectsTotal(){return Number(this.run?.Objects_Total__c||0);}
    get progressLog(){return this.run?.Progress_Log__c||'';}
    get hasProgressLog(){return !!this.progressLog;}
    get errorCount(){return this.run?.Error_Count__c||0;}
    get jobTotal(){return Number(this.status?.jobTotal||0);}
    get jobProcessed(){return Number(this.status?.jobProcessed||0);}
    get jobErrors(){return Number(this.status?.jobErrors||0);}
    get jobStatus(){return this.status?.jobStatus||'';}
    get progress(){
        if(this.scanRunning && this.jobTotal>0)return Math.max(0,Math.min(100,Math.round((this.jobProcessed/this.jobTotal)*100)));
        const persisted=Number(this.run?.Progress_Percent__c||0);
        return Math.max(0,Math.min(100,persisted));
    }
    get progressStyle(){return `width:${this.progress}%;`;}
    get phase(){if(this.scanRunning&&this.jobStatus){if(this.jobTotal>0)return `${this.jobStatus} · Batch ${this.jobProcessed} / ${this.jobTotal}`;return `Batch ${this.jobStatus}`;}return this.run?.Progress_Phase__c||'Idle';}
    get lastCompleted(){return this.formatDate(this.run?.Completed_At__c);}
    get hasJobs(){return this.jobs.length>0;}
    get hasSchedules(){return this.schedules.length>0;}
    get hasHistory(){return this.history.length>0;}
    get jobsView(){return this.jobs.map(j=>({...j,key:j.scheduleId||j.cronTriggerId||j.jobName,next:this.formatDate(j.nextFireTime),previous:this.formatDate(j.previousFireTime),state:j.state||(j.enabled?'Scheduled':'Paused'),time:`${String(Math.trunc(Number(j.hour||0))).padStart(2,'0')}:${String(Math.trunc(Number(j.minute||0))).padStart(2,'0')}`,canPause:!!j.enabled,canResume:!j.enabled}));}
    get historyView(){return this.history.slice(0,10).map((r,index)=>({...r,key:r.Id,status:r.Status__c||'Unknown',started:this.formatDate(r.Started_At__c),completed:this.formatDate(r.Completed_At__c),dependencies:r.Dependency_Count__c||0,errors:r.Error_Count__c||0,phase:r.Progress_Phase__c||'—',number:index+1}));}
    get coverageRows(){return this.sourceTypes.map((name,i)=>({key:`coverage-${i}`,name,status:'Operational'}));}
    formatDate(v){if(!v)return '—';try{return new Date(v).toLocaleString();}catch(_){return String(v);}}
}