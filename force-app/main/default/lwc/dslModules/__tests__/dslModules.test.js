import {parseEr} from 'c/erDiagramLogic';
import {compileModuleSource,dslFileKey,DSL_COMPONENT_TYPES,componentDeclarations} from 'c/dslModules';
const customer='export module Customer {\n entity Account : Name\n entity Contact : Name, Email\n Contact.AccountId -> Account\n}';
const files={'customer.dsl':{id:'customer',name:'customer.dsl',sourceCode:customer}};
const options={fileName:'main.dsl',resolveImport:(owner,name)=>files[name]};
it('exported definitions do not render until explicitly used',()=>{
    expect(parseEr(customer)).toEqual({entities:[],relationships:[]});
    const active=parseEr(customer+'\nUse Customer\nentity account : Industry');
    expect(active.entities.map(e=>e.name)).toEqual(['Account','Contact']);
    expect(active.entities[0].fields.map(f=>f.name)).toEqual(['Name','Industry']);
    expect(active.relationships).toHaveLength(1);
});
it('imports export symbols but does not render imported top-level statements',()=>{
    const resolveImport=()=>({id:'library',name:'library.dsl',sourceCode:'entity PrivateTop : Name\n'+customer});
    expect(parseEr('import library.dsl\nentity Local : Name',{resolveImport}).entities.map(e=>e.name)).toEqual(['Local']);
    expect(parseEr('import library.dsl\nuse Customer',{resolveImport}).entities.map(e=>e.name)).toEqual(['Account','Contact']);
});
it('supports named imports and use from another saved file',()=>{
    expect(parseEr('import Customer from customer.dsl\nuse Customer',options).relationships).toHaveLength(1);
    expect(parseEr('import customer.dsl',options).entities).toHaveLength(0);
});
it('supports additive inheritance without drawing an unused extension',()=>{
    const source='import customer.dsl\nexport module Enterprise extends Customer {\n entity Account : Industry\n entity Opportunity : Amount\n Opportunity.AccountId -> Account\n}';
    expect(parseEr(source,options).entities).toHaveLength(0);
    const active=parseEr(source+'\nuse Enterprise\nuse Customer',options);
    expect(active.entities).toHaveLength(3);expect(active.relationships).toHaveLength(2);
    expect(active.entities.find(e=>e.name==='Account').fields.map(f=>f.name)).toEqual(['Name','Industry']);
});
it('use accepts exported modules only and gives an actionable typo error',()=>{
    expect(()=>parseEr('module Private {\nentity Hidden\n}\nuse Private')).toThrow('Unknown exported module Private');
    expect(()=>parseEr(customer+'\nuse Custmer')).toThrow('Customer');
    expect(()=>parseEr('import Missing from customer.dsl',options)).toThrow('not exported');
});
it('rejects missing imports, paths and circular files even when their modules are unused',()=>{
    expect(()=>parseEr('import missing.dsl',options)).toThrow('missing or inaccessible');
    expect(()=>parseEr('import ./customer.dsl',options)).toThrow('without a path');
    const cycle={'a.dsl':{id:'a',name:'a.dsl',sourceCode:'import b.dsl'},'b.dsl':{id:'b',name:'b.dsl',sourceCode:'import a.dsl'}};
    expect(()=>parseEr('import a.dsl',{resolveImport:(owner,name)=>cycle[name]})).toThrow('Circular import');
});
it('reports inheritance/use cycles and conflicting types without silently overriding',()=>{
    expect(()=>parseEr('export module A extends B {}\nexport module B extends A {}\nuse A')).toThrow('Circular module');
    expect(()=>parseEr('export module A {\nentity Account : Name[Text]\n}\nuse A\nentity Account : Name[Number]')).toThrow('Conflicting data type');
    expect(()=>parseEr('export module A {\nContact.AccountId -> Account\n}\nuse A\nContact.AccountId => Account')).toThrow('Conflicting relationship');
});
it('keeps error origins in imported modules and preserves legacy source line numbers',()=>{
    expect(()=>parseEr('import bad.dsl\nuse Bad',{resolveImport:()=>({id:'bad',name:'bad.dsl',sourceCode:'export module Bad {\ninvalid\n}'})})).toThrow('bad.dsl:2');
    expect(()=>parseEr('# comment\n\ninvalid')).toThrow('Line 3');
});
it('supports component cards in modules only when used',()=>{
    const source='export module Automation {\ncomponent ApexClass Logger\ncomponent Flow Save_Log\n}';
    expect(parseEr(source).components).toBeUndefined();expect(parseEr(source+'\nuse Automation').components).toHaveLength(2);
});
it('canonical filenames ignore case and optional extension',()=>{
    expect(dslFileKey(' Test ')).toBe('test.dsl');expect(dslFileKey('TEST.DSL')).toBe('test.dsl');
    expect(()=>dslFileKey('../test.dsl')).toThrow();
});
it('detects ambiguous module names and structural errors',()=>{
    expect(()=>parseEr('export module A {}\nexport module a {}')).toThrow('Duplicate module');
    expect(()=>parseEr('export module A {')).toThrow('Unclosed');
    expect(()=>parseEr('}')).toThrow('Unexpected');
    const map={'a.dsl':{id:'a',sourceCode:'export module Same {}'},'b.dsl':{id:'b',sourceCode:'export module Same {}'}};
    expect(()=>compileModuleSource('import a.dsl\nimport b.dsl',{resolveImport:(owner,name)=>map[name]})).toThrow('Ambiguous');
});


it.each(DSL_COMPONENT_TYPES)('indexes and compiles every supported component type: %s',(type)=>{
 const text=`export module Cards { component ${type.toLowerCase()} Card label "Readable {Core} [Name]" }\nuse Cards`;
 expect(componentDeclarations(text)).toEqual([{type,name:'Card',label:'Readable {Core} [Name]'}]);
 expect(parseEr(text).components[0]).toMatchObject({componentType:type,title:'Readable {Core} [Name]'});
});
it('completion indexing tolerates incomplete modules, invalid JSON labels and unknown types',()=>{
 expect(componentDeclarations('export module X {\ncomponent PermissionSet Existing label "Admin"\ncomponent PermissionSet Draft label "unfinished')).toEqual([{type:'PermissionSet',name:'Existing',label:'Admin'}]);
 expect(componentDeclarations('component Unknown X\ncomponent UserLicense Bad label "bad\\q"')).toEqual([]);
});
it('reports malformed/conflicting labels and keeps empty completion snippets valid',()=>{
 expect(()=>parseEr('component PermissionSet A label "bad\\q"')).toThrow('Line 1: Card label must be a valid JSON string');
 expect(parseEr('component PermissionSet A label " "').components[0].title).toBe('A');
 expect(()=>parseEr('export module Base { component PermissionSet A label "One" }\nexport module Child extends Base { component PermissionSet A label "Two" }\nuse Child')).toThrow('Conflicting labels');
});
