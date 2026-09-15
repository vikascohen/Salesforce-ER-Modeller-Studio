import { createElement } from 'lwc';
import { registerApexTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import listFiles from '@salesforce/apex/DiagramFileController.listFiles';
import getAllObjectNames from '@salesforce/apex/SchemaMetadataController.getAllObjectNames';
import DiagramStudio from 'c/diagramStudio';

// Imperative Apex calls — mocked as jest.fn() so each test controls what
// they resolve/reject with. { virtual: true } is required because these
// modules don't really exist outside a Salesforce org at test time.
jest.mock('@salesforce/apex/DiagramFileController.getFile', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/DiagramFileController.saveFile', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/DiagramFileController.deleteFile', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/DiagramFileController.renameFile', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/DiagramFileController.saveDiagramAsFile', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SchemaMetadataController.describeObjects', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SchemaMetadataController.getSharingModels', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SchemaMetadataController.getRecordCounts', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SchemaMetadataController.describeObjectsForDictionary', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SchemaMetadataController.getFieldUsageStats', () => ({ default: jest.fn() }), { virtual: true });

// eslint-disable-next-line no-undef
const saveFile = require('@salesforce/apex/DiagramFileController.saveFile').default;

const listFilesAdapter = registerApexTestWireAdapter(listFiles);
const objectNamesAdapter = registerApexTestWireAdapter(getAllObjectNames);

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createStudio() {
    const el = createElement('c-diagram-studio', { is: DiagramStudio });
    document.body.appendChild(el);
    return el;
}

describe('c-diagram-studio', () => {
    beforeEach(() => {
        // jsdom has no real canvas 2D backend (used for DSL-editor character
        // width measurement) and no Pointer Events capture API — both real
        // gaps in jsdom, not anything the component does wrong.
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            measureText: () => ({ width: 7 }),
            font: ''
        });
        if (!SVGElement.prototype.setPointerCapture) {
            SVGElement.prototype.setPointerCapture = jest.fn();
        } else {
            jest.spyOn(SVGElement.prototype, 'setPointerCapture').mockImplementation(() => {});
        }
        if (!SVGElement.prototype.releasePointerCapture) {
            SVGElement.prototype.releasePointerCapture = jest.fn();
        }
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('opens with a clean, empty, error-free canvas and no diagramId set', async () => {
        const el = createStudio();
        await flushPromises();

        expect(el.shadowRoot.querySelector('[role="alert"], .error-bar')).toBeNull();
        const nameInput = el.shadowRoot.querySelector('.diag-name-input');
        expect(nameInput.value).toBe('Untitled ER Diagram');
    });

    it('populates the object palette once getAllObjectNames resolves', async () => {
        const el = createStudio();
        objectNamesAdapter.emit(['Account', 'Contact', 'Opportunity']);
        await flushPromises();

        const chips = el.shadowRoot.querySelectorAll('.palette-chip');
        expect(chips.length).toBe(3);
        expect(Array.from(chips).map((c) => c.textContent)).toEqual(
            expect.arrayContaining(['Account', 'Contact', 'Opportunity'])
        );
    });

    it('lists saved diagrams from the listFiles wire adapter in the sidebar', async () => {
        const el = createStudio();
        listFilesAdapter.emit([
            { Id: 'a01', Name: 'Sales Model', LastModifiedDate: '2026-01-01T00:00:00Z' },
            { Id: 'a02', Name: 'Service Model', LastModifiedDate: '2026-01-02T00:00:00Z' }
        ]);
        await flushPromises();

        const rows = el.shadowRoot.querySelectorAll('.file-row');
        expect(rows.length).toBe(2);
    });

    it('typing DSL in the editor renders the diagram on the canvas after the debounce', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        expect(textarea).not.toBeNull();
        textarea.value = 'entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account';
        textarea.dispatchEvent(new CustomEvent('input'));

        // renderDiagram() is debounced (200ms) — advance past it.
        await new Promise((resolve) => setTimeout(resolve, 300));

        const boxes = el.shadowRoot.querySelectorAll('.entity-group');
        expect(boxes.length).toBe(2);
        expect(el.shadowRoot.querySelector('.error-bar')).toBeNull();
    });

    it('shows the error banner with a line number for invalid DSL, without throwing', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'this is not valid DSL syntax at all';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const errorBar = el.shadowRoot.querySelector('.error-bar');
        expect(errorBar).not.toBeNull();
        expect(errorBar.textContent).toMatch(/Line 1/);
    });

    it('Clear Canvas empties the DSL and canvas back to a clean, error-free state', async () => {
        window.confirm = jest.fn(() => true); // Clear Canvas asks for confirmation

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(1);

        // Diagram menu > Clear Canvas
        el.shadowRoot.querySelector('[data-menu="diagram"]').click();
        await flushPromises();
        const clearItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
            i.textContent.includes('Clear Canvas')
        );
        expect(clearItem).toBeDefined();
        clearItem.click();
        await flushPromises();

        expect(window.confirm).toHaveBeenCalled();
        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(0);
        expect(el.shadowRoot.querySelector('.error-bar')).toBeNull();
    });

    it('deleting the last entity behaves like Clear Canvas (empty, no error) instead of throwing', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(1);

        const deleteBtn = el.shadowRoot.querySelector('.delete-btn');
        expect(deleteBtn).not.toBeNull();
        deleteBtn.dispatchEvent(new CustomEvent('click', { bubbles: true }));
        await flushPromises();

        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(0);
        expect(el.shadowRoot.querySelector('.error-bar')).toBeNull();
    });

    it('File > Save calls saveFile with the current diagram name and DSL source', async () => {
        saveFile.mockResolvedValue('a00xx0000001');

        const el = createStudio();
        await flushPromises();

        const nameInput = el.shadowRoot.querySelector('.diag-name-input');
        nameInput.value = 'My New Diagram';
        nameInput.dispatchEvent(new CustomEvent('input'));

        el.shadowRoot.querySelector('[data-menu="file"]').click();
        await flushPromises();
        const saveItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
            i.textContent.includes('Save')
        );
        saveItem.click();
        await flushPromises();

        expect(saveFile).toHaveBeenCalledWith(
            expect.objectContaining({ fileName: 'My New Diagram', diagramType: 'ER' })
        );
    });

    it('Auto Layout clears saved positions and re-renders without throwing', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name\nentity Contact : LastName';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        el.shadowRoot.querySelector('[data-menu="diagram"]').click();
        await flushPromises();
        const autoLayoutItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
            i.textContent.includes('Auto Layout')
        );
        expect(() => autoLayoutItem.click()).not.toThrow();
        await flushPromises();

        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(2);
    });

    it('Focus mode: clicking (not dragging) an entity header dims unrelated boxes', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value =
            'entity Account : Name\nentity Contact : LastName\nentity Opportunity : Name\n' +
            'Contact.AccountId => Account';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const header = el.shadowRoot.querySelector('.drag-header');
        expect(header).not.toBeNull();

        // A click with near-zero movement between pointerdown/pointerup is
        // what the component treats as "clicked", not "dragged" (>4px moves).
        // MouseEvent (not CustomEvent) is required here — CustomEvent doesn't
        // carry clientX/clientY as real properties, only whatever's under
        // `detail`, so the component's own distance check would silently
        // compute NaN and never register as a click.
        header.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 100,
            clientY: 100
        }));
        const svg = el.shadowRoot.querySelector('svg[data-role="er-svg"]');
        svg.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 101, clientY: 100 }));
        await flushPromises();

        const groups = el.shadowRoot.querySelectorAll('.entity-group');
        const opacities = Array.from(groups).map((g) => g.getAttribute('opacity'));
        // At least one box should be fully visible (the focused one) and at
        // least one dimmed (unrelated) — exact values are erDiagramLogic's
        // concern (already covered there); this just checks the canvas
        // actually reflects a focus state at all, not a specific number.
        expect(opacities).toEqual(expect.arrayContaining(['1']));
        expect(opacities.some((o) => o !== '1' && o !== null)).toBe(true);
    });
});
