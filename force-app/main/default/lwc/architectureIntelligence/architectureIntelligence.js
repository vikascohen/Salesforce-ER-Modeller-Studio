/**
 * Phase 2 — Data Architecture Intelligence.
 * Author: Vikas Cohen
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
    const outboundByNode = new Map(names.map(n => [n.toLowerCase(), []]));
    const inboundByNode = new Map(names.map(n => [n.toLowerCase(), []]));

    const ignoredRelationships=[];
    relationships.forEach((r,index) => {
        const c=r.childEntity.toLowerCase(), p=r.parentEntity.toLowerCase();
        if(!adjacency.has(c) || !adjacency.has(p)){
            ignoredRelationships.push({index:index+1,childEntity:r.childEntity,parentEntity:r.parentEntity,reason:'Relationship endpoint is not present in the current model.'});
            return;
        }
        outgoing.set(c,(outgoing.get(c)||0)+1);
        incoming.set(p,(incoming.get(p)||0)+1);
        adjacency.get(c).add(p);
        adjacency.get(p).add(c);
        outboundByNode.get(c).push(r);
        inboundByNode.get(p).push(r);
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

    const validRelationships = relationships.filter(r =>
        adjacency.has(r.childEntity.toLowerCase()) && adjacency.has(r.parentEntity.toLowerCase())
    );
    const analysis = {
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
        relationships: validRelationships,
        ignoredRelationships,
        observations: buildObservations(nodes, validRelationships, components, cycles, maxDepth, avgDegree, ignoredRelationships)
    };

    Object.defineProperty(analysis, '_graphIndex', {
        value: { names: byKey, adj: adjacency, outboundByNode, inboundByNode },
        enumerable: false,
        writable: false
    });
    return analysis;
}
function connectedComponents(names, adjacency) {
    const seen = new Set();
    const components = [];

    for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;

        const stack = [key];
        const component = [];
        seen.add(key);

        while (stack.length) {
            const current = stack.pop();
            component.push(current);

            for (const neighbor of adjacency.get(current) || []) {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    stack.push(neighbor);
                }
            }
        }
        components.push(component);
    }
    return components;
}

// Exact longest-simple-path search is exponential on cyclic graphs. For an interactive
// architect tool we use bounded BFS eccentricity instead: O(V*(V+E)), predictable even
// for large org diagrams, and still a useful measure of relationship reach/depth.
function approximateGraphDepth(names, adjacency) {
    let best = 0;
    for (const name of names) {
        const start = name.toLowerCase();
        const distances = new Map([[start, 0]]);
        const queue = [start];

        for (let i = 0; i < queue.length; i++) {
            const current = queue[i];
            const distance = distances.get(current);
            if (distance > best) best = distance;

            for (const neighbor of adjacency.get(current) || []) {
                if (!distances.has(neighbor)) {
                    distances.set(neighbor, distance + 1);
                    queue.push(neighbor);
                }
            }
        }
    }
    return best;
}

function findCycles(names, adjacency, byKey) {
    const found = new Set();
    const cycles = [];
    const MAX_CYCLES = 25;
    const MAX_DEPTH = 7;

    const canonical = path => {
        const core = path.slice(0, -1);
        const rotations = [];

        for (let i = 0; i < core.length; i++) {
            rotations.push(core.slice(i).concat(core.slice(0, i)).join('|'));
        }

        const reversed = [...core].reverse();
        for (let i = 0; i < reversed.length; i++) {
            rotations.push(reversed.slice(i).concat(reversed.slice(0, i)).join('|'));
        }
        return rotations.sort()[0];
    };

    const dfs = (start, current, path, seen) => {
        if (cycles.length >= MAX_CYCLES) return;

        for (const neighbor of adjacency.get(current) || []) {
            if (neighbor === start && path.length >= 3) {
                const cyclePath = path.concat(start);
                const key = canonical(cyclePath);
                if (!found.has(key)) {
                    found.add(key);
                    cycles.push(cyclePath.map(item => byKey.get(item) || item));
                }
            } else if (!seen.has(neighbor) && path.length < MAX_DEPTH) {
                const nextSeen = new Set(seen);
                nextSeen.add(neighbor);
                dfs(start, neighbor, path.concat(neighbor), nextSeen);
            }
        }
    };

    for (const name of names) {
        if (cycles.length >= MAX_CYCLES) break;
        const key = name.toLowerCase();
        dfs(key, key, [key], new Set([key]));
    }
    return cycles;
}

function buildObservations(nodes, relationships, components, cycles, maxDepth, avgDegree, ignoredRelationships) {
    const observations = [];
    const islands = nodes.filter(node => node.degree === 0);
    const highCoupling = nodes.filter(node => node.degree >= Math.max(4, Math.ceil(avgDegree * 2)));
    const largeObjects = nodes.filter(node => node.fieldCount >= 50);

    if (ignoredRelationships.length) {
        observations.push({
            title: 'Relationships skipped',
            detail: ignoredRelationships.length + ' relationship' +
                (ignoredRelationships.length === 1 ? ' was' : 's were') +
                ' excluded because an endpoint is not present in the current model.',
            kind: 'Data quality'
        });
    }
    if (highCoupling.length) {
        observations.push({
            title: 'High-coupling objects',
            detail: highCoupling.slice(0, 5).map(node => node.name + ' (' + node.degree + ' relationships)').join(', '),
            kind: 'Topology'
        });
    }
    if (islands.length) {
        observations.push({
            title: 'Isolated model areas',
            detail: islands.slice(0, 8).map(node => node.name).join(', '),
            kind: 'Topology'
        });
    }
    if (components.length > 1) {
        observations.push({
            title: 'Disconnected components',
            detail: components.length + ' separate relationship components exist in the current diagram.',
            kind: 'Structure'
        });
    }
    if (cycles.length) {
        observations.push({
            title: 'Relationship cycles',
            detail: cycles.length + ' cycle' + (cycles.length === 1 ? '' : 's') +
                ' detected. Review these as intentional topology, not automatically as defects.',
            kind: 'Topology'
        });
    }
    if (maxDepth >= 5) {
        observations.push({
            title: 'Deep relationship paths',
            detail: 'The longest simple relationship path spans ' + maxDepth + ' hops.',
            kind: 'Complexity'
        });
    }
    if (largeObjects.length) {
        observations.push({
            title: 'Large object definitions',
            detail: largeObjects.slice(0, 5).map(node => node.name + ' (' + node.fieldCount + ' fields)').join(', '),
            kind: 'Model size'
        });
    }
    if (!observations.length && relationships.length) {
        observations.push({
            title: 'Balanced current model',
            detail: 'No notable topology observations were triggered by the current diagram thresholds.',
            kind: 'Structure'
        });
    }
    return observations;
}

export function analyseObject(analysis, objectName) {
    if (!analysis || !objectName) return null;

    const key = objectName.toLowerCase();
    const nodes = analysis.nodes || [];
    const node = nodes.find(item => item.name.toLowerCase() === key);
    if (!node) return null;

    const { names, adj, outboundByNode, inboundByNode } = graphIndex(analysis);
    const parents = (outboundByNode.get(key) || []).map(relationship => ({
        name: relationship.parentEntity,
        field: relationship.childField || '',
        kind: relationship.kind || 'relationship'
    }));
    const children = (inboundByNode.get(key) || []).map(relationship => ({
        name: relationship.childEntity,
        field: relationship.childField || '',
        kind: relationship.kind || 'relationship'
    }));
    const neighbors = new Set([
        ...parents.map(parent => parent.name),
        ...children.map(child => child.name)
    ]);
    const levels = [];
    let frontier = new Set([key]);
    const seen = new Set([key]);

    for (let depth = 1; depth <= 3; depth++) {
        const next = new Set();
        frontier.forEach(current => {
            (adj.get(current) || []).forEach(neighbor => {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    next.add(neighbor);
                }
            });
        });
        levels.push({
            depth,
            count: next.size,
            names: [...next].map(item => names.get(item) || item)
        });
        frontier = next;
    }

    const objectCycles = (analysis.cycles || []).filter(cycle =>
        cycle.some(name => name.toLowerCase() === key)
    );

    let role = 'Connected object';
    if (node.degree === 0) role = 'Isolated object';
    else if ((analysis.hubs || []).some(hub => hub.name.toLowerCase() === key)) role = 'Structural hub';
    else if (node.incoming > node.outgoing * 2) role = 'Relationship target';
    else if (node.outgoing > node.incoming * 2) role = 'Relationship source';

    return {
        ...node,
        role,
        parents,
        children,
        neighbors: [...neighbors].sort(),
        reach1: levels[0],
        reach2: levels[1],
        reach3: levels[2],
        reachableWithin3: [...seen].filter(item => item !== key).length,
        cycles: objectCycles
    };
}

function graphIndex(analysis) {
    if (analysis?._graphIndex) return analysis._graphIndex;

    const nodes = analysis?.nodes || [];
    const relationships = analysis?.relationships || [];
    const names = new Map(nodes.map(node => [node.name.toLowerCase(), node.name]));
    const adj = new Map(nodes.map(node => [node.name.toLowerCase(), new Set()]));
    const outboundByNode = new Map(nodes.map(node => [node.name.toLowerCase(), []]));
    const inboundByNode = new Map(nodes.map(node => [node.name.toLowerCase(), []]));

    relationships.forEach(relationship => {
        const child = relationship.childEntity.toLowerCase();
        const parent = relationship.parentEntity.toLowerCase();
        if (adj.has(child) && adj.has(parent)) {
            adj.get(child).add(parent);
            adj.get(parent).add(child);
            outboundByNode.get(child).push(relationship);
            inboundByNode.get(parent).push(relationship);
        }
    });

    return { names, adj, outboundByNode, inboundByNode };
}

export function findArchitecturePath(analysis, source, target) {
    if (!analysis || !source || !target) return null;

    const { names, adj } = graphIndex(analysis);
    const sourceKey = source.toLowerCase();
    const targetKey = target.toLowerCase();

    if (!adj.has(sourceKey) || !adj.has(targetKey)) {
        return { found: false, path: [], hops: 0 };
    }

    const queue = [sourceKey];
    const previous = new Map([[sourceKey, null]]);

    for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        if (current === targetKey) break;

        for (const neighbor of adj.get(current) || []) {
            if (!previous.has(neighbor)) {
                previous.set(neighbor, current);
                queue.push(neighbor);
            }
        }
    }

    if (!previous.has(targetKey)) {
        return { found: false, path: [], hops: 0 };
    }

    const pathKeys = [];
    for (let current = targetKey; current != null; current = previous.get(current)) {
        pathKeys.push(current);
    }
    pathKeys.reverse();

    return {
        found: true,
        path: pathKeys.map(key => names.get(key) || key),
        hops: Math.max(0, pathKeys.length - 1)
    };
}

export function analyseBlastRadius(analysis, objectName, maxDepth = 3) {
    if (!analysis || !objectName) return null;

    const { names, adj } = graphIndex(analysis);
    const start = objectName.toLowerCase();
    if (!adj.has(start)) return null;

    const depthLimit = Math.max(1, Math.min(5, maxDepth));
    const seen = new Map([[start, 0]]);
    const queue = [start];

    for (let i = 0; i < queue.length; i++) {
        const current = queue[i];
        const depth = seen.get(current);
        if (depth >= depthLimit) continue;

        for (const neighbor of adj.get(current) || []) {
            if (!seen.has(neighbor)) {
                seen.set(neighbor, depth + 1);
                queue.push(neighbor);
            }
        }
    }

    const levels = [];
    for (let depth = 1; depth <= depthLimit; depth++) {
        const objects = [...seen]
            .filter(([, value]) => value === depth)
            .map(([key]) => names.get(key) || key)
            .sort();
        levels.push({ depth, count: objects.length, objects });
    }

    return {
        source: names.get(start) || objectName,
        maxDepth: depthLimit,
        total: [...seen].filter(([key]) => key !== start).length,
        levels
    };
}

export function detectJunctionObjects(analysis) {
    if (!analysis) return [];

    const { outboundByNode } = graphIndex(analysis);
    return (analysis.nodes || [])
        .map(node => {
            const nodeKey = node.name.toLowerCase();
            const outbound = outboundByNode.get(nodeKey) || [];
            const targets = [...new Set(outbound.map(
                relationship => relationship.parentEntity.toLowerCase()
            ))];
            const masters = outbound.filter(relationship => relationship.kind === 'master').length;

            return {
                name: node.name,
                outboundRelationships: outbound.length,
                distinctTargets: targets.length,
                masterDetailRelationships: masters,
                confidence: masters >= 2 ? 'Strong' : targets.length >= 2 ? 'Candidate' : 'None'
            };
        })
        .filter(item => item.distinctTargets >= 2)
        .sort((a, b) =>
            b.masterDetailRelationships - a.masterDetailRelationships ||
            b.distinctTargets - a.distinctTargets ||
            a.name.localeCompare(b.name)
        );
}

export function analyseDomains(analysis, assignments = {}) {
    if (!analysis) return { domains: [], couplings: [], unassigned: [] };

    const domainOf = new Map();
    const display = new Map();

    (analysis.nodes || []).forEach(node => {
        const raw = assignments[node.name] || assignments[node.name.toLowerCase()] || '';
        const domain = String(raw).trim();
        if (domain) {
            domainOf.set(node.name.toLowerCase(), domain.toLowerCase());
            display.set(domain.toLowerCase(), domain);
        }
    });

    const stats = new Map(
        [...display].map(([key, name]) => [
            key,
            {
                name,
                objectCount: 0,
                fieldCount: 0,
                internalRelationships: 0,
                crossDomainRelationships: 0
            }
        ])
    );

    (analysis.nodes || []).forEach(node => {
        const domain = domainOf.get(node.name.toLowerCase());
        if (domain) {
            const stat = stats.get(domain);
            stat.objectCount++;
            stat.fieldCount += node.fieldCount || 0;
        }
    });

    const pairs = new Map();
    (analysis.relationships || []).forEach(relationship => {
        const childDomain = domainOf.get(relationship.childEntity.toLowerCase());
        const parentDomain = domainOf.get(relationship.parentEntity.toLowerCase());
        if (!childDomain || !parentDomain) return;

        if (childDomain === parentDomain) {
            stats.get(childDomain).internalRelationships++;
            return;
        }

        stats.get(childDomain).crossDomainRelationships++;
        stats.get(parentDomain).crossDomainRelationships++;

        const keys = [childDomain, parentDomain].sort();
        const pairKey = keys.join('|');
        if (!pairs.has(pairKey)) {
            pairs.set(pairKey, {
                domainA: display.get(keys[0]),
                domainB: display.get(keys[1]),
                relationshipCount: 0
            });
        }
        pairs.get(pairKey).relationshipCount++;
    });

    return {
        domains: [...stats.values()].sort((a, b) =>
            b.crossDomainRelationships - a.crossDomainRelationships ||
            b.objectCount - a.objectCount ||
            a.name.localeCompare(b.name)
        ),
        couplings: [...pairs.values()].sort((a, b) =>
            b.relationshipCount - a.relationshipCount ||
            a.domainA.localeCompare(b.domainA)
        ),
        unassigned: (analysis.nodes || [])
            .filter(node => !domainOf.has(node.name.toLowerCase()))
            .map(node => node.name)
            .sort()
    };
}
