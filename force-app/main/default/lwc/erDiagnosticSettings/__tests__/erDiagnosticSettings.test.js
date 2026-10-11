/**
 * @author Vikas Cohen
 */
import { createElement } from 'lwc';
import ErDiagnosticSettings from 'c/erDiagnosticSettings';
import load from '@salesforce/apex/ErDiagnosticConfigController.load';
import save from '@salesforce/apex/ErDiagnosticConfigController.save';
import validateObject from '@salesforce/apex/ErDiagnosticConfigController.validateObject';
jest.mock('@salesforce/apex/ErDiagnosticConfigController.load',()=>({default:jest.fn()}),{virtual:true});
jest.mock('@salesforce/apex/ErDiagnosticConfigController.save',()=>({default:jest.fn()}),{virtual:true});
jest.mock('@salesforce/apex/ErDiagnosticConfigController.validateObject',()=>({default:jest.fn()}),{virtual:true});
jest.mock('@salesforce/apex/ErDiagnosticConfigController.validateField',()=>({default:jest.fn()}),{virtual:true});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
describe('ER diagnostic settings',()=>{
 beforeEach(()=>{load.mockResolvedValue('{"enabled":false,"requiredFields":[]}');save.mockResolvedValue(undefined);validateObject.mockResolvedValue({valid:false,message:'Object does not exist.'});});
 afterEach(()=>{document.body.innerHTML='';jest.clearAllMocks();});
 it('hides object configuration when disabled and saves opt-out',async()=>{
  const element=createElement('c-er-diagnostic-settings',{is:ErDiagnosticSettings});document.body.appendChild(element);await flush();
  expect(element.shadowRoot.querySelector('input[data-name="objectApi"]')).toBeNull();
  element.shadowRoot.querySelector('.actions button').click();await flush();
  expect(save).toHaveBeenCalledWith({jsonConfig:expect.stringContaining('"enabled":false')});
 });
 it('reveals fields only when opted in',async()=>{
  const element=createElement('c-er-diagnostic-settings',{is:ErDiagnosticSettings});document.body.appendChild(element);await flush();
  const checkbox=element.shadowRoot.querySelector('input[type="checkbox"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));await flush();
  expect(element.shadowRoot.querySelector('input[data-name="objectApi"]')).not.toBeNull();
  const field=element.shadowRoot.querySelector('input[data-name="objectApi"]');
  field.value='Missing__c';field.dispatchEvent(new Event('change'));field.dispatchEvent(new Event('blur'));await flush();
  expect(validateObject).toHaveBeenCalledWith({objectApi:'Missing__c'});
  expect(element.shadowRoot.textContent).toContain('Object does not exist.');
 });
});
