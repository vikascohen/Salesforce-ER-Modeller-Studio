/** File/module composition. Definitions are inert until an exported module is used. */
export function dslFileKey(name) {
    const raw=String(name||'').trim();
    if(!raw||/[\\/"'\r\n]/.test(raw)||raw.includes('..'))throw new Error('Use a saved filename such as customer.dsl, without a path.');
    return (raw.toLowerCase().endsWith('.dsl')?raw:raw+'.dsl').toLowerCase();
}
export function importStatements(text) {
    return String(text||'').split('\n').map((line,index)=>{const m=line.trim().match(/^import\s+(?:(\w+)\s+from\s+)?(.+\.dsl)\s*$/i);return m?{module:m[1]||null,file:m[2].trim(),line:index+1}:null;}).filter(Boolean);
}
function document(text,name,id) {
    const modules=new Map(),top=[],imports=[];let current=null,pending=null;
    const fail=(line,message)=>{throw new Error(`${name}:${line}: ${message}`);};
    // Braces in field marker brackets are display text, not block delimiters.
    String(text||'').split('\n').forEach((raw,index)=>{
        if(raw.trim().startsWith('#'))return;
        let bracket=0,part='',quoted=false,escaped=false;const tokens=[];
        for(const ch of raw){
            if(ch==='"'&&!escaped)quoted=!quoted;
            if(!quoted){if(ch==='[')bracket++;if(ch===']')bracket=Math.max(0,bracket-1);}
            if(!quoted&&!bracket&&(ch==='{'||ch==='}')){if(part.trim())tokens.push(part.trim());tokens.push(ch);part='';}else part+=ch;
            escaped=ch==='\\'&&!escaped;
        }
        if(part.trim())tokens.push(part.trim());
        for(const line of tokens){
            const at={text:line,file:name,line:index+1};
            if(line==='{'){if(!pending||current)fail(index+1,'Unexpected module opening brace.');current=pending;pending=null;continue;}
            if(line==='}'){if(!current)fail(index+1,'Unexpected closing brace.');current=null;continue;}
            const mod=line.match(/^(export\s+)?module\s+(\w+)(?:\s+extends\s+(\w+))?$/i);
            if(mod){if(current||pending)fail(index+1,'Modules cannot be nested.');const key=mod[2].toLowerCase();if(modules.has(key))fail(index+1,`Duplicate module ${mod[2]}.`);pending={name:mod[2],exported:!!mod[1],base:mod[3],body:[],file:name,id,line:index+1};modules.set(key,pending);continue;}
            if(pending)fail(index+1,'Expected { after the module declaration.');
            if(/^import\b/i.test(line)){if(current)fail(index+1,'Imports belong at file level.');const m=line.match(/^import\s+(?:(\w+)\s+from\s+)?(.+\.dsl)$/i);if(!m)fail(index+1,'Expected import customer.dsl or import Customer from customer.dsl.');imports.push({...at,module:m[1]||null,name:m[2],key:dslFileKey(m[2])});continue;}
            (current?current.body:top).push(at);
        }
    });
    if(current||pending)fail((current||pending).line,'Unclosed module block.');
    return {name,id,modules,top,imports};
}
export function compileModuleSource(text,options={}) {
    const documents=new Map(),loading=new Set();let bytes=0;
    function load(source,name,id,depth=0){
        if(depth>16)throw new Error(`${name}: Import nesting exceeds 16 files.`);
        if(loading.has(id))throw new Error(`${name}: Circular import detected.`);
        if(documents.has(id))return documents.get(id);
        if(documents.size>=32)throw new Error('Import graph exceeds 32 files.');
        bytes+=source.length;if(bytes>1048576)throw new Error('Imported DSL exceeds 1 MB.');
        loading.add(id);const doc=document(source,name,id);documents.set(id,doc);doc.symbols=new Map(doc.modules);
        for(const imp of doc.imports){
            const entry=options.resolveImport?.(id,imp.key);
            if(!entry)throw new Error(`${name}:${imp.line}: Import ${imp.name} is missing or inaccessible.`);
            const child=load(entry.sourceCode||'',entry.name||imp.name,entry.id||imp.key,depth+1);
            const candidates=imp.module?[child.modules.get(imp.module.toLowerCase())]:[...child.modules.values()].filter(m=>m.exported);
            for(const module of candidates){
                if(!module?.exported)throw new Error(`${name}:${imp.line}: ${imp.module} is not exported by ${imp.name}.`);
                const key=module.name.toLowerCase(),old=doc.symbols.get(key);
                if(old&&old!==module)throw new Error(`${name}:${imp.line}: Ambiguous module ${module.name}. Import one module explicitly.`);
                doc.symbols.set(key,module);
            }
        }
        loading.delete(id);return doc;
    }
    const root=load(String(text||''),options.fileName||'current.dsl',options.rootId||'@root');
    const expanded=[],used=new Set(),stack=new Set();
    function activate(name,doc,at){
        const module=doc.symbols.get(name.toLowerCase());
        if(!module?.exported)throw new Error(`${at.file}:${at.line}: Unknown exported module ${name}. Available: ${[...doc.symbols.values()].filter(m=>m.exported).map(m=>m.name).join(', ')||'(none)'}.`);
        const key=module.id+'|'+module.name.toLowerCase();if(stack.has(key))throw new Error(`${at.file}:${at.line}: Circular module use/inheritance involving ${name}.`);if(used.has(key))return;
        stack.add(key);const owner=documents.get(module.id);if(module.base)activate(module.base,owner,module);
        emit(module.body,owner);stack.delete(key);used.add(key);
    }
    function emit(lines,doc){for(const line of lines){const use=line.text.match(/^use\s+(\w+)\s*$/i);if(use)activate(use[1],doc,line);else expanded.push(line);}}
    emit(root.top,root);
    return {source:expanded.map(line=>line.text).join('\n'),origins:expanded,modular:[...documents.values()].some(doc=>doc.modules.size||doc.imports.length),exports:[...root.symbols.values()].filter(m=>m.exported).map(m=>m.name)};
}
export function exportedModuleNames(text,imported=[]) {
    return [...new Set([...String(text||'').matchAll(/^\s*export\s+module\s+(\w+)/gim)].map(m=>m[1]).concat(imported))];
}

export const DSL_COMPONENT_TYPES = ['ApexClass','Flow','PermissionSet','PermissionSetLicense','UserLicense','PackageLicense'];
/** Tolerant completion index: incomplete/invalid lines never break editing. */
export function componentDeclarations(text) {
    const result=[];
    let lines=String(text||'').split('\n');
    try{const doc=document(String(text||''),'completion.dsl','@completion');lines=[...doc.top,...[...doc.modules.values()].flatMap(module=>module.body)].map(line=>line.text);}catch(_){/* An unfinished module still offers complete declarations on earlier lines. */}
    for(const line of lines){
        const match=line.trim().match(/^component\s+(\w+)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+label\s+("(?:[^"\\]|\\.)*"))?\s*$/i);
        if(!match)continue;
        const type=DSL_COMPONENT_TYPES.find(value=>value.toLowerCase()===match[1].toLowerCase());if(!type)continue;
        let label=match[2];try{if(match[3])label=JSON.parse(match[3]);}catch(_){continue;}
        if(!label.trim())label=match[2];
        result.push({type,name:match[2],label});
    }
    return result;
}
