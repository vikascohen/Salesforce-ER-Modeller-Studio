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
    status; jobs=[]; sourceTypes=[]; schedules=[]; history=[]; busy=false; message=''; scheduleSeq=0; poller;
    connectedCallback(){ this.refresh(); this.poller=setInterval(()=>{ if(this.scanRunning) this.refresh(false); },5000); }
    disconnectedCallback(){ if(this.poller) clearInterval(this.poller); }
    async refresh(showBusy=true){
        if(showBusy)this.busy=true;
        try{
            const [status,jobs,sourceTypes,history]=await Promise.all([getStatus({runId:null}),getScheduledJobs(),getSourceTypes(),getRecentRuns({rowLimit:20})]);
            this.status=status;this.jobs=jobs||[];this.sourceTypes=sourceTypes||[];this.history=history||[];
            this.schedules=(status?.schedules||[]).map(r=>({...r,_key:r.Id||`new-${++this.scheduleSeq}`}));
            if(showBusy)this.message='';
        }catch(e){this.message=this.errorText(e,'Unable to load Field Usage operations.');}
        finally{if(showBusy)this.busy=false;}
    }
    async handleRunNow(){if(this.scanRunning)return;this.busy=true;try{await runNow();this.message='Field Usage scan queued.';await this.refresh(false);}catch(e){this.message=this.errorText(e,'Unable to start Field Usage scan.');}finally{this.busy=false;}}
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
    get dependencyCount(){return this.run?.Dependency_Count__c||0;} get errorCount(){return this.run?.Error_Count__c||0;}
    get progress(){return Math.max(0,Math.min(100,Number(this.run?.Progress_Percent__c||0)));} get progressStyle(){return `width:${this.progress}%`;} get phase(){return this.run?.Progress_Phase__c||'Idle';}
    get lastCompleted(){return this.formatDate(this.run?.Completed_At__c);} get hasJobs(){return this.jobs.length>0;} get hasSchedules(){return this.schedules.length>0;} get hasHistory(){return this.history.length>0;}
    get jobsView(){return this.jobs.map(j=>({...j,key:j.scheduleId||j.cronTriggerId||j.jobName,next:this.formatDate(j.nextFireTime),previous:this.formatDate(j.previousFireTime),state:j.state||(j.enabled?'Scheduled':'Paused'),time:`${String(Math.trunc(Number(j.hour||0))).padStart(2,'0')}:${String(Math.trunc(Number(j.minute||0))).padStart(2,'0')}`,canPause:!!j.enabled,canResume:!j.enabled}));}
    get historyView(){return this.history.map(r=>({...r,key:r.Id,status:r.Status__c||'Unknown',started:this.formatDate(r.Started_At__c),completed:this.formatDate(r.Completed_At__c),dependencies:r.Dependency_Count__c||0,errors:r.Error_Count__c||0,phase:r.Progress_Phase__c||'—'}));}
    get coverageRows(){return this.sourceTypes.map((name,i)=>({key:`coverage-${i}`,name,status:'Supported'}));}
    formatDate(v){if(!v)return '—';try{return new Date(v).toLocaleString();}catch(_){return String(v);}}
}
