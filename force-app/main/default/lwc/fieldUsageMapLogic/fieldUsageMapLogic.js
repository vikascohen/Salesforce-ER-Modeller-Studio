const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;

export function clampFieldUsageZoom(value) {
    const rounded = Math.round(Number(value || 1) / ZOOM_STEP) * ZOOM_STEP;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(rounded.toFixed(1))));
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

export function buildFieldUsageMap({ evidence = [], selectedFields = [], objectApiName = '' } = {}) {
    const rows = evidence || [];
    const nodes = [];
    const edges = [];
    const add = (key, label, sub, x, y, kind, extra = {}) => nodes.push({ key, label, sub, x, y, kind, ...extra, style: `left:${x}px;top:${y}px;` });
    const connect = (a, b) => {
        const A = nodes.find(n => n.key === a);
        const B = nodes.find(n => n.key === b);
        if (A && B) edges.push({ key: `${a}>${b}`, x1: A.x + 190, y1: A.y + 34, x2: B.x, y2: B.y + 34 });
    };
    let y = 40;
    const centres = [];
    (selectedFields || []).forEach(field => {
        const summaries = rows.filter(r => !r._detail && !r._pageState && r.fieldApiName === field);
        const fy = y;
        const fk = `f:${field}`;
        add(fk, field, `${summaries.reduce((n, r) => n + (r.occurrences || r.evidenceRows || 0), 0)} usages`, 280, fy, 'field');
        if (!summaries.length) {
            const nk = `${fk}:none`;
            add(nk, 'No dependency detected', 'Current successful snapshot · 0 dependencies', 540, y, 'empty');
            connect(fk, nk);
            y += 90;
        } else summaries.forEach(r => {
            const tk = `${fk}:${r.sourceType}`;
            const details = rows.filter(d => d._detail && d.fieldApiName === field && d.sourceType === r.sourceType);
            const pageState = rows.find(d => d._pageState && d.fieldApiName === field && d.sourceType === r.sourceType);
            add(tk, r.sourceType, `${r.occurrences || r.evidenceRows || 0} usages · ${!details.length ? 'click to expand' : pageState?.hasMore ? 'click to load more' : `${details.length} components loaded`}`, 540, y, 'type', { field, source: r.sourceType, expandable: true });
            connect(fk, tk);
            if (details.length) {
                const names = [...new Set(details.map(d => d.componentName || 'Unknown component'))];
                names.forEach((name, i) => {
                    const ck = `${tk}:component:${i}`;
                    const componentRows = details.filter(d => (d.componentName || 'Unknown component') === name);
                    const cy = y + i * 132;
                    add(ck, name, `${componentRows.reduce((n, d) => n + (Number(d.occurrenceCount) || 1), 0)} usages`, 800, cy, 'component');
                    connect(tk, ck);
                    const detailLines = componentRows.flatMap(d => {
                        const ev = (d.evidence || '').split('\n').map(x => x.trim()).filter(Boolean);
                        return ev.length ? ev : [d.location || d.evidenceType || 'Usage detected'];
                    }).slice(0, 12);
                    detailLines.forEach((line, j) => {
                        const dk = `${ck}:detail:${j}`;
                        const isUsage = line.startsWith('Line ') || line.startsWith('Flow ·');
                        const label = line.length > 96 ? `${line.slice(0, 93)}…` : line;
                        add(dk, label, isUsage ? 'FIELD USED HERE' : (r.sourceType === 'Flow' ? 'Flow metadata location' : 'Usage context'), 1080, cy + j * 82, isUsage ? 'usage' : 'evidence');
                        connect(ck, dk);
                    });
                });
                const detailCount = names.reduce((n, name) => n + Math.max(1, details.filter(d => (d.componentName || 'Unknown component') === name).flatMap(d => (d.evidence || d.location || '').split('\n').filter(Boolean)).length), 0);
                y += Math.max(110, detailCount * 82 + 20);
            } else y += 90;
        });
        centres.push(fy);
        y += 24;
    });
    const oy = centres.length ? centres.reduce((a, b) => a + b, 0) / centres.length : 40;
    add('object', objectApiName || 'Object', 'Selected object', 30, oy, 'object');
    (selectedFields || []).forEach(field => connect('object', `f:${field}`));
    return { nodes, edges, width: 1360, height: Math.max(650, y + 80) };
}
