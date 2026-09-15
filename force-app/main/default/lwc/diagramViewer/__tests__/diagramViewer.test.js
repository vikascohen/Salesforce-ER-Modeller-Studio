import { createElement } from 'lwc';
import { registerApexTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import getFile from '@salesforce/apex/DiagramFileController.getFile';
import DiagramViewer from 'c/diagramViewer';

jest.mock(
    '@salesforce/apex/DiagramFileController.saveDiagramAsFile',
    () => ({ default: jest.fn() }),
    { virtual: true }
);
// eslint-disable-next-line no-undef
const saveDiagramAsFile = require('@salesforce/apex/DiagramFileController.saveDiagramAsFile').default;

const getFileAdapter = registerApexTestWireAdapter(getFile);

const SAMPLE_RECORD = {
    Id: 'a00xx0000001',
    Name: 'Sales Model',
    Diagram_Type__c: 'ER',
    Source_Code__c: 'entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account'
};

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('c-diagram-viewer', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('shows the "no diagram selected" prompt when diagramId is not set', () => {
        const el = createElement('c-diagram-viewer', { is: DiagramViewer });
        document.body.appendChild(el);

        expect(el.shadowRoot.textContent).toContain('Set "Diagram Id"');
        expect(el.shadowRoot.querySelector('svg[data-role="viewer-svg"]')).toBeNull();
    });

    it('renders the diagram SVG once the wired record arrives', async () => {
        const el = createElement('c-diagram-viewer', { is: DiagramViewer });
        el.diagramId = 'a00xx0000001';
        document.body.appendChild(el);

        getFileAdapter.emit(SAMPLE_RECORD);
        await flushPromises();

        const svg = el.shadowRoot.querySelector('svg[data-role="viewer-svg"]');
        expect(svg).not.toBeNull();
        // Sample DSL has 2 entities (2 box <g>s) + 1 relationship (1 connector <g>) = 3
        expect(el.shadowRoot.querySelectorAll('svg[data-role="viewer-svg"] > g').length).toBe(3);
    });

    it('populates the arrowhead/diamond marker defs exactly once, even across multiple renders', async () => {
        const el = createElement('c-diagram-viewer', { is: DiagramViewer });
        el.diagramId = 'a00xx0000001';
        document.body.appendChild(el);

        getFileAdapter.emit(SAMPLE_RECORD);
        await flushPromises();
        // A second emit forces a second renderedCallback — defs must not duplicate.
        getFileAdapter.emit({ ...SAMPLE_RECORD });
        await flushPromises();

        const markers = el.shadowRoot.querySelectorAll('svg[data-role="viewer-svg"] defs marker');
        expect(markers).toHaveLength(3);
        const ids = Array.from(markers).map((m) => m.id);
        expect(ids).toEqual(expect.arrayContaining(['er-arrow', 'er-diamond', 'er-diamond-open']));
    });

    it('shows the error banner when the wire adapter returns an error instead of data', async () => {
        const el = createElement('c-diagram-viewer', { is: DiagramViewer });
        el.diagramId = 'a00xx0000001';
        document.body.appendChild(el);

        getFileAdapter.error({ body: { message: 'Insufficient access' } });
        await flushPromises();

        const errorBanner = el.shadowRoot.querySelector('[role="alert"]');
        expect(errorBanner).not.toBeNull();
        expect(el.shadowRoot.querySelector('svg[data-role="viewer-svg"]')).toBeNull();
    });

    it('surfaces a DSL parse error for a record with invalid source, without throwing', async () => {
        const el = createElement('c-diagram-viewer', { is: DiagramViewer });
        el.diagramId = 'a00xx0000001';
        document.body.appendChild(el);

        getFileAdapter.emit({ ...SAMPLE_RECORD, Source_Code__c: 'this is not valid DSL at all' });
        await flushPromises();

        const errorBanner = el.shadowRoot.querySelector('[role="alert"]');
        expect(errorBanner).not.toBeNull();
        expect(errorBanner.textContent).toMatch(/not understood/i);
    });

    it('exports and navigates to the saved file on successful export', async () => {
        saveDiagramAsFile.mockResolvedValue('068xx0000000001');

        const el = createElement('c-diagram-viewer', { is: DiagramViewer });
        el.diagramId = 'a00xx0000001';
        document.body.appendChild(el);

        getFileAdapter.emit(SAMPLE_RECORD);
        await flushPromises();

        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            scale: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(), drawImage: jest.fn()
        });
        jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ZmFrZQ==');
        class FakeImage {
            set src(_v) { Promise.resolve().then(() => this.onload && this.onload()); }
        }
        global.Image = FakeImage;

        const exportButton = el.shadowRoot.querySelector('lightning-button');
        expect(exportButton).not.toBeNull();
        exportButton.click();
        await flushPromises();
        await flushPromises();

        expect(saveDiagramAsFile).toHaveBeenCalledWith(
            expect.objectContaining({ diagramFileId: 'a00xx0000001', pageSize: 'PNG' })
        );
    });
});
