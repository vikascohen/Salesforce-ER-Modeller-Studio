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
 * @author Vikas Cohen
 */

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

export function parseEr(text) {
    const entities = new Map();
    const relationships = [];

    const ensureEntity = (name) => {
        if (!entities.has(name)) {
            entities.set(name, { name, fields: [] });
        }
        return entities.get(name);
    };

    const ensureField = (entityName, fieldName) => {
        const ent = ensureEntity(entityName);
        let f = ent.fields.find((x) => x.name === fieldName);
        if (!f) {
            f = { name: fieldName, isRelationship: false };
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
            const fieldList = (entityMatch[3] || '').split(',').map((f) => f.trim()).filter(Boolean);
            fieldList.forEach((fname) => ensureField(ent.name, fname));
            return;
        }

        const relMatch = line.match(/^(\w+)\.(\w+)\s*(=>|~>|->)\s*(\w+)\s*$/);
        if (relMatch) {
            const [, childEntity, childField, arrow, parentEntity] = relMatch;
            ensureEntity(parentEntity);
            const field = ensureField(childEntity, childField);
            const kind = arrow === '=>' ? 'master' : arrow === '~>' ? 'poly' : 'lookup';
            field.isRelationship = true;
            field.relatesTo = parentEntity;
            field.kind = kind;
            relationships.push({ childEntity, childField, parentEntity, kind });
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
    return `${f.name}  → ${f.relatesTo} (${tag})`;
}

function isCustom(name) {
    return /__c$/i.test(name);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * 3-segment orthogonal elbow connector — exits from the nearest horizontal
 * edge of the child, travels to the nearest edge of the parent.
 */
function elbowPath(childBox, parentBox) {
    const aCx = childBox.x + childBox.width / 2;
    const aCy = childBox.y + childBox.height / 2;
    const bCx = parentBox.x + parentBox.width / 2;
    const bCy = parentBox.y + parentBox.height / 2;
    const dx = bCx - aCx;
    const dy = bCy - aCy;

    if (Math.abs(dx) >= Math.abs(dy)) {
        const aEdgeX = dx >= 0 ? childBox.x + childBox.width : childBox.x;
        const bEdgeX = dx >= 0 ? parentBox.x : parentBox.x + parentBox.width;
        const aY = clamp(bCy, childBox.y + 14, childBox.y + childBox.height - 14);
        const bY = clamp(aCy, parentBox.y + 14, parentBox.y + parentBox.height - 14);
        const midX = (aEdgeX + bEdgeX) / 2;
        return {
            d: `M ${aEdgeX} ${aY} L ${midX} ${aY} L ${midX} ${bY} L ${bEdgeX} ${bY}`,
            startX: aEdgeX, startY: aY,
            endX: bEdgeX, endY: bY,
            midX, midY: (aY + bY) / 2,
            cardStartX: aEdgeX + (dx >= 0 ? 18 : -18),
            cardStartY: aY - 10,
            cardEndX: bEdgeX + (dx >= 0 ? -18 : 18),
            cardEndY: bY - 10
        };
    }

    const aEdgeY = dy >= 0 ? childBox.y + childBox.height : childBox.y;
    const bEdgeY = dy >= 0 ? parentBox.y : parentBox.y + parentBox.height;
    const aX = clamp(bCx, childBox.x + 14, childBox.x + childBox.width - 14);
    const bX = clamp(aCx, parentBox.x + 14, parentBox.x + parentBox.width - 14);
    const midY = (aEdgeY + bEdgeY) / 2;
    return {
        d: `M ${aX} ${aEdgeY} L ${aX} ${midY} L ${bX} ${midY} L ${bX} ${bEdgeY}`,
        startX: aX, startY: aEdgeY,
        endX: bX, endY: bEdgeY,
        midX: (aX + bX) / 2, midY,
        cardStartX: aX + 10,
        cardStartY: aEdgeY + (dy >= 0 ? 16 : -14),
        cardEndX: bX + 10,
        cardEndY: bEdgeY + (dy >= 0 ? -14 : 16)
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

    const connectors = model.relationships.map((r, i) => {
        const childBox = boxByName[r.childEntity];
        const parentBox = boxByName[r.parentEntity];
        if (!childBox || !parentBox) return null;

        const isMaster = r.kind === 'master';
        const isPoly = r.kind === 'poly';
        const route = elbowPath(childBox, parentBox);
        const stroke = isMaster ? '#5c2d91' : isPoly ? '#ea4335' : '#0070d2';

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

    const maxX = boxes.reduce((m, b) => Math.max(m, b.x + b.width), 600);
    const maxY = boxes.reduce((m, b) => Math.max(m, b.y + b.height), 400);

    return {
        boxes,
        connectors,
        svgWidth: maxX + GRID_MARGIN,
        svgHeight: maxY + GRID_MARGIN
    };
}
