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
it('requires explicit selection, excludes unavailable fields and rechecks after saving',async()=>{
 getReview.mockResolvedValue({detected:true,canUpdate:true,objects:['BenefitDisbursement']});
 getObjectReview.mockResolvedValue({objectName:'BenefitDisbursement',needsObjectRead:true,fields:[{name:'ProgramEnrollmentId',label:'Program Enrollment',eligible:true},{name:'StartDate',label:'Start Date',eligible:false,message:'Metadata unavailable'}]});
 applyReadAccess.mockResolvedValue({objectSuccess:true,results:[{name:'ProgramEnrollmentId',eligible:true,message:'Read Access added.'}]});
 runDiagnostics.mockResolvedValue({checks:[{key:'scanAccess',detail:'Rechecked'}]});
 const el=createElement('c-industry-access-review',{is:Review});document.body.appendChild(el);
 button(el,'Review Access').click();await flush();
 expect(applyReadAccess).not.toHaveBeenCalled();
 button(el,'Select all detected objects').click();await flush();button(el,'Review selected objects').click();await flush();
 expect(button(el,'Apply Fix').disabled).toBe(true);
 button(el,'Select all eligible').click();await flush();button(el,'Apply Fix').click();await flush();await flush();
 expect(applyReadAccess).toHaveBeenCalledWith({objectName:'BenefitDisbursement',fieldNames:['ProgramEnrollmentId'],includeObjectRead:true});
 expect(runDiagnostics).toHaveBeenCalledTimes(1);expect(el.shadowRoot.textContent).toContain('Rechecked');
});
it('does not allow a non-administrator to apply updates',async()=>{
 getReview.mockResolvedValue({detected:true,canUpdate:false,objects:['Account']});
 getObjectReview.mockResolvedValue({objectName:'Account',needsObjectRead:true,fields:[]});
 const el=createElement('c-industry-access-review',{is:Review});document.body.appendChild(el);
 button(el,'Review Access').click();await flush();button(el,'Select all detected objects').click();await flush();button(el,'Review selected objects').click();await flush();button(el,'Select all eligible').click();await flush();
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
 expect(panel().textContent).toContain('for Benefit');expect(panel().textContent).toContain('0 of 3 finished');
 releaseFirst({objectName:'Benefit',fields:[]});await flush();
 expect(panel().textContent).toContain('for Program');expect(panel().textContent).toContain('1 of 3 finished');
 button(el,'Stop after current object').click();await flush();expect(panel().textContent).toContain('Stopping after Program');
 releaseSecond({objectName:'Program',fields:[]});await flush();expect(getObjectReview).toHaveBeenCalledTimes(2);
 expect(el.shadowRoot.querySelector('.review-outcome').textContent).toContain('Review stopped. 2 of 3 objects reviewed.');
 expect(applyReadAccess).not.toHaveBeenCalled();
});
