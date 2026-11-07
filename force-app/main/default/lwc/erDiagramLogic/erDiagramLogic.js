import { compileModuleSource } from 'c/dslModules';
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

export function splitFieldList(raw) {
    // A plain split(',') doesn't know the difference between a comma that
    // separates two different fields and a comma inside one field's own
    // brackets separating two markers -- e.g. "AnnualRevenue[Currency,
    // Required]" must stay one piece, not split into
    // "AnnualRevenue[Currency" and " Required]" (a broken bracket plus a
    // stray fragment). Splits only on commas outside any [...] bracket.
    const parts = [];
    let current = '';
    let depth = 0;
    for (const ch of raw) {
        if (ch === '[') depth++;
        else if (ch === ']') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) parts.push(current);
    return parts;
}

export function parseEr(text, options = {}) {
    const compiled=compileModuleSource(text,options);
    try { return parseErCore(compiled.modular ? compiled.source : text,compiled.modular); }
    catch(error){const match=error.message.match(/Line (\d+)/);if(compiled.modular&&match){const origin=compiled.origins[Number(match[1])-1];if(origin)throw new Error(`${origin.file}:${origin.line}: ${error.message}`);}throw error;}
}
function parseErCore(text, allowEmpty = false) {
    const entities = new Map();      // keyed by lowercase name; preserves first-seen casing
    const components = new Map();
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
            f = { name: fieldName, isRelationship: false, relatesTo: [], isRollupSummary: false, isRequired: false, dataType: null };
            ent.fields.push(f);
        }
        return f;
    };

    const lines = (text || '').split('\n');
    lines.forEach((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) return;

        const componentMatch = line.match(/^component\s+(ApexClass|Flow|PermissionSet|PermissionSetLicense|UserLicense|PackageLicense)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+label\s+("(?:[^"\\]|\\.)*"))?$/i);
        if (componentMatch) {
            const type = ['ApexClass','Flow','PermissionSet','PermissionSetLicense','UserLicense','PackageLicense'].find(value=>value.toLowerCase()===componentMatch[1].toLowerCase());
            let title=componentMatch[2];
            try{if(componentMatch[3])title=JSON.parse(componentMatch[3]);}catch(_){throw new Error(`Line ${idx+1}: Card label must be a valid JSON string.`);}
            if(!title.trim())title=componentMatch[2]; // Empty label snippets remain valid while the user types.
            const name = `@${type}:${componentMatch[2]}`;
            if(allowEmpty&&components.has(name.toLowerCase())&&components.get(name.toLowerCase()).title!==title)throw new Error(`Line ${idx+1}: Conflicting labels for component ${type} ${componentMatch[2]}.`);
            components.set(name.toLowerCase(), {name, title, componentType:type, fields:[]});
            return;
        }
        const entityMatch = line.match(/^entity\s+(\w+)\s*(:\s*(.*))?$/i);
        if (entityMatch) {
            const ent = ensureEntity(entityMatch[1]);
            // A field can carry an optional bracket suffix with one or more
            // comma-separated markers: "rollup" marks a Roll-Up Summary
            // field, "required" marks it required — e.g.
            // "LastName[Required]", "TotalAmount[Currency, Required]".
            // Anything that isn't one of those two reserved keywords is
            // taken as a display-only data type label instead (the type
            // itself can contain spaces/parens freely — only the comma
            // separating it from "required"/"rollup" and the outermost
            // brackets matter). Every marker is entirely optional and can
            // be combined freely, so DSL written or saved before this
            // existed still parses exactly as it always did.
            const fieldList = splitFieldList(entityMatch[3] || '')
                .map((f) => f.trim())
                .filter((f) => f)
                .map((f) => {
                    const bracketMatch = f.match(/^(.+?)\s*\[\s*(.+?)\s*\]$/);
                    if (!bracketMatch) return { name: f, isRollupSummary: false, isRequired: false, dataType: null };
                    const name = bracketMatch[1].trim();
                    let isRollupSummary = false;
                    let isRequired = false;
                    const dataTypeParts = [];
                    bracketMatch[2].split(',').map((p) => p.trim()).filter(Boolean).forEach((part) => {
                        const lower = part.toLowerCase();
                        if (lower === 'rollup') isRollupSummary = true;
                        else if (lower === 'required') isRequired = true;
                        else dataTypeParts.push(part);
                    });
                    return { name, isRollupSummary, isRequired, dataType: dataTypeParts.length ? dataTypeParts.join(', ') : null };
                })
                .filter(({ name }) => name && name.toLowerCase() !== 'id'); // "Id" is implicit — skip if redundantly listed
            fieldList.forEach(({ name, isRollupSummary, isRequired, dataType }) => {
                const field = ensureField(ent.name, name);
                if (isRollupSummary) field.isRollupSummary = true;
                if (isRequired) field.isRequired = true;
                if (allowEmpty && dataType && field.dataType && dataType.toLowerCase() !== field.dataType.toLowerCase()) throw new Error(`Line ${idx+1}: Conflicting data type for ${ent.name}.${name}.`);
                if (dataType) field.dataType = dataType;
            });
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

            if (allowEmpty && field.isRelationship && (field.kind !== kind || (kind !== 'poly' && !field.relatesTo.includes(parentEnt.name)))) throw new Error(`Line ${idx+1}: Conflicting relationship for ${childEnt.name}.${field.name}.`);
            field.isRelationship = true;
            field.kind = kind;
            if (!field.relatesTo.includes(parentEnt.name)) field.relatesTo.push(parentEnt.name);
            relationships.push({ childEntity: childEnt.name, childField: field.name, parentEntity: parentEnt.name, kind });
            return;
        }

        throw new Error(`Line ${idx + 1} not understood: "${line}". Try: entity Account : Name  or  Contact.AccountId => Account`);
    });

    if (entities.size === 0 && components.size === 0 && !allowEmpty) {
        throw new Error('No entities found. Start with: entity Account : Name, Industry');
    }

    return { entities: Array.from(entities.values()), relationships, ...(components.size ? {components:[...components.values()]} : {}) };
}

function kindLabel(kind) {
    return kind === 'master' ? 'Master-Detail' : kind === 'poly' ? 'Polymorphic Lookup' : 'Lookup';
}

function fieldLabel(f) {
    if (!f.isRelationship) return f.name;
    const targets = f.relatesTo && f.relatesTo.length ? f.relatesTo.join(' / ') : '?';
    return `${f.name}  → ${targets} (${kindLabel(f.kind)})`;
}

function isCustom(name) {
    return /__(c|e|mdt)$/i.test(name);
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

    // Keep target markers clear of the card border/shadow. Cardinality
    // badges sit beside the route, never over the arrow or its final segment.
    const sourceGap = 4, targetGap = 12, badgeAlong = 28, badgeSide = 19;
    if (Math.abs(dx) >= Math.abs(dy)) {
        const direction = dx >= 0 ? 1 : -1;
        const aEdgeX = direction > 0 ? childBox.x + childBox.width : childBox.x;
        const bEdgeX = direction > 0 ? parentBox.x : parentBox.x + parentBox.width;
        const low = Math.max(childBox.y + HEADER_HEIGHT + 10, parentBox.y + HEADER_HEIGHT + 10);
        const high = Math.min(childBox.y + childBox.height - 14, parentBox.y + parentBox.height - 14);
        const sharedY = low <= high ? clamp((aCy + bCy) / 2 + spread, low, high) : null;
        const aY = sharedY == null ? clamp(aCy + spread, childBox.y + HEADER_HEIGHT + 10, childBox.y + childBox.height - 14) : sharedY;
        const bY = sharedY == null ? clamp(bCy + spread, parentBox.y + HEADER_HEIGHT + 10, parentBox.y + parentBox.height - 14) : sharedY;
        const startX = aEdgeX + direction * sourceGap;
        const endX = bEdgeX - direction * targetGap;
        const midX = (startX + endX) / 2;
        return {
            d: aY === bY ? `M ${startX} ${aY} L ${endX} ${bY}` : `M ${startX} ${aY} L ${midX} ${aY} L ${midX} ${bY} L ${endX} ${bY}`,
            midX, midY: (aY + bY) / 2, orientation: aY === bY ? 'horizontal' : 'elbow',
            cardStartX: aEdgeX + direction * badgeAlong, cardStartY: aY - badgeSide,
            cardEndX: bEdgeX - direction * badgeAlong, cardEndY: bY - badgeSide
        };
    }

    const direction = dy >= 0 ? 1 : -1;
    const aEdgeY = direction > 0 ? childBox.y + childBox.height : childBox.y;
    const bEdgeY = direction > 0 ? parentBox.y : parentBox.y + parentBox.height;
    const low = Math.max(childBox.x + 18, parentBox.x + 18);
    const high = Math.min(childBox.x + childBox.width - 18, parentBox.x + parentBox.width - 18);
    const sharedX = low <= high ? clamp((aCx + bCx) / 2 + spread, low, high) : null;
    const aX = sharedX == null ? clamp(aCx + spread, childBox.x + 18, childBox.x + childBox.width - 18) : sharedX;
    const bX = sharedX == null ? clamp(bCx + spread, parentBox.x + 18, parentBox.x + parentBox.width - 18) : sharedX;
    const startY = aEdgeY + direction * sourceGap;
    const endY = bEdgeY - direction * targetGap;
    const midY = (startY + endY) / 2;
    return {
        d: aX === bX ? `M ${aX} ${startY} L ${bX} ${endY}` : `M ${aX} ${startY} L ${aX} ${midY} L ${bX} ${midY} L ${bX} ${endY}`,
        midX: (aX + bX) / 2, midY, orientation: aX === bX ? 'vertical' : 'elbow',
        cardStartX: aX + badgeSide, cardStartY: aEdgeY + direction * badgeAlong,
        cardEndX: bX + badgeSide, cardEndY: bEdgeY - direction * badgeAlong
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
    const endY   = startY + 42;
    const ctrlX  = startX + loopSize;
    return {
        d: `M ${startX} ${startY} C ${ctrlX} ${startY} ${ctrlX} ${endY} ${startX + 12} ${endY}`,
        midX: startX + loopSize - 6,
        midY: (startY + endY) / 2,
        cardStartX: startX + 28,
        cardStartY: startY - 19,
        cardEndX: startX + 28,
        cardEndY: endY + 19
    };
}

export function buildErGeometry(model, existingPositions, boxHeightOverrides, boxWidthOverrides) {
    const positions = existingPositions || {};
    const heights = boxHeightOverrides || {};
    const widths = boxWidthOverrides || {};
    const nodes = [...model.entities, ...(model.components || [])];
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));

    const boxes = nodes.map((ent, i) => {
        const naturalRowCount = ent.componentType ? 1 : ent.fields.length + 1; // +1 for Id
        const naturalBodyHeight = naturalRowCount * ROW_HEIGHT + 12;
        const naturalHeight = HEADER_HEIGHT + naturalBodyHeight;

        const saved = positions[ent.name];
        const gridX = GRID_MARGIN + (i % cols) * GRID_GAP_X;
        const gridY = GRID_MARGIN + Math.floor(i / cols) * GRID_GAP_Y;
        const custom = isCustom(ent.name);

        const height = heights[ent.name] != null ? Math.max(heights[ent.name], HEADER_HEIGHT) : naturalHeight;
        const width  = widths[ent.name]  != null ? Math.max(widths[ent.name],  80)             : BOX_WIDTH;
        const visibleRows = Math.floor((height - HEADER_HEIGHT - 12) / ROW_HEIGHT);

        const allFieldRows = ent.componentType ? [{key:ent.name+'-type',text:({Flow:'Flow',ApexClass:'Apex class',PermissionSet:'Permission set',PermissionSetLicense:'Permission set licence',UserLicense:'User licence',PackageLicense:'Package licence'})[ent.componentType],isPrimaryKey:false,isRelationship:false,isPlain:true}] : [
            { key: ent.name + '-id', text: 'Id', isPrimaryKey: true, isRelationship: false, isPlain: false, isRollupSummary: false, isRequired: false }
        ].concat(ent.fields.map((f, fi) => ({
            key: ent.name + '-' + fi,
            text: fieldLabel(f),
            isPrimaryKey: false,
            isRelationship: f.isRelationship,
            isPlain: !f.isRelationship,
            isRollupSummary: !!f.isRollupSummary,
            isRequired: !!f.isRequired
        })));

        const baseY = saved ? saved.y : gridY;
        const fields = allFieldRows.slice(0, Math.max(1, visibleRows)).map((fld, idx) => ({
            ...fld,
            rowY: baseY + HEADER_HEIGHT + 16 + idx * ROW_HEIGHT
        }));

        const hiddenCount = allFieldRows.length - fields.length;

        return {
            name: ent.name,
            title: ent.title || ent.name,
            componentType: ent.componentType,
            x: saved ? saved.x : gridX,
            y: saved ? saved.y : gridY,
            width,
            height,
            naturalHeight,
            isCustom: custom,
            headerFill: ent.componentType ? '#137c70' : custom ? '#5c2d91' : '#0070d2',
            // A dx offset (relative to the box's own left edge, x) for the
            // red "R" required-field marker, positioned near the box's
            // right edge regardless of the row's other content — keeps it
            // out of the way of the PK/relationship/rollup markers, which
            // all live on the left side of each row.
            reqMarkerDx: Math.max(width - 16, 22),
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
            childEntity: r.childEntity,
            parentEntity: r.parentEntity,
            d: route.d,
            midX: route.orientation === 'vertical' ? route.midX - Math.max(30, r.childField.length * 3 + 12) : route.midX,
            midY: route.orientation === 'horizontal' ? route.midY + 20 : route.midY - 8,
            label: `${r.childField}`,
            title: `${r.childEntity}.${r.childField} → ${r.parentEntity} (${kindLabel(r.kind)}; arrow points to referenced parent)`,
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
 * Renders the parsed model as Mermaid `erDiagram` syntax — the same
 * text you'd paste into a GitHub README, Confluence page, or Notion doc
 * to get a live-rendered ER diagram, no image file needed.
 *
 * Relationship line style follows Mermaid's identifying/non-identifying
 * convention, which maps cleanly onto Salesforce's own distinction:
 * Master-Detail (child cannot exist without the parent) renders as a
 * solid "identifying" line; Lookup and Polymorphic Lookup (looser
 * coupling) render as a dashed "non-identifying" line.
 */

// Mermaid's erDiagram grammar requires the attribute "type" token to be a
// single identifier — no spaces, slashes, or parentheses — so a friendly
// label like "Date/Time" or "Text Area (Long)" has to be collapsed into
// one safe word (DateTime, TextAreaLong) rather than inserted as-is,
// which would otherwise silently break the diagram wherever it's pasted
// (GitHub, the Mermaid Live Editor, etc).
function mermaidSafeType(type) {
    return type.replace(/[^A-Za-z0-9]+/g, '') || 'field';
}

export function buildMermaidErDiagram(model) {
    const lines = ['erDiagram', ...(model.components || []).map(c => `    %% ${c.componentType}: ${c.title} (component card; omitted from ER-only export)` )];

    model.relationships.forEach((r) => {
        const lineStyle = r.kind === 'master' ? '--' : '..';
        const label = `${r.childField} (${kindLabel(r.kind)})`;
        lines.push(`    ${r.parentEntity} ||${lineStyle}o{ ${r.childEntity} : "${label}"`);
    });

    model.entities.forEach((ent) => {
        lines.push(`    ${ent.name} {`);
        lines.push('        id Id PK');
        ent.fields.forEach((f) => {
            if (f.isRelationship) {
                lines.push(`        reference ${f.name} FK`);
            } else if (f.isRollupSummary) {
                lines.push(`        rollupsummary ${f.name}`);
            } else {
                // A real Salesforce data type when one was imported/typed in
                // (e.g. "Currency", "Text Area (Long)"), otherwise Mermaid's
                // own generic "string" — exactly the prior behavior for DSL
                // that never carried type info at all.
                const type = f.dataType ? mermaidSafeType(f.dataType) : 'string';
                lines.push(`        ${type} ${f.name}`);
            }
        });
        lines.push('    }');
    });

    return lines.join('\n');
}

function escapeXml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function drawioEntityLabelHtml(ent) {
    // HTML is XML-escaped at the mxCell boundary. Escape user-authored
    // values here first to avoid HTML injection when draw.io renders them.
    const safe = (value) => escapeXml(value);
    const custom = isCustom(ent.name);
    const header = ent.componentType ? '#137c70' : custom ? '#5c2d91' : '#145a9c';
    const rows = [
        `<div style="background-color:${header};color:#ffffff;padding:10px 12px;font-size:14px;font-weight:bold;">${safe(ent.title || ent.name)}</div>`,
        '<div style="padding:7px 12px;background-color:#eef3f8;border-bottom:1px solid #d6dfe9;color:#44546a;font-size:11px;">Id <b>PK</b></div>'
    ];
    if (ent.componentType) rows.splice(1,1,`<div style="padding:7px 12px;">${({Flow:'Flow',ApexClass:'Apex class',PermissionSet:'Permission set',PermissionSetLicense:'Permission set licence',UserLicense:'User licence',PackageLicense:'Package licence'})[ent.componentType]}</div>`);
    ent.fields.forEach((f, i) => {
        let detail = '';
        if (f.isRelationship) {
            const targets = f.relatesTo && f.relatesTo.length ? f.relatesTo.join(' / ') : '?';
            detail = ` &rarr; ${safe(targets)} <span style="color:#60748b;">(${safe(kindLabel(f.kind))})</span>`;
        } else if (f.isRollupSummary) {
            detail = ' <span style="color:#60748b;">(Roll-Up Summary)</span>';
        } else if (f.dataType) {
            detail = ` <span style="color:#60748b;">(${safe(f.dataType)})</span>`;
        }
        rows.push(`<div style="padding:5px 12px;background-color:${i % 2 ? '#f3f7fb' : '#ffffff'};border-bottom:1px solid #edf0f4;font-size:11px;">${safe(f.name)}${detail}</div>`);
    });
    return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;">${rows.join('')}</div>`;
}

function drawioEdgeStyle(kind) {
    const base = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;loopStyle=loop;html=1;strokeWidth=2;jettySize=auto;labelBackgroundColor=#ffffff;fontSize=10;fontColor=#344054;';
    if (kind === 'master') return base + 'strokeColor=#7752a6;endArrow=diamondThin;endFill=1;';
    if (kind === 'poly') return base + 'strokeColor=#d97736;dashed=1;dashPattern=6 4;endArrow=block;endFill=0;';
    return base + 'strokeColor=#2973b9;dashed=1;dashPattern=6 4;endArrow=block;endFill=0;';
}

/**
 * Renders the parsed model plus its already-computed layout as a draw.io
 * (diagrams.net) file — plain, uncompressed mxGraph XML wrapped in the
 * standard <mxfile> envelope, directly openable via File > Open or by
 * dragging it into app.diagrams.net.
 *
 * Unlike the Mermaid export (which always re-lays-out automatically —
 * Mermaid's erDiagram syntax has no concept of fixed positions), this
 * reuses the exact box positions/sizes this app already computed, so the
 * draw.io version opens up arranged exactly like your canvas, not
 * auto-arranged from scratch.
 *
 * @param model  parseEr() output
 * @param boxes  buildErGeometry(...).boxes — {name, x, y, width, height}[]
 */
export function buildDrawioXml(model, boxes) {
    model = {...model,entities:[...model.entities,...(model.components || [])]};
    const idOf = {};
    model.entities.forEach((ent, i) => { idOf[ent.name] = 'n' + i; });
    const boxByName = {};
    (boxes || []).forEach((b) => { boxByName[b.name] = b; });

    const cells = [];
    let maxX = 0;
    let maxY = 0;
    model.entities.forEach((ent, i) => {
        const box = boxByName[ent.name];
        const x = Math.round(box && Number.isFinite(box.x) ? box.x : 60 + (i % 3) * 340);
        const y = Math.round(box && Number.isFinite(box.y) ? box.y : 60 + Math.floor(i / 3) * 320);
        const w = Math.max(250, Math.round(box && Number.isFinite(box.width) ? box.width : BOX_WIDTH));
        // Header + PK + one row per field; prevent truncation of long objects.
        const minHeight = 78 + ent.fields.length * 25;
        const h = Math.max(minHeight, Math.round(box && Number.isFinite(box.height) ? box.height : minHeight));
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
        const custom = isCustom(ent.name);
        const stroke = custom ? '#7752a6' : '#2973b9';
        const label = escapeXml(drawioEntityLabelHtml(ent));
        cells.push(
            `<mxCell id="${idOf[ent.name]}" value="${label}" style="rounded=1;arcSize=5;whiteSpace=wrap;html=1;overflow=fill;align=left;verticalAlign=top;spacing=0;fillColor=#ffffff;strokeColor=${stroke};strokeWidth=1.5;shadow=1;fontSize=11;" vertex="1" parent="1">` +
            `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" /></mxCell>`
        );
    });

    // Spread parallel connectors across separate attachment points rather
    // than stacking them all on the same centre-to-centre path.
    const groups = new Map();
    model.relationships.forEach((r) => {
        const key = `${r.childEntity}\u0000${r.parentEntity}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    });
    const seen = new Map();
    model.relationships.forEach((r, i) => {
        const key = `${r.childEntity}\u0000${r.parentEntity}`;
        const index = seen.get(key) || 0;
        seen.set(key, index + 1);
        const total = groups.get(key).length;
        const offset = ((index + 1) / (total + 1)).toFixed(3);
        const sourceBox = boxByName[r.childEntity];
        const targetBox = boxByName[r.parentEntity];
        const sourceX = sourceBox ? sourceBox.x : 0;
        const targetX = targetBox ? targetBox.x : 0;
        const toRight = sourceX <= targetX;
        const side = toRight ? 'exitX=1;entryX=0;' : 'exitX=0;entryX=1;';
        const style = drawioEdgeStyle(r.kind) + side + `exitY=${offset};entryY=${offset};exitPerimeter=1;entryPerimeter=1;`;
        cells.push(
            `<mxCell id="rel${i}" value="${escapeXml(r.childField)}" style="${style}" edge="1" parent="1" source="${idOf[r.childEntity]}" target="${idOf[r.parentEntity]}">` +
            '<mxGeometry relative="1" as="geometry" /></mxCell>'
        );
    });

    const pageWidth = Math.max(850, Math.ceil((maxX + 100) / 100) * 100);
    const pageHeight = Math.max(1100, Math.ceil((maxY + 100) / 100) * 100);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<mxfile host="app.diagrams.net">\n' +
        '  <diagram name="ER Diagram" id="er-diagram-1">\n' +
        `    <mxGraphModel dx="${pageWidth}" dy="${pageHeight}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">\n` +
        '      <root>\n' +
        '        <mxCell id="0" />\n' +
        '        <mxCell id="1" parent="0" />\n' +
        '        ' + cells.join('\n        ') + '\n' +
        '      </root>\n' +
        '    </mxGraphModel>\n' +
        '  </diagram>\n' +
        '</mxfile>\n';
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
