/**
 * Pure parsing/layout logic for the ER Diagram DSL.
 *
 * DSL:
 *   entity Account : Name, Industry, Phone     declare entity + plain fields
 *   Contact.AccountId => Account               Master-Detail (thick purple line, filled diamond)
 *   Contact.OwnerId -> User                    Lookup        (thin blue line, open arrow)
 *   Task.WhoId ~> Contact                      Polymorphic   (dashed red line, open diamond)
 *   # comment                                  ignored
 *
 * Parser notes:
 *   - Entity names are matched case-insensitively so "Account" and "account"
 *     referenced on different lines resolve to the same box instead of
 *     silently creating a duplicate. The first-seen casing is what's shown.
 *   - A field can point at more than one parent (e.g. a single polymorphic
 *     lookup declared with two separate relationship lines to two different
 *     targets) — the field's row label lists every target.
 *   - Exact duplicate relationship lines are ignored rather than drawing an
 *     identical connector twice.
 *   - A relationship from an entity to itself (e.g. Account.ParentId -> Account)
 *     is drawn as a small loop instead of collapsing to a zero-length line.
 *   - Multiple relationships between the same two entities are fanned out
 *     so their lines and labels don't sit exactly on top of each other.
 *
 * @author Vikas Cohen
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export const ER_SAMPLE = `entity Account : Name, Industry, Phone, Website, Type
entity Contact : LastName, FirstName, Email, Phone, Title

Contact.AccountId => Account
Contact.OwnerId -> User`;

export const BOX_WIDTH = 240;
export const HEADER_HEIGHT = 36;
export const ROW_HEIGHT = 22;
const GRID_GAP_X = 340;
const GRID_GAP_Y = 260;
const GRID_MARGIN = 60;
const LANE_GAP = 22;
const SELF_LOOP_BASE = 54;
const SELF_LOOP_STEP = 26;

export function parseEr(text) {
    const entities = new Map();      // keyed by lowercase name; preserves first-seen casing
    const relationships = [];
    const relSeen = new Set();       // dedupe exact-duplicate relationship lines

    const ensureEntity = (name) => {
        const key = name.toLowerCase();
        if (!entities.has(key)) {
            entities.set(key, { name, fields: [] });
        }
        return entities.get(key);
    };

    const ensureField = (entityName, fieldName) => {
        const ent = ensureEntity(entityName);
        let f = ent.fields.find((x) => x.name.toLowerCase() === fieldName.toLowerCase());
        if (!f) {
            f = { name: fieldName, isRelationship: false, relatesTo: [] };
            ent.fields.push(f);
        }
        return f;
    };

    const lines = (text || '').split('\n');
    lines.forEach((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) return;

        const entityMatch = line.match(/^entity\s+(\w+)\s*(:\s*(.*))?$/i);
        if (entityMatch) {
            const ent = ensureEntity(entityMatch[1]);
            const fieldList = (entityMatch[3] || '')
                .split(',')
                .map((f) => f.trim())
                .filter((f) => f && f.toLowerCase() !== 'id'); // "Id" is implicit — skip if redundantly listed
            fieldList.forEach((fname) => ensureField(ent.name, fname));
            return;
        }

        const relMatch = line.match(/^(\w+)\.(\w+)\s*(=>|~>|->)\s*(\w+)\s*$/);
        if (relMatch) {
            const [, childEntity, childField, arrow, parentEntityRaw] = relMatch;
            const parentEnt = ensureEntity(parentEntityRaw);
            const childEnt  = ensureEntity(childEntity);
            const field     = ensureField(childEnt.name, childField);
            const kind = arrow === '=>' ? 'master' : arrow === '~>' ? 'poly' : 'lookup';

            const dedupeKey = [childEnt.name.toLowerCase(), field.name.toLowerCase(), parentEnt.name.toLowerCase(), kind].join('|');
            if (relSeen.has(dedupeKey)) return; // exact duplicate line — skip silently
            relSeen.add(dedupeKey);

            field.isRelationship = true;
            field.kind = kind;
            if (!field.relatesTo.includes(parentEnt.name)) field.relatesTo.push(parentEnt.name);
            relationships.push({ childEntity: childEnt.name, childField: field.name, parentEntity: parentEnt.name, kind });
            return;
        }

        throw new Error(`Line ${idx + 1} not understood: "${line}". Try: entity Account : Name  or  Contact.AccountId => Account`);
    });

    if (entities.size === 0) {
        throw new Error('No entities found. Start with: entity Account : Name, Industry');
    }

    return { entities: Array.from(entities.values()), relationships };
}

function fieldLabel(f) {
    if (!f.isRelationship) return f.name;
    const tag = f.kind === 'master' ? 'Master-Detail' : f.kind === 'poly' ? 'Polymorphic' : 'Lookup';
    const targets = f.relatesTo && f.relatesTo.length ? f.relatesTo.join(' / ') : '?';
    return `${f.name}  → ${targets} (${tag})`;
}

function isCustom(name) {
    return /__c$/i.test(name);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * 3-segment orthogonal elbow connector — exits from the nearest horizontal
 * edge of the child, travels to the nearest edge of the parent. When more
 * than one relationship connects the same two boxes, laneIndex/laneCount
 * spread the exit/entry points along the shared edge so lines fan out
 * instead of overlapping.
 */
function elbowPath(childBox, parentBox, laneIndex, laneCount) {
    const idx = laneIndex || 0;
    const count = laneCount || 1;
    const spread = (idx - (count - 1) / 2) * LANE_GAP;

    const aCx = childBox.x + childBox.width / 2;
    const aCy = childBox.y + childBox.height / 2;
    const bCx = parentBox.x + parentBox.width / 2;
    const bCy = parentBox.y + parentBox.height / 2;
    const dx = bCx - aCx;
    const dy = bCy - aCy;

    if (Math.abs(dx) >= Math.abs(dy)) {
        const aEdgeX = dx >= 0 ? childBox.x + childBox.width : childBox.x;
        const bEdgeX = dx >= 0 ? parentBox.x : parentBox.x + parentBox.width;
        const aY = clamp(bCy + spread, childBox.y + 14, childBox.y + childBox.height - 14);
        const bY = clamp(aCy + spread, parentBox.y + 14, parentBox.y + parentBox.height - 14);
        const midX = (aEdgeX + bEdgeX) / 2;
        return {
            d: `M ${aEdgeX} ${aY} L ${midX} ${aY} L ${midX} ${bY} L ${bEdgeX} ${bY}`,
            midX, midY: (aY + bY) / 2,
            cardStartX: aEdgeX + (dx >= 0 ? 18 : -18),
            cardStartY: aY - 10,
            cardEndX: bEdgeX + (dx >= 0 ? -18 : 18),
            cardEndY: bY - 10
        };
    }

    const aEdgeY = dy >= 0 ? childBox.y + childBox.height : childBox.y;
    const bEdgeY = dy >= 0 ? parentBox.y : parentBox.y + parentBox.height;
    const aX = clamp(bCx + spread, childBox.x + 14, childBox.x + childBox.width - 14);
    const bX = clamp(aCx + spread, parentBox.x + 14, parentBox.x + parentBox.width - 14);
    const midY = (aEdgeY + bEdgeY) / 2;
    return {
        d: `M ${aX} ${aEdgeY} L ${aX} ${midY} L ${bX} ${midY} L ${bX} ${bEdgeY}`,
        midX: (aX + bX) / 2, midY,
        cardStartX: aX + 10,
        cardStartY: aEdgeY + (dy >= 0 ? 16 : -14),
        cardEndX: bX + 10,
        cardEndY: bEdgeY + (dy >= 0 ? -14 : 16)
    };
}

/**
 * Self-relationship loop — exits and re-enters the right edge of the same
 * box. Multiple self-relationships on one entity get progressively larger
 * loops (laneIndex) so they don't stack on top of each other.
 */
function selfLoopPath(box, laneIndex) {
    const idx = laneIndex || 0;
    const loopSize = SELF_LOOP_BASE + idx * SELF_LOOP_STEP;
    const startX = box.x + box.width;
    const startY = box.y + 46 + idx * 28;
    const endY   = startY + 30;
    const ctrlX  = startX + loopSize;
    return {
        d: `M ${startX} ${startY} C ${ctrlX} ${startY} ${ctrlX} ${endY} ${startX} ${endY}`,
        midX: startX + loopSize - 6,
        midY: (startY + endY) / 2,
        cardStartX: startX + 14,
        cardStartY: startY - 6,
        cardEndX: startX + 14,
        cardEndY: endY + 12
    };
}

export function buildErGeometry(model, existingPositions, boxHeightOverrides, boxWidthOverrides) {
    const positions = existingPositions || {};
    const heights = boxHeightOverrides || {};
    const widths = boxWidthOverrides || {};
    const cols = Math.max(1, Math.ceil(Math.sqrt(model.entities.length)));

    const boxes = model.entities.map((ent, i) => {
        const naturalRowCount = ent.fields.length + 1; // +1 for Id
        const naturalBodyHeight = naturalRowCount * ROW_HEIGHT + 12;
        const naturalHeight = HEADER_HEIGHT + naturalBodyHeight;

        const saved = positions[ent.name];
        const gridX = GRID_MARGIN + (i % cols) * GRID_GAP_X;
        const gridY = GRID_MARGIN + Math.floor(i / cols) * GRID_GAP_Y;
        const custom = isCustom(ent.name);

        const height = heights[ent.name] != null ? Math.max(heights[ent.name], HEADER_HEIGHT) : naturalHeight;
        const width  = widths[ent.name]  != null ? Math.max(widths[ent.name],  80)             : BOX_WIDTH;
        const visibleRows = Math.floor((height - HEADER_HEIGHT - 12) / ROW_HEIGHT);

        const allFieldRows = [
            { key: ent.name + '-id', text: 'Id', isPrimaryKey: true, isRelationship: false, isPlain: false }
        ].concat(ent.fields.map((f, fi) => ({
            key: ent.name + '-' + fi,
            text: fieldLabel(f),
            isPrimaryKey: false,
            isRelationship: f.isRelationship,
            isPlain: !f.isRelationship
        })));

        const baseY = saved ? saved.y : gridY;
        const fields = allFieldRows.slice(0, Math.max(1, visibleRows)).map((fld, idx) => ({
            ...fld,
            rowY: baseY + HEADER_HEIGHT + 16 + idx * ROW_HEIGHT
        }));

        const hiddenCount = allFieldRows.length - fields.length;

        return {
            name: ent.name,
            x: saved ? saved.x : gridX,
            y: saved ? saved.y : gridY,
            width,
            height,
            naturalHeight,
            isCustom: custom,
            headerFill: custom ? '#5c2d91' : '#0070d2',
            fields,
            hiddenCount,
            totalFields: allFieldRows.length
        };
    });

    const boxByName = {};
    boxes.forEach((b) => { boxByName[b.name] = b; });

    // Group relationships so ones sharing the same pair of boxes (or the
    // same entity, for self-relationships) can be fanned out visually.
    const pairGroups = {};
    const selfGroups = {};
    model.relationships.forEach((r) => {
        if (r.childEntity === r.parentEntity) {
            (selfGroups[r.childEntity] = selfGroups[r.childEntity] || []).push(r);
        } else {
            const key = [r.childEntity, r.parentEntity].sort().join('|');
            (pairGroups[key] = pairGroups[key] || []).push(r);
        }
    });
    const laneOf = new Map();
    Object.values(pairGroups).forEach((group) => {
        group.forEach((r, i) => laneOf.set(r, { index: i, count: group.length }));
    });
    const selfLaneOf = new Map();
    Object.values(selfGroups).forEach((group) => {
        group.forEach((r, i) => selfLaneOf.set(r, { index: i, count: group.length }));
    });

    const connectors = model.relationships.map((r, i) => {
        const childBox = boxByName[r.childEntity];
        const parentBox = boxByName[r.parentEntity];
        if (!childBox || !parentBox) return null;

        const isMaster = r.kind === 'master';
        const isPoly = r.kind === 'poly';
        const stroke = isMaster ? '#5c2d91' : isPoly ? '#ea4335' : '#0070d2';

        let route;
        if (r.childEntity === r.parentEntity) {
            const lane = selfLaneOf.get(r) || { index: 0, count: 1 };
            route = selfLoopPath(childBox, lane.index);
        } else {
            const lane = laneOf.get(r) || { index: 0, count: 1 };
            route = elbowPath(childBox, parentBox, lane.index, lane.count);
        }

        return {
            key: 'rel-' + i,
            d: route.d,
            midX: route.midX,
            midY: route.midY - 8,
            label: `${r.childField}`,
            stroke,
            strokeWidth: isMaster ? 2.5 : 1.75,
            dashArray: isPoly ? '5,3' : '0',
            markerEnd: isMaster ? 'url(#er-diamond)' : isPoly ? 'url(#er-diamond-open)' : 'url(#er-arrow)',
            cardStartX: route.cardStartX,
            cardStartY: route.cardStartY,
            cardStartText: 'N',
            cardEndX: route.cardEndX,
            cardEndY: route.cardEndY,
            cardEndText: isPoly ? '?' : '1'
        };
    }).filter(Boolean);

    let maxX = boxes.reduce((m, b) => Math.max(m, b.x + b.width), 600);
    let maxY = boxes.reduce((m, b) => Math.max(m, b.y + b.height), 400);
    // Self-loops (and, occasionally, fanned-out lanes) can extend past the
    // box edges they're attached to — make sure the canvas is big enough
    // that they never get clipped.
    connectors.forEach((c) => {
        maxX = Math.max(maxX, c.midX + 40, c.cardStartX + 20, c.cardEndX + 20);
        maxY = Math.max(maxY, c.midY + 40, c.cardStartY + 20, c.cardEndY + 20);
    });

    return {
        boxes,
        connectors,
        svgWidth: maxX + GRID_MARGIN,
        svgHeight: maxY + GRID_MARGIN
    };
}

/**
 * Builds a small "Relationships" legend as a detached <g> element, ready to
 * append to any ER SVG (a clone of the live canvas, or the read-only viewer)
 * right before rasterizing to PNG, so the legend key always travels with
 * the exported image instead of only existing as an on-screen HTML overlay.
 */
export function buildLegendGroup(svgWidth, svgHeight) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-role', 'export-legend');

    const boxW = 172;
    const boxH = 94;
    const boxX = Math.max(8, svgWidth - boxW - 16);
    const boxY = Math.max(8, svgHeight - boxH - 16);

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', boxX);
    bg.setAttribute('y', boxY);
    bg.setAttribute('width', boxW);
    bg.setAttribute('height', boxH);
    bg.setAttribute('rx', 8);
    bg.setAttribute('fill', 'rgba(255,255,255,0.96)');
    bg.setAttribute('stroke', '#d0d5dd');
    bg.setAttribute('stroke-width', '1');
    g.appendChild(bg);

    const title = document.createElementNS(SVG_NS, 'text');
    title.setAttribute('x', boxX + 12);
    title.setAttribute('y', boxY + 18);
    title.setAttribute('font-size', '10');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#667085');
    title.textContent = 'RELATIONSHIPS';
    g.appendChild(title);

    const rows = [
        { label: 'Master-Detail', stroke: '#5c2d91', dash: null,  filled: true },
        { label: 'Lookup',        stroke: '#0070d2', dash: null,  filled: false },
        { label: 'Polymorphic',   stroke: '#ea4335', dash: '4,2', filled: false }
    ];
    rows.forEach((r, i) => {
        const rowY = boxY + 36 + i * 20;

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', boxX + 12);
        line.setAttribute('y1', rowY);
        line.setAttribute('x2', boxX + 44);
        line.setAttribute('y2', rowY);
        line.setAttribute('stroke', r.stroke);
        line.setAttribute('stroke-width', r.filled ? '2.5' : '1.75');
        if (r.dash) line.setAttribute('stroke-dasharray', r.dash);
        g.appendChild(line);

        const marker = document.createElementNS(SVG_NS, 'polygon');
        marker.setAttribute('points', `${boxX + 40},${rowY - 4} ${boxX + 52},${rowY} ${boxX + 40},${rowY + 4}`);
        marker.setAttribute('fill', r.filled ? r.stroke : 'none');
        marker.setAttribute('stroke', r.stroke);
        g.appendChild(marker);

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', boxX + 60);
        text.setAttribute('y', rowY + 4);
        text.setAttribute('font-size', '11');
        text.setAttribute('fill', '#344054');
        text.textContent = r.label;
        g.appendChild(text);
    });

    return g;
}
