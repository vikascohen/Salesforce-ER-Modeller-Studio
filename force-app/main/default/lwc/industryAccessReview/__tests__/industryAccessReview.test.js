import {createElement} from 'lwc';
import Review from 'c/industryAccessReview';
import getReview from '@salesforce/apex/StudioDiagnosticsController.getIndustryReview';
import getObjectReview from '@salesforce/apex/StudioDiagnosticsController.getIndustryObjectReview';
import applyReadAccess from '@salesforce/apex/StudioDiagnosticsController.applyIndustryReadAccess';
import runDiagnostics from '@salesforce/apex/StudioDiagnosticsController.runDiagnostics';
jest.mock('@salesforce/apex/StudioDiagnosticsController.getIndustryReview',()=>({default:jest.fn()}),{virtual:true});
jest.mock('@salesforce/apex/StudioDiagnosticsController.getIndustryObjectReview',()=>({default:jest.fn()}),{virtual:true});
jest.mock('@salesforce/apex/StudioDiagnosticsController.applyIndustryReadAccess',()=>({default:jest.fn()}),{virtual:true});
jest.mock('@salesforce/apex/StudioDiagnosticsController.runDiagnostics',()=>({default:jest.fn()}),{virtual:true});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const button=(el,text)=>[...el.shadowRoot.querySelectorAll('button')].find(b=>b.textContent===text);
afterEach(()=>{document.body.innerHTML='';jest.clearAllMocks();});
it('applies all eligible fields in batches for only the selected object',async()=>{
 const names=Array.from({length:101},(_,i)=>'Field'+i);
 getReview.mockResolvedValue({detected:true,canUpdate:true,objects:['Benefit','Visit']});
 getObjectReview.mockResolvedValue({needsObjectRead:true,fields:[...names.map(name=>({name,eligible:true})),{name:'Unavailable',eligible:false}]});
 let release;applyReadAccess.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockResolvedValue({objectSuccess:true,results:[]});
 runDiagnostics.mockResolvedValue({checks:[{key:'scanAccess',detail:'Rechecked'}]});
 const el=createElement('c-industry-access-review',{is:Review});document.body.appendChild(el);
 button(el,'Review Access').click();await flush();const object=el.shadowRoot.querySelector('[data-name="Benefit"]');object.checked=true;object.dispatchEvent(new Event('change'));await flush();
 button(el,'Apply Fix').click();await flush();
 expect(el.shadowRoot.querySelector('.review-progress').textContent).toContain('Updating Benefit');
 expect(applyReadAccess.mock.calls[0][0]).toEqual({objectName:'Benefit',fieldNames:names.slice(0,100),includeObjectRead:true});
 release({objectSuccess:true,results:[]});await flush();
 expect(applyReadAccess.mock.calls[1][0]).toEqual({objectName:'Benefit',fieldNames:names.slice(100),includeObjectRead:true});
 expect(applyReadAccess).toHaveBeenCalledTimes(2);
 expect(el.shadowRoot.querySelectorAll('input[type=checkbox]')).toHaveLength(2);
 expect(runDiagnostics).toHaveBeenCalledTimes(1);expect(el.shadowRoot.textContent).toContain('Rechecked');expect(el.shadowRoot.textContent).toContain('Unavailable');
});
it('does not allow a non-administrator to apply updates',async()=>{
 getReview.mockResolvedValue({detected:true,canUpdate:false,objects:['Account']});
 getObjectReview.mockResolvedValue({objectName:'Account',needsObjectRead:true,fields:[]});
 const el=createElement('c-industry-access-review',{is:Review});document.body.appendChild(el);
 button(el,'Review Access').click();await flush();button(el,'Select all detected objects').click();await flush();button(el,'Review selected objects').click();await flush();
 expect(button(el,'Apply Fix').disabled).toBe(true);expect(applyReadAccess).not.toHaveBeenCalled();
});

it('shows the active object while a request is pending and advances only after a response',async()=>{
 getReview.mockResolvedValue({detected:true,canUpdate:true,objects:['Benefit','Program','Visit']});
 let releaseFirst,releaseSecond;
 getObjectReview.mockImplementationOnce(()=>new Promise(resolve=>{releaseFirst=resolve;}))
   .mockImplementationOnce(()=>new Promise(resolve=>{releaseSecond=resolve;}));
 const el=createElement('c-industry-access-review',{is:Review});document.body.appendChild(el);
 button(el,'Review Access').click();await flush();button(el,'Select all detected objects').click();await flush();
 button(el,'Review selected objects').click();await flush();
 const panel=()=>el.shadowRoot.querySelector('.review-progress');
 expect(panel().textContent).toContain('for Benefit');expect(panel().textContent).toContain('0 of 3 objects finished');
 releaseFirst({objectName:'Benefit',fields:[]});await flush();
 expect(panel().textContent).toContain('for Program');expect(panel().textContent).toContain('1 of 3 objects finished');
 button(el,'Stop after current object').click();await flush();expect(button(el,'Stop after current object').disabled).toBe(true);
 releaseSecond({objectName:'Program',fields:[]});await flush();expect(getObjectReview).toHaveBeenCalledTimes(2);
 expect(el.shadowRoot.querySelector('.review-outcome').textContent).toContain('Stopped. 2 of 3 objects checked.');
 expect(applyReadAccess).not.toHaveBeenCalled();
});
