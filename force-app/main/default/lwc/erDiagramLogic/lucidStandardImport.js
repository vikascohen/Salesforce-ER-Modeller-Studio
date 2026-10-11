/**
 * Lucid Standard Import v1 document and single-file ZIP (.lucid) encoder.
 * https://developer.lucid.co/docs/overview-si
 * No third-party scripts, network access or Lucid credentials required.
 * @author Vikas Cohen
 */

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export function buildLucidDocument(model, boxes, title = 'ER Diagram') {
    if (!model || !Array.isArray(model.entities) || !model.entities.length) throw new Error('No ER entities to export.');
    const positions = new Map((boxes || []).map((box) => [box.name.toLowerCase(), box]));
    const ids = new Map();
    const shapes = model.entities.map((entity, index) => {
        const id = `entity_${index}`;
        ids.set(entity.name.toLowerCase(), id);
        const box = positions.get(entity.name.toLowerCase());
        if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
            throw new Error(`No valid canvas position for ${entity.name}.`);
        }
        const fields = entity.fields.map((field) => {
            const type = field.dataType ? ` (${field.dataType})` : '';
            const required = field.isRequired ? ' *' : '';
            return `${field.name}${type}${required}`;
        });
        return {
            id, type: 'rectangle',
            boundingBox: { x: box.x, y: box.y, w: box.width, h: box.height },
            style: { fill: { type: 'color', color: '#ffffff' }, stroke: { color: '#325e8b', width: 2, style: 'solid' } },
            text: `${entity.name}\nId (PK)${fields.length ? `\n${fields.join('\n')}` : ''}`,
            customData: [{ key: 'SalesforceObject', value: entity.name }]
        };
    });
    const lines = (model.relationships || []).map((relationship, index) => {
        const source = ids.get(relationship.childEntity.toLowerCase());
        const target = ids.get(relationship.parentEntity.toLowerCase());
        if (!source || !target) throw new Error('A relationship references an unknown entity.');
        const master = relationship.kind === 'master';
        const poly = relationship.kind === 'poly';
        return {
            id: `relationship_${index}`, lineType: 'elbow',
            endpoint1: { type: 'shapeEndpoint', style: 'none', shapeId: source },
            endpoint2: { type: 'shapeEndpoint', style: master ? 'aggregation' : 'openArrow', shapeId: target },
            stroke: { color: master ? '#5c2d91' : poly ? '#ea4335' : '#0070d2', width: master ? 2.5 : 1.5, style: poly ? 'dashed' : 'solid' },
            text: [{ text: relationship.childField, position: 0.5, side: 'top' }],
            customData: [{ key: 'SalesforceRelationshipType', value: relationship.kind }]
        };
    });
    return { version: 1, pages: [{ id: 'er_page', title: String(title).slice(0, 200), shapes, lines }], documentSettings: { units: 'px' } };
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// ZIP STORE format, one UTF-8 document.json entry. ZIP is deliberately uncompressed:
// predictable memory use, no remote library, no runtime dependency and valid .lucid archive.
export function buildLucidArchive(document) {
    const json = new TextEncoder().encode(JSON.stringify(document));
    if (json.length > MAX_JSON_BYTES) throw new Error('Lucid document.json exceeds the 2 MB Standard Import limit.');
    const filename = new TextEncoder().encode('document.json');
    const total = 30 + filename.length + json.length + 46 + filename.length + 22;
    if (total > MAX_ZIP_BYTES) throw new Error('Lucid archive exceeds the 50 MB import limit.');
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);
    let offset = 0;
    const u16 = (value) => { view.setUint16(offset, value, true); offset += 2; };
    const u32 = (value) => { view.setUint32(offset, value, true); offset += 4; };
    const put = (data) => { bytes.set(data, offset); offset += data.length; };
    const checksum = crc32(json);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(0); u16(0);
    u32(checksum); u32(json.length); u32(json.length); u16(filename.length); u16(0);
    put(filename); put(json);
    const centralOffset = offset;
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(0);
    u32(checksum); u32(json.length); u32(json.length); u16(filename.length); u16(0);
    u16(0); u16(0); u16(0); u32(0); u32(0); put(filename);
    const centralSize = offset - centralOffset;
    u32(0x06054b50); u16(0); u16(0); u16(1); u16(1); u32(centralSize); u32(centralOffset); u16(0);
    return bytes;
}
