const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;
const NODE_W = 190;
const NODE_H = 68;
const MAP_PAD = 72;
const COLLAPSED_EVIDENCE_LIMIT = 4;
const MAX_EVIDENCE_ITEMS = 40;
const X = { object: 30, field: 290, type: 560, component: 850, detail: 1160 };

export function clampFieldUsageZoom(value) {
    const rounded = Math.round(Number(value || 1) / ZOOM_STEP) * ZOOM_STEP;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(rounded.toFixed(1))));
}

export function calculateFieldUsageFitZoom(map, viewportWidth, viewportHeight, padding = 72) {
    const width = Math.max(1, Number(map?.width) || 1320);
    const height = Math.max(1, Number(map?.height) || 650);
    const availableWidth = Math.max(1, Number(viewportWidth || width) - padding * 2);
    const availableHeight = Math.max(1, Number(viewportHeight || height) - padding * 2);
    return clampFieldUsageZoom(Math.min(1, availableWidth / width, availableHeight / height));
}

export function buildFieldUsageViewportStyle(map, zoom) {
    const width = Math.max(1, Number(map?.width) || 1320);
    const height = Math.max(1, Number(map?.height) || 650);
    const scale = clampFieldUsageZoom(zoom);
    return {
        stageStyle: `width:${Math.ceil(width * scale) + MAP_PAD * 2}px;height:${Math.ceil(height * scale) + MAP_PAD * 2}px;padding:${MAP_PAD}px;`,
        canvasStyle: `width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:0 0;`
    };
}

function evidenceLines(row) {
    const raw = String(row?.evidence || '').split(/(?:\\n|\r?\n)+/).map(v => v.trim()).filter(Boolean);
    if (raw.length) return raw;
    const fallback = String(row?.location || row?.evidenceType || 'Usage detected').trim();
    return fallback ? [fallback] : ['Usage detected'];
}

function sourceKind(sourceType) {
    const value = String(sourceType || '').toLowerCase();
    if (value.includes('flow')) return 'flow-type';
    if (value.includes('trigger')) return 'trigger-type';
    if (value.includes('apex')) return 'apex-type';
    if (value.includes('lwc')) return 'lwc-type';
    if (value.includes('aura')) return 'aura-type';
    if (value.includes('formula')) return 'formula-type';
    if (value.includes('validation')) return 'validation-type';
    return 'type';
}

function nodeWidth(node) {
    if (node?.kind === 'component') return 250;
    if (node?.kind === 'usage') return 280;
    if (node?.kind === 'evidence-more' || node?.kind === 'evidence') return 210;
    return NODE_W;
}

function dataKey(field, sourceType) { return `${field}\u0001${sourceType}`; }

export function buildFieldUsageMap({ evidence = [], selectedFields = [], objectApiName = '', expandedEvidence = [] } = {}) {
    const rows = evidence || [];
    const expanded = new Set(expandedEvidence || []);
    const nodes = [], edges = [], branchRequests = [];
    const nodeByKey = new Map();
    const summariesByField = new Map();
    const detailsByBranch = new Map();
    const pageStateByBranch = new Map();

    rows.forEach(row => {
        const field = row.fieldApiName || '';
        if (row._detail) {
            const key = dataKey(field, row.sourceType || '');
            if (!detailsByBranch.has(key)) detailsByBranch.set(key, []);
            detailsByBranch.get(key).push(row);
        } else if (row._pageState) {
            pageStateByBranch.set(dataKey(field, row.sourceType || ''), row);
        } else {
            if (!summariesByField.has(field)) summariesByField.set(field, []);
            summariesByField.get(field).push(row);
        }
    });

    const add = (key, label, sub, x, y, kind, extra = {}) => {
        const node = { key, label, sub, x, y, kind, ...extra, style:`left:${x}px;top:${y}px;` };
        nodes.push(node); nodeByKey.set(key, node); return node;
    };
    const connect = (a, b) => {
        const A = nodeByKey.get(a), B = nodeByKey.get(b);
        if (!A || !B) return;
        const x1=A.x+nodeWidth(A), y1=A.y+NODE_H/2, x2=B.x, y2=B.y+NODE_H/2;
        const mid=Math.round((x1+x2)/2);
        edges.push({key:`${a}>${b}`,path:`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`});
    };
    const addSharedBranches = (parentKey, childKeys) => {
        const parent=nodeByKey.get(parentKey), children=childKeys.map(k=>nodeByKey.get(k)).filter(Boolean);
        if (!parent || !children.length) return;
        const x1=parent.x+nodeWidth(parent), y1=parent.y+NODE_H/2;
        if (children.length===1) {
            const child=children[0], x2=child.x, y2=child.y+NODE_H/2, mid=Math.round((x1+x2)/2);
            edges.push({key:`${parentKey}>${child.key}`,path:`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}); return;
        }
        const trunkX=Math.round(x1+Math.max(42,(children[0].x-x1)*0.48));
        const ys=children.map(n=>n.y+NODE_H/2);
        edges.push({key:`${parentKey}:trunk-in`,path:`M ${x1} ${y1} H ${trunkX}`});
        edges.push({key:`${parentKey}:trunk`,path:`M ${trunkX} ${Math.min(...ys)} V ${Math.max(...ys)}`});
        children.forEach(child=>edges.push({key:`${parentKey}>${child.key}`,path:`M ${trunkX} ${child.y+NODE_H/2} H ${child.x}`}));
    };

    let cursorY=42;
    const fieldCentres=[];
    (selectedFields || []).forEach(field => {
        const summaries=summariesByField.get(field) || [];
        const fieldTop=cursorY, fk=`f:${field}`;
        add(fk,field,`${summaries.reduce((n,r)=>n+(r.occurrences||r.evidenceRows||0),0)} usages`,X.field,fieldTop,'field');
        const typeKeys=[];
        if (!summaries.length) {
            const emptyKey=`${fk}:none`; add(emptyKey,'No dependency detected','Current successful snapshot · 0 dependencies',X.type,cursorY,'empty');
            typeKeys.push(emptyKey); cursorY+=104;
        } else summaries.forEach(r => {
            const tk=`${fk}:${r.sourceType}`, branchKey=dataKey(field,r.sourceType || '');
            typeKeys.push(tk);
            const details=detailsByBranch.get(branchKey) || [], pageState=pageStateByBranch.get(branchKey);
            const collapseKey=`source-collapse|${field}|${r.sourceType}`;
            const sourceCollapsed=details.length>0 && expanded.has(collapseKey);
            const sourceSub=!details.length || sourceCollapsed
                ? `${r.occurrences||r.evidenceRows||0} usages · click to expand`
                : `${r.occurrences||r.evidenceRows||0} usages · ${pageState?.hasMore?'click to load more':`${details.length} components loaded`} · click to collapse`;
            add(tk,r.sourceType,sourceSub,X.type,cursorY,sourceKind(r.sourceType),{
                field,source:r.sourceType,expandable:true,...(details.length?{evidenceKey:collapseKey,toggleEvidence:true}:{})
            });
            if (!details.length || sourceCollapsed) { cursorY+=96; return; }

            const byComponent=new Map();
            details.forEach(d=>{const name=d.componentName||'Unknown component'; if(!byComponent.has(name))byComponent.set(name,[]); byComponent.get(name).push(d);});
            byComponent.forEach((componentRows,name)=>{
                const ck=`${tk}:component:${name}`, componentY=cursorY;
                const allLines=[];
                for (const row of componentRows) {
                    for (const line of evidenceLines(row)) { allLines.push(line); if (allLines.length>=MAX_EVIDENCE_ITEMS) break; }
                    if (allLines.length>=MAX_EVIDENCE_ITEMS) break;
                }
                const source=String(r.sourceType||'');
                const evidenceKey=`${field}|${r.sourceType}|${name}`;
                const componentCollapseKey=`component-collapse|${field}|${r.sourceType}|${name}`;
                const componentCollapsed=expanded.has(componentCollapseKey);
                const isExpanded=expanded.has(evidenceKey), isFlow=source.toLowerCase().includes('flow');
                const componentUsageCount=componentRows.reduce((n,d)=>n+(Number(d.occurrenceCount)||1),0);
                const componentSub=componentCollapsed
                    ? `${componentUsageCount} usage${componentUsageCount===1?'':'s'} · click to expand`
                    : isFlow
                        ? `${componentRows.length} evidence record${componentRows.length===1?'':'s'} · click to minimise`
                        : `${componentUsageCount} usage${componentUsageCount===1?'':'s'} · ${allLines.length>COLLAPSED_EVIDENCE_LIMIT?(isExpanded?'all evidence shown':'expand for all evidence'):'evidence shown'} · click to minimise`;
                add(ck,name,componentSub,X.component,componentY,'component',{
                    source:r.sourceType,
                    evidenceKey:componentCollapseKey,
                    toggleEvidence:true
                });
                connect(tk,ck);

                if (componentCollapsed) {
                    cursorY+=112;
                    return;
                }

                const visibleLines=isExpanded?allLines:allLines.slice(0,COLLAPSED_EVIDENCE_LIMIT), detailKeys=[];
                visibleLines.forEach((line,j)=>{
                    const dk=`${ck}:detail:${j}`; detailKeys.push(dk);
                    const isUsage=/^Line\s+/i.test(line)||/^Flow\s*·/i.test(line)||/\$Record\./i.test(line);
                    add(dk,line.length>118?`${line.slice(0,115)}…`:line,isUsage?'FIELD USED HERE':(isFlow?'FLOW ELEMENT / METADATA LOCATION':'USAGE CONTEXT'),X.detail,componentY+j*92,isUsage?'usage':'evidence',{source:r.sourceType});
                });
                if (allLines.length>COLLAPSED_EVIDENCE_LIMIT) {
                    const moreKey=`${ck}:more`, hiddenCount=Math.max(0,allLines.length-COLLAPSED_EVIDENCE_LIMIT); detailKeys.push(moreKey);
                    add(moreKey,isExpanded?'Show less evidence':`Show ${hiddenCount} more evidence item${hiddenCount===1?'':'s'}`,isExpanded?'Show the first evidence items only':'Expand this component to show every usage',X.detail,componentY+visibleLines.length*92,'evidence-more',{evidenceKey,toggleEvidence:true});
                }
                branchRequests.push([ck,detailKeys]);
                cursorY+=Math.max(112,(visibleLines.length+(allLines.length>COLLAPSED_EVIDENCE_LIMIT?1:0))*92+18);
            });
            cursorY+=18;
        });
        branchRequests.push([fk,typeKeys]);
        const fieldBottom=Math.max(fieldTop+NODE_H,cursorY-18), fieldCentre=Math.round((fieldTop+fieldBottom)/2), fieldNode=nodeByKey.get(fk);
        if(fieldNode){fieldNode.y=fieldCentre-NODE_H/2;fieldNode.style=`left:${fieldNode.x}px;top:${fieldNode.y}px;`;}
        fieldCentres.push(fieldCentre); cursorY+=30;
    });

    const objectCentre=fieldCentres.length?fieldCentres.reduce((a,b)=>a+b,0)/fieldCentres.length:76;
    add('object',objectApiName||'Object','Selected object',X.object,Math.max(42,objectCentre-NODE_H/2),'object');
    branchRequests.push(['object',(selectedFields||[]).map(field=>`f:${field}`)]);
    branchRequests.forEach(([parent,children])=>addSharedBranches(parent,children));
    const maxX=nodes.reduce((m,n)=>Math.max(m,n.x+nodeWidth(n)),1320), maxY=nodes.reduce((m,n)=>Math.max(m,n.y+110),650);
    return {nodes,edges,width:maxX+90,height:maxY+90};
}
