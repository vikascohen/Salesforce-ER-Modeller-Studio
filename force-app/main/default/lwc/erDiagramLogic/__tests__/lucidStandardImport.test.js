import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
import { parseEr, buildErGeometry, buildLucidDocument, buildLucidArchive } from 'c/erDiagramLogic';

describe('Lucid Standard Import export', () => {
    const model = parseEr('entity Account : Name[Text]\nentity Contact : LastName[Required]\nContact.AccountId => Account');
    const geometry = buildErGeometry(model);

    it('exports editable object shapes and attached relationship lines with unique ids', () => {
        const doc = buildLucidDocument(model, geometry.boxes, 'Salesforce ER');
        expect(doc.version).toBe(1);
        expect(doc.pages).toHaveLength(1);
        expect(doc.pages[0].shapes).toHaveLength(2);
        expect(doc.pages[0].lines).toHaveLength(1);
        expect(doc.pages[0].shapes[0].text).toContain('Name (Text)');
        expect(doc.pages[0].lines[0].endpoint1.type).toBe('shapeEndpoint');
        expect(doc.pages[0].lines[0].endpoint2.shapeId).toBe('entity_0');
        expect(doc.pages[0].shapes[0].boundingBox.w).toBeGreaterThan(0);
    });

    it('produces a ZIP archive containing the Lucid document.json payload', () => {
        const doc = buildLucidDocument(model, geometry.boxes);
        const zip = buildLucidArchive(doc);
        const view = new DataView(zip.buffer);
        expect(view.getUint32(0, true)).toBe(0x04034b50);
        const nameLength = view.getUint16(26, true);
        const decoder = new TextDecoder();
        expect(decoder.decode(zip.slice(30, 30 + nameLength))).toBe('document.json');
        const size = view.getUint32(18, true);
        const payload = JSON.parse(decoder.decode(zip.slice(30 + nameLength, 30 + nameLength + size)));
        expect(payload.pages[0].lines).toHaveLength(1);
        expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    });

    it('rejects missing canvas geometry rather than silently losing layout', () => {
        expect(() => buildLucidDocument(model, [])).toThrow('No valid canvas position');
    });
});
