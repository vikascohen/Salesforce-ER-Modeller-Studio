/**
 * Phase 2 — Data Architecture Intelligence.
 * Pure graph analysis over the ER model produced by erDiagramLogic.parseEr().
 * No security/permission analysis belongs here; that remains a Warden Studio concern.
 */
export function analyseArchitecture(model) {
    if (!model || !Array.isArray(model.entities) || !Array.isArray(model.relationships)) {
        throw new Error('Architecture analysis requires a parsed ER model with entities and relationships.');
    }
    const entities = model.entities;
    const relationships = model.relationships;
    entities.forEach((e,index)=>{
        if(!e || typeof e.name!=='string' || !e.name.trim()) throw new Error('Invalid entity at position '+(index+1)+': a non-empty name is required.');
        if(e.fields!=null && !Array.isArray(e.fields)) throw new Error('Invalid fields for '+e.name+': expected a field list.');
    });
    relationships.forEach((r,index)=>{
        if(!r || typeof r.childEntity!=='string' || typeof r.parentEntity!=='string') throw new Error('Invalid relationship at position '+(index+1)+'.');
    });
    const names = entities.map(e => e.name);
    const byKey = new Map(names.map(n => [n.toLowerCase(), n]));
    const incoming = new Map(names.map(n => [n.toLowerCase(), 0]));
    const outgoing = new Map(names.map(n => [n.toLowerCase(), 0]));
    const adjacency = new Map(names.map(n => [n.toLowerCase(), new Set()]));

    const ignoredRelationships=[];
    relationships.forEach((r,index) => {
        const c=r.childEntity.toLowerCase(), p=r.parentEntity.toLowerCase();
        if(!adjacency.has(c) || !adjacency.has(p)){
            ignoredRelationships.push({index:index+1,childEntity:r.childEntity,parentEntity:r.parentEntity,reason:'Relationship endpoint is not present in the current model.'});
            return;
        }
        outgoing.set(c,(outgoing.get(c)||0)+1);
        incoming.set(p,(incoming.get(p)||0)+1);
        if(adjacency.has(c)) adjacency.get(c).add(p);
        if(adjacency.has(p)) adjacency.get(p).add(c);
    });

    const nodes = entities.map(e => {
        const k=e.name.toLowerCase(), inc=incoming.get(k)||0, out=outgoing.get(k)||0;
        return { name:e.name, fieldCount:(e.fields||[]).length, incoming:inc, outgoing:out, degree:inc+out,
            relationshipFieldCount:(e.fields||[]).filter(f=>f.isRelationship).length,
            requiredFieldCount:(e.fields||[]).filter(f=>f.isRequired).length,
            rollupFieldCount:(e.fields||[]).filter(f=>f.isRollupSummary).length };
    }).sort((a,b)=>b.degree-a.degree || b.fieldCount-a.fieldCount || a.name.localeCompare(b.name));

    const cycles = findCycles(names, adjacency, byKey);
    const components = connectedComponents(names, adjacency);
    const maxDepth = approximateGraphDepth(names, adjacency);
    const avgDegree = entities.length ? (relationships.length * 2) / entities.length : 0;
    const density = entities.length > 1 ? (relationships.length * 2) / (entities.length * (entities.length - 1)) : 0;
    const avgFields = entities.length ? entities.reduce((sum,e)=>sum+(e.fields||[]).length,0)/entities.length : 0;
    const hubs = nodes.filter(n=>n.degree>=Math.max(3, Math.ceil(relationships.length/Math.max(1,entities.length))));
    const islands = nodes.filter(n=>n.degree===0);

    return {
        entityCount:entities.length, fieldCount:entities.reduce((s,e)=>s+(e.fields||[]).length,0),
        relationshipCount:relationships.length,
        lookupCount:relationships.filter(r=>r.kind==='lookup').length,
        masterDetailCount:relationships.filter(r=>r.kind==='master').length,
        polymorphicCount:relationships.filter(r=>r.kind==='poly').length,
        customObjectCount:entities.filter(e=>/__c$/i.test(e.name)).length,
        nodes, hubs, islands, cycles, componentCount:components.length, maxRelationshipDepth:maxDepth,
        averageDegree:Number(avgDegree.toFixed(2)), relationshipDensity:Number(density.toFixed(3)),
        averageFieldsPerObject:Number(avgFields.toFixed(1)),
        mostConnected:nodes.slice(0,5),
        largestObjects:[...nodes].sort((a,b)=>b.fieldCount-a.fieldCount || a.name.localeCompare(b.name)).slice(0,5),
        relationships: relationships.filter(r=>adjacency.has(r.childEntity.toLowerCase())&&adjacency.has(r.parentEntity.toLowerCase())),
        ignoredRelationships,
        observations: buildObservations(nodes, relationships, components, cycles, maxDepth, avgDegree, ignoredRelationships)
    };
}
function connectedComponents(names,adj){const seen=new Set(),out=[]; for(const n of names){const k=n.toLowerCase();if(seen.has(k))continue;const stack=[k],c=[];seen.add(k);while(stack.length){const x=stack.pop();c.push(x);for(const y of adj.get(x)||[]){if(!seen.has(y)){seen.add(y);stack.push(y);}}}out.push(c);}return out;}
// Exact longest-simple-path search is exponential on cyclic graphs. For an interactive
// architect tool we use bounded BFS eccentricity instead: O(V*(V+E)), predictable even
// for large org diagrams, and still a useful measure of relationship reach/depth.
function approximateGraphDepth(names,adj){
    let best=0;
    for(const n of names){
        const start=n.toLowerCase(),dist=new Map([[start,0]]),queue=[start];
        for(let i=0;i<queue.length;i++){
            const x=queue[i],d=dist.get(x);
            if(d>best) best=d;
            for(const y of adj.get(x)||[]){
                if(!dist.has(y)){dist.set(y,d+1);queue.push(y);}
            }
        }
    }
    return best;
}
function findCycles(names,adj,byKey){const found=new Set(),cycles=[]; const MAX_CYCLES=25, MAX_DEPTH=7;const canonical=p=>{const core=p.slice(0,-1);const rots=[];for(let i=0;i<core.length;i++)rots.push(core.slice(i).concat(core.slice(0,i)).join('|'));const rev=[...core].reverse();for(let i=0;i<rev.length;i++)rots.push(rev.slice(i).concat(rev.slice(0,i)).join('|'));return rots.sort()[0];};const dfs=(start,x,path,seen)=>{if(cycles.length>=MAX_CYCLES)return;for(const y of adj.get(x)||[]){if(y===start&&path.length>=3){const p=path.concat(start),key=canonical(p);if(!found.has(key)){found.add(key);cycles.push(p.map(k=>byKey.get(k)||k));}}else if(!seen.has(y)&&path.length<MAX_DEPTH){const s=new Set(seen);s.add(y);dfs(start,y,path.concat(y),s);}}};for(const n of names){if(cycles.length>=MAX_CYCLES)break;const k=n.toLowerCase();dfs(k,k,[k],new Set([k]));}return cycles;}

function buildObservations(nodes,relationships,components,cycles,maxDepth,avgDegree,ignoredRelationships){
    const out=[];
    const islands=nodes.filter(n=>n.degree===0);
    const high=nodes.filter(n=>n.degree>=Math.max(4,Math.ceil(avgDegree*2)));
    const large=nodes.filter(n=>n.fieldCount>=50);
    if(ignoredRelationships.length) out.push({title:'Relationships skipped',detail:ignoredRelationships.length+' relationship'+(ignoredRelationships.length===1?' was':'s were')+' excluded because an endpoint is not present in the current model.',kind:'Data quality'});
    if(high.length) out.push({title:'High-coupling objects',detail:high.slice(0,5).map(n=>n.name+' ('+n.degree+' relationships)').join(', '),kind:'Topology'});
    if(islands.length) out.push({title:'Isolated model areas',detail:islands.slice(0,8).map(n=>n.name).join(', '),kind:'Topology'});
    if(components.length>1) out.push({title:'Disconnected components',detail:components.length+' separate relationship components exist in the current diagram.',kind:'Structure'});
    if(cycles.length) out.push({title:'Relationship cycles',detail:cycles.length+' cycle'+(cycles.length===1?'':'s')+' detected. Review these as intentional topology, not automatically as defects.',kind:'Topology'});
    if(maxDepth>=5) out.push({title:'Deep relationship paths',detail:'The longest simple relationship path spans '+maxDepth+' hops.',kind:'Complexity'});
    if(large.length) out.push({title:'Large object definitions',detail:large.slice(0,5).map(n=>n.name+' ('+n.fieldCount+' fields)').join(', '),kind:'Model size'});
    if(!out.length&&relationships.length) out.push({title:'Balanced current model',detail:'No notable topology observations were triggered by the current diagram thresholds.',kind:'Structure'});
    return out;
}

export function analyseObject(analysis, objectName) {
    if(!analysis || !objectName) return null;
    const key=objectName.toLowerCase();
    const node=(analysis.nodes||[]).find(n=>n.name.toLowerCase()===key);
    if(!node) return null;
    const rels=analysis.relationships||[];
    const parents=[],children=[],neighbors=new Set();
    rels.forEach(r=>{
        const c=r.childEntity.toLowerCase(),p=r.parentEntity.toLowerCase();
        if(c===key){parents.push({name:r.parentEntity,field:r.childField||'',kind:r.kind||'relationship'});neighbors.add(r.parentEntity);}
        if(p===key){children.push({name:r.childEntity,field:r.childField||'',kind:r.kind||'relationship'});neighbors.add(r.childEntity);}
    });
    const adj=new Map((analysis.nodes||[]).map(n=>[n.name.toLowerCase(),new Set()]));
    rels.forEach(r=>{const c=r.childEntity.toLowerCase(),p=r.parentEntity.toLowerCase();if(adj.has(c)&&adj.has(p)){adj.get(c).add(p);adj.get(p).add(c);}});
    const levels=[];let frontier=new Set([key]),seen=new Set([key]);
    for(let depth=1;depth<=3;depth++){const next=new Set();frontier.forEach(x=>(adj.get(x)||[]).forEach(y=>{if(!seen.has(y)){seen.add(y);next.add(y);}}));levels.push({depth,count:next.size,names:[...next].map(k=>(analysis.nodes||[]).find(n=>n.name.toLowerCase()===k)?.name||k)});frontier=next;}
    const objectCycles=(analysis.cycles||[]).filter(c=>c.some(n=>n.toLowerCase()===key));
    let role='Connected object'; if(node.degree===0)role='Isolated object'; else if((analysis.hubs||[]).some(h=>h.name.toLowerCase()===key))role='Structural hub'; else if(node.incoming>node.outgoing*2)role='Relationship target'; else if(node.outgoing>node.incoming*2)role='Relationship source';
    return {...node,role,parents,children,neighbors:[...neighbors].sort(),reach1:levels[0],reach2:levels[1],reach3:levels[2],reachableWithin3:[...seen].filter(k=>k!==key).length,cycles:objectCycles};
}

function graphIndex(analysis){
    const nodes=analysis?.nodes||[], rels=analysis?.relationships||[];
    const names=new Map(nodes.map(n=>[n.name.toLowerCase(),n.name]));
    const adj=new Map(nodes.map(n=>[n.name.toLowerCase(),new Set()]));
    rels.forEach(r=>{const c=r.childEntity.toLowerCase(),p=r.parentEntity.toLowerCase();if(adj.has(c)&&adj.has(p)){adj.get(c).add(p);adj.get(p).add(c);}});
    return {names,adj};
}
export function findArchitecturePath(analysis,source,target){
    if(!analysis||!source||!target)return null;const {names,adj}=graphIndex(analysis),s=source.toLowerCase(),t=target.toLowerCase();
    if(!adj.has(s)||!adj.has(t))return {found:false,path:[],hops:0};
    const q=[s],prev=new Map([[s,null]]);
    for(let i=0;i<q.length;i++){const x=q[i];if(x===t)break;for(const y of adj.get(x)||[]){if(!prev.has(y)){prev.set(y,x);q.push(y);}}}
    if(!prev.has(t))return {found:false,path:[],hops:0};
    const keys=[];for(let x=t;x!=null;x=prev.get(x))keys.push(x);keys.reverse();
    return {found:true,path:keys.map(k=>names.get(k)||k),hops:Math.max(0,keys.length-1)};
}
export function analyseBlastRadius(analysis,objectName,maxDepth=3){
    if(!analysis||!objectName)return null;const {names,adj}=graphIndex(analysis),start=objectName.toLowerCase();
    if(!adj.has(start))return null;const depthLimit=Math.max(1,Math.min(5,maxDepth)),seen=new Map([[start,0]]),q=[start];
    for(let i=0;i<q.length;i++){const x=q[i],d=seen.get(x);if(d>=depthLimit)continue;for(const y of adj.get(x)||[]){if(!seen.has(y)){seen.set(y,d+1);q.push(y);}}}
    const levels=[];for(let d=1;d<=depthLimit;d++){const objects=[...seen].filter(([,v])=>v===d).map(([k])=>names.get(k)||k).sort();levels.push({depth:d,count:objects.length,objects});}
    return {source:names.get(start)||objectName,maxDepth:depthLimit,total:[...seen].filter(([k])=>k!==start).length,levels};
}
export function detectJunctionObjects(analysis){
    if(!analysis)return[];const rels=analysis.relationships||[];
    return (analysis.nodes||[]).map(n=>{const outbound=rels.filter(r=>r.childEntity.toLowerCase()===n.name.toLowerCase());const targets=[...new Set(outbound.map(r=>r.parentEntity.toLowerCase()))];const masters=outbound.filter(r=>r.kind==='master').length;return {name:n.name,outboundRelationships:outbound.length,distinctTargets:targets.length,masterDetailRelationships:masters,confidence:masters>=2?'Strong':targets.length>=2?'Candidate':'None'};}).filter(x=>x.distinctTargets>=2).sort((a,b)=>b.masterDetailRelationships-a.masterDetailRelationships||b.distinctTargets-a.distinctTargets||a.name.localeCompare(b.name));
}
