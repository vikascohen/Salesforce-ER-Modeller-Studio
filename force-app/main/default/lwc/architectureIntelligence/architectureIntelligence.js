/**
 * Phase 2 — Data Architecture Intelligence.
 * Pure graph analysis over the ER model produced by erDiagramLogic.parseEr().
 * No security/permission analysis belongs here; that remains a Warden Studio concern.
 */
export function analyseArchitecture(model) {
    const entities = model?.entities || [];
    const relationships = model?.relationships || [];
    const names = entities.map(e => e.name);
    const byKey = new Map(names.map(n => [n.toLowerCase(), n]));
    const incoming = new Map(names.map(n => [n.toLowerCase(), 0]));
    const outgoing = new Map(names.map(n => [n.toLowerCase(), 0]));
    const adjacency = new Map(names.map(n => [n.toLowerCase(), new Set()]));

    relationships.forEach(r => {
        const c=r.childEntity.toLowerCase(), p=r.parentEntity.toLowerCase();
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
        observations: buildObservations(nodes, relationships, components, cycles, maxDepth, avgDegree)
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

function buildObservations(nodes,relationships,components,cycles,maxDepth,avgDegree){
    const out=[];
    const islands=nodes.filter(n=>n.degree===0);
    const high=nodes.filter(n=>n.degree>=Math.max(4,Math.ceil(avgDegree*2)));
    const large=nodes.filter(n=>n.fieldCount>=50);
    if(high.length) out.push({title:'High-coupling objects',detail:high.slice(0,5).map(n=>n.name+' ('+n.degree+' relationships)').join(', '),kind:'Topology'});
    if(islands.length) out.push({title:'Isolated model areas',detail:islands.slice(0,8).map(n=>n.name).join(', '),kind:'Topology'});
    if(components.length>1) out.push({title:'Disconnected components',detail:components.length+' separate relationship components exist in the current diagram.',kind:'Structure'});
    if(cycles.length) out.push({title:'Relationship cycles',detail:cycles.length+' cycle'+(cycles.length===1?'':'s')+' detected. Review these as intentional topology, not automatically as defects.',kind:'Topology'});
    if(maxDepth>=5) out.push({title:'Deep relationship paths',detail:'The longest simple relationship path spans '+maxDepth+' hops.',kind:'Complexity'});
    if(large.length) out.push({title:'Large object definitions',detail:large.slice(0,5).map(n=>n.name+' ('+n.fieldCount+' fields)').join(', '),kind:'Model size'});
    if(!out.length&&relationships.length) out.push({title:'Balanced current model',detail:'No notable topology observations were triggered by the current diagram thresholds.',kind:'Structure'});
    return out;
}
