const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;
const NODE_W = 190;
const X = { object: 30, field: 290, type: 560, component: 850, detail: 1160 };

export function clampFieldUsageZoom(value) {
    const rounded = Math.round(Number(value || 1) / ZOOM_STEP) * ZOOM_STEP;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(rounded.toFixed(1))));
}

export function calculateFieldUsageFitZoom(map, viewportWidth, viewportHeight, padding = 36) {
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
        stageStyle: `width:${Math.ceil(width * scale)}px;height:${Math.ceil(height * scale)}px;`,
        canvasStyle: `width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:0 0;`
    };
}

function evidenceLines(row) {
    const raw = String(row?.evidence || '').split('\n').map(x => x.trim()).filter(Boolean);
    return raw.length ? raw : [row?.location || row?.evidenceType || 'Usage detected'];
}

function sourceKind(sourceType) {
    const value = String(sourceType || '').toLowerCase();
    if (value.includes('flow')) return 'flow-type';
    if (value.includes('trigger')) return 'trigger-type';
    if (value.includes('apex')) return 'apex-type';
    return 'type';
}

export function buildFieldUsageMap({ evidence = [], selectedFields = [], objectApiName = '' } = {}) {
    const rows = evidence || [];
    const nodes = [];
    const edges = [];
    const add = (key, label, sub, x, y, kind, extra = {}) => nodes.push({ key, label, sub, x, y, kind, ...extra, style: `left:${x}px;top:${y}px;` });
    const connect = (a, b) => {
        const A = nodes.find(n => n.key === a), B = nodes.find(n => n.key === b);
        if (!A || !B) return;
        const x1 = A.x + (A.kind === 'component' ? 250 : A.kind === 'usage' ? 280 : NODE_W);
        const y1 = A.y + 34, x2 = B.x, y2 = B.y + 34, mid = Math.round((x1 + x2) / 2);
        edges.push({ key: `${a}>${b}`, path: `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}` });
    };

    let cursorY = 42;
    const fieldCentres = [];
    (selectedFields || []).forEach(field => {
        const summaries = rows.filter(r => !r._detail && !r._pageState && r.fieldApiName === field);
        const fieldTop = cursorY;
        const fk = `f:${field}`;
        add(fk, field, `${summaries.reduce((n,r)=>n+(r.occurrences||r.evidenceRows||0),0)} usages`, X.field, fieldTop, 'field');
        if (!summaries.length) {
            add(`${fk}:none`, 'No dependency detected', 'Current successful snapshot · 0 dependencies', X.type, cursorY, 'empty');
            connect(fk, `${fk}:none`); cursorY += 104;
        } else {
            summaries.forEach(r => {
                const tk = `${fk}:${r.sourceType}`;
                const details = rows.filter(d => d._detail && d.fieldApiName === field && d.sourceType === r.sourceType);
                const pageState = rows.find(d => d._pageState && d.fieldApiName === field && d.sourceType === r.sourceType);
                const typeY = cursorY;
                add(tk, r.sourceType, `${r.occurrences||r.evidenceRows||0} usages · ${!details.length?'click to expand':pageState?.hasMore?'click to load more':`${details.length} components loaded`}`, X.type, typeY, sourceKind(r.sourceType), { field, source:r.sourceType, expandable:true });
                connect(fk, tk);
                if (!details.length) { cursorY += 96; return; }

                const names = [...new Set(details.map(d => d.componentName || 'Unknown component'))];
                names.forEach(name => {
                    const componentRows = details.filter(d => (d.componentName || 'Unknown component') === name);
                    const ck = `${tk}:component:${name}`;
                    const componentY = cursorY;
                    const allLines = componentRows.flatMap(evidenceLines).slice(0, 16);
                    const source = String(r.sourceType || '');
                    const componentSub = source.toLowerCase().includes('flow') ? `${componentRows.length} evidence record${componentRows.length===1?'':'s'} · Flow element evidence` : `${componentRows.reduce((n,d)=>n+(Number(d.occurrenceCount)||1),0)} usages`;
                    add(ck, name, componentSub, X.component, componentY, 'component', { source:r.sourceType });
                    connect(tk, ck);
                    allLines.forEach((line,j) => {
                        const dk = `${ck}:detail:${j}`;
                        const isUsage = /^Line\s+/i.test(line) || /^Flow\s*·/i.test(line) || /\$Record\./i.test(line);
                        const label = line.length > 118 ? `${line.slice(0,115)}…` : line;
                        const sub = isUsage ? 'FIELD USED HERE' : (source.toLowerCase().includes('flow') ? 'FLOW ELEMENT / METADATA LOCATION' : 'USAGE CONTEXT');
                        add(dk, label, sub, X.detail, componentY + j * 92, isUsage ? 'usage' : 'evidence', { source:r.sourceType });
                        connect(ck, dk);
                    });
                    cursorY += Math.max(112, allLines.length * 92 + 18);
                });
                cursorY += 18;
            });
        }
        const fieldBottom = Math.max(fieldTop + 68, cursorY - 18);
        const fieldCentre = Math.round((fieldTop + fieldBottom) / 2);
        const fieldNode = nodes.find(n => n.key === fk);
        if (fieldNode) { fieldNode.y = fieldCentre - 34; fieldNode.style = `left:${fieldNode.x}px;top:${fieldNode.y}px;`; }
        fieldCentres.push(fieldCentre);
        cursorY += 30;
    });

    const objectCentre = fieldCentres.length ? fieldCentres.reduce((a,b)=>a+b,0)/fieldCentres.length : 76;
    add('object', objectApiName || 'Object', 'Selected object', X.object, Math.max(42,objectCentre-34), 'object');
    (selectedFields || []).forEach(field => connect('object', `f:${field}`));

    const maxX = nodes.reduce((m,n)=>Math.max(m,n.x+(n.kind==='usage'?280:n.kind==='component'?250:210)),1320);
    const maxY = nodes.reduce((m,n)=>Math.max(m,n.y+100),650);
    return { nodes, edges, width: maxX + 70, height: maxY + 70 };
}
