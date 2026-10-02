import { LightningElement, api } from 'lwc';
export default class StudioHelp extends LightningElement {
    @api initialSection='configuration'; section='configuration'; searchText='';
    connectedCallback(){this.section=this.initialSection==='manual'?'manual':'configuration';}
    get configurationOpen(){return this.section==='configuration';} get manualOpen(){return this.section==='manual';}
    get configurationClass(){return this.configurationOpen?'help-nav-item help-nav-item-active':'help-nav-item';}
    get manualClass(){return this.manualOpen?'help-nav-item help-nav-item-active':'help-nav-item';}
    showConfiguration(){this.section='configuration';this.clearSearch();} showManual(){this.section='manual';}
    handleSearch(event){this.searchText=event.target.value||'';this.applySearch();}
    clearSearch(){this.searchText='';const input=this.template.querySelector('.help-manual-search');if(input)input.value='';this.template.querySelectorAll('.help-manual-section').forEach(x=>{x.hidden=false;});}
    applySearch(){const q=(this.searchText||'').trim().toLowerCase();this.template.querySelectorAll('.help-manual-section').forEach(x=>{const hay=((x.dataset.search||'')+' '+(x.textContent||'')).toLowerCase();x.hidden=!!q&&!hay.includes(q);});}
    close(){this.dispatchEvent(new CustomEvent('close'));}
}
