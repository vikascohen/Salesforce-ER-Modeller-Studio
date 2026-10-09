import { LightningElement } from 'lwc';
import getSettings from '@salesforce/apex/ErMcpSettingsController.getSettings';
import saveSettings from '@salesforce/apex/ErMcpSettingsController.saveSettings';
import getLogs from '@salesforce/apex/ErMcpSettingsController.getLogs';
export default class ErMcpSettings extends LightningElement {
    settings; logs=[]; today=0; week=0; busy=false; message=''; method=''; outcome='';
    connectedCallback(){this.refresh();}
    async refresh(){
        this.busy=true;
        try {
            const [settings,summary]=await Promise.all([getSettings(),getLogs({method:this.method||null,outcome:this.outcome||null,limitRows:200})]);
            this.settings=settings;
            this.logs=(summary.rows||[]).map(r=>({...r,created:new Date(r.CreatedDate).toLocaleString(),user:r.CreatedBy?.Name||'—'}));
            this.today=summary.today;this.week=summary.lastSevenDays;
            this.message='';
        } catch(e){this.message=e?.body?.message||e?.message||'Unable to load MCP settings.';}
        finally{this.busy=false;}
    }
    get ready(){return !!this.settings;}
    get hasLogs(){return this.logs.length>0;}
    get setupSteps(){return 'In Salesforce Setup → Integration → Salesforce MCP Servers, create a custom server. Add ER Modeller Apex Actions, activate, and copy the generated URL. Register each MCP caller with an External Client App and the mcp_api OAuth scope. Do not add standard record tools.';}
    handleToggle(e){this.settings={...this.settings,[e.target.name]:e.target.checked};}
    handleNumber(e){this.settings={...this.settings,[e.target.name]:Number(e.target.value)};}
    handleMethod(e){this.method=e.target.value;}
    handleOutcome(e){this.outcome=e.target.value;}
    async save(){
        this.busy=true;
        try {
            await saveSettings({statusEnabled:this.settings.Status_Enabled__c,usageEnabled:this.settings.Usage_Enabled__c,changedEnabled:this.settings.Changed_Enabled__c,scanEnabled:this.settings.Scan_Enabled__c,cooldownHours:Number(this.settings.Cooldown_Hours__c||0),retentionDays:Number(this.settings.Log_Retention_Days__c||30)});
            this.message='MCP settings saved.';
        } catch(e){this.message=e?.body?.message||e?.message||'Unable to save.';}
        finally{this.busy=false;}
    }
    csv(){
        const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
        const lines=[['Time','User','Method','Requested field','Result','Duration ms','Detail'].map(q).join(',')];
        this.logs.forEach(r=>lines.push([r.created,r.user,r.Tool__c,r.Requested_Key__c,r.Outcome__c,r.Duration_Ms__c,r.Detail__c].map(q).join(',')));
        const a=document.createElement('a');const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob);a.href=url;a.download='er-mcp-logs.csv';a.click();URL.revokeObjectURL(url);
    }
}