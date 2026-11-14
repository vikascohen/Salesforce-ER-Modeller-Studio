import { createElement } from 'lwc';
import Reference from 'c/diagramLanguageReference';
import Help from 'c/studioHelp';
import { parseEr } from 'c/erDiagramLogic';
afterEach(()=>{document.body.innerHTML='';});
it('compiles the displayed examples and describes the illustrated lookup',()=>{
    const el=createElement('c-diagram-language-reference',{is:Reference});document.body.appendChild(el);
    const [model,library,consumer]=[...el.shadowRoot.querySelectorAll('pre')].map(node=>node.textContent);
    expect(el.shadowRoot.querySelectorAll('figure')).toHaveLength(4);
    expect([...el.shadowRoot.querySelectorAll('figure')].every(f=>f.querySelector('figcaption')?.textContent.trim())).toBe(true);
    expect(parseEr(model).relationships).toHaveLength(1);
    expect(el.shadowRoot.querySelector('figcaption').textContent).toContain('Contact.AccountId points to Account');
    expect(parseEr(library).entities).toHaveLength(0);
    const result=parseEr(consumer,{fileName:'sales.dsl',resolveImport:()=>({id:'customer',name:'customer.dsl',sourceCode:library})});
    expect(result.entities.map(x=>x.name)).toEqual(['Account','Opportunity']);
    expect(result.relationships).toHaveLength(1);
});
it('opens directly and supports switching back from configuration',async()=>{
    const el=createElement('c-studio-help',{is:Help});el.initialSection='language';document.body.appendChild(el);
    const reference=()=>el.shadowRoot.querySelector('c-diagram-language-reference');
    const click=async(label)=>{[...el.shadowRoot.querySelectorAll('button')].find(b=>b.textContent===label).click();await Promise.resolve();};
    expect(reference()).toBeTruthy();await click('Configuration');expect(reference()).toBeNull();
    await click('Diagram Language Reference');expect(reference()).toBeTruthy();
});
