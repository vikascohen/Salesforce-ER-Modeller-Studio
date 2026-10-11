/**
 * @author Vikas Cohen
 */
import { LightningElement } from 'lwc';
import getSettings from '@salesforce/apex/ErMcpSettingsController.getSettings';
import saveSettings from '@salesforce/apex/ErMcpSettingsController.saveSettings';
export default class ErMcpSettings extends LightningElement {
    settings; busy=false; message='';
    connectedCallback(){this.refresh();}
    reportError(error,operation){const message=error?.body?.message||error?.message||operation;this.dispatchEvent(new CustomEvent('studioerror',{detail:{source:'MCP Settings / '+operation,message,severity:'ERROR'},bubbles:true,composed:true}));return message;}
    async refresh(){
        this.busy=true;
        try {
            this.settings=await getSettings();
            this.message='';
        } catch(e){this.message=this.reportError(e,'Load MCP settings');}
        finally{this.busy=false;}
    }
    get ready(){return !!this.settings;}
    handleToggle(e){this.settings={...this.settings,[e.target.name]:e.target.checked};}
    handleNumber(e){this.settings={...this.settings,[e.target.name]:Number(e.target.value)};}
    async save(){
        this.busy=true;
        try {
            await saveSettings({statusEnabled:this.settings.Status_Enabled__c,usageEnabled:this.settings.Usage_Enabled__c,changedEnabled:this.settings.Changed_Enabled__c,scanEnabled:this.settings.Scan_Enabled__c,cooldownHours:Number(this.settings.Cooldown_Hours__c||0)});
            this.message='MCP settings saved.';
        } catch(e){this.message=this.reportError(e,'Save MCP settings');}
        finally{this.busy=false;}
    }
}
