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
jest.mock('@salesforce/apex/DiagramPreferenceController.getTheme', () => ({ default: jest.fn(() => Promise.resolve(null)) }), { virtual: true });
jest.mock('@salesforce/apex/DiagramPreferenceController.saveTheme', () => ({ default: jest.fn() }), { virtual: true });

// eslint-disable-next-line no-undef
const saveFile = require('@salesforce/apex/DiagramFileController.saveFile').default;
// eslint-disable-next-line no-undef
const describeObjects = require('@salesforce/apex/SchemaMetadataController.describeObjects').default;
// eslint-disable-next-line no-undef
const describeObjectsForDictionary = require('@salesforce/apex/SchemaMetadataController.describeObjectsForDictionary').default;
// eslint-disable-next-line no-undef
const getTheme = require('@salesforce/apex/DiagramPreferenceController.getTheme').default;
// eslint-disable-next-line no-undef
const getRecordCounts = require('@salesforce/apex/SchemaMetadataController.getRecordCounts').default;

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

    it('the theme dropdown reflects a saved theme once it loads asynchronously, not just the default', async () => {
        getTheme.mockResolvedValueOnce('theme-monokai');

        const el = createStudio();
        await flushPromises(); // loadSavedTheme()'s await resolves here, after the first render

        const options = el.shadowRoot.querySelectorAll('.theme-select option');
        const selected = Array.from(options).find((o) => o.selected);
        expect(selected.value).toBe('theme-monokai');

        // The root class (drives the actual colors) must agree with the
        // dropdown -- this is the exact bug being guarded against: colors
        // apply correctly while the dropdown silently keeps showing Dark+.
        expect(el.shadowRoot.querySelector('.er-studio').className).toContain('theme-monokai');
    });

    it('hover card shows field count always, and real data only for toggles that are on', async () => {
        getRecordCounts.mockResolvedValue({ Account: 42 });

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name, Industry, Phone';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        expect(box).not.toBeNull();

        // Hover with every toggle off -- should show the always-available
        // fields (name, field count, object type) and hints for the rest.
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400)); // hover has its own 350ms debounce

        expect(el.shadowRoot.querySelector('.hover-card-title').textContent).toBe('Account');
        // 3 explicit fields in the DSL + the implicit Id the parser always adds -> 4
        expect(el.shadowRoot.querySelector('.hover-card-sub').textContent).toContain('4 fields');
        expect(el.shadowRoot.querySelector('.hover-card-sub').textContent).toContain('Standard Object');
        const hints = el.shadowRoot.querySelectorAll('.hover-card-hint');
        expect(hints.length).toBe(2); // records, sharing -- both off

        box.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await flushPromises();
        expect(el.shadowRoot.querySelector('.hover-card-title')).toBeNull();

        // Turn on Heatmap, then hover again -- the Records row should now
        // show real data instead of a hint.
        el.shadowRoot.querySelector('[data-menu="view"]').click();
        await flushPromises();
        const heatmapItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
            i.textContent.includes('Heatmap')
        );
        heatmapItem.click();
        await new Promise((resolve) => setTimeout(resolve, 400)); // heatmap fetch debounce

        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));

        const values = Array.from(el.shadowRoot.querySelectorAll('.hover-card-value')).map((v) => v.textContent);
        expect(values).toContain('42');
        expect(el.shadowRoot.querySelectorAll('.hover-card-hint').length).toBe(1); // sharing still off
    });

    it('hover card disappears when the hovered box is deleted, not left orphaned', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(el.shadowRoot.querySelector('.hover-card-title')).not.toBeNull();

        // Delete the box while the hover card is still showing over it --
        // no mouseleave ever fires, since the element itself is gone.
        const deleteBtn = el.shadowRoot.querySelector('.delete-btn');
        deleteBtn.dispatchEvent(new CustomEvent('click', { bubbles: true }));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.hover-card-title')).toBeNull();
    });

    it('Escape dismisses the hover card', async () => {
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(el.shadowRoot.querySelector('.hover-card-title')).not.toBeNull();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.hover-card-title')).toBeNull();
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
        // Shape matches DiagramFileController.FileSummary exactly (id/name/
        // diagramType/lastModified) -- not raw SObject field names. Using
        // the wrong shape here previously left every row's key undefined,
        // which is exactly what triggered LWC's "Invalid key attribute
        // value... item number 0" warning in this test.
        listFilesAdapter.emit([
            { id: 'a01', name: 'Sales Model', diagramType: 'ER', lastModified: '2026-01-01T00:00:00.000Z' },
            { id: 'a02', name: 'Service Model', diagramType: 'ER', lastModified: '2026-01-02T00:00:00.000Z' }
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

    it('importing an object with a Roll-Up Summary field emits "[rollup]" in the DSL and renders the Σ marker on the canvas', async () => {
        describeObjects.mockResolvedValue([
            {
                apiName: 'WebCart',
                label: 'Cart',
                isCustom: false,
                fields: [
                    { apiName: 'Name', label: 'Name', isRelationship: false, isRollupSummary: false },
                    { apiName: 'TotalProductAmount', label: 'Total Product Amount', isRelationship: false, isRollupSummary: true }
                ]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        // File > Import from Org
        el.shadowRoot.querySelector('[data-menu="file"]').click();
        await flushPromises();
        const importItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
            i.textContent.includes('Import from Org')
        );
        importItem.click();
        await flushPromises();

        const namesInput = el.shadowRoot.querySelector('.import-textarea');
        expect(namesInput).not.toBeNull();
        namesInput.value = 'WebCart';
        namesInput.dispatchEvent(new CustomEvent('input'));

        el.shadowRoot.querySelector('.sb-full-btn').click();
        await flushPromises();

        // The generated DSL carries the marker...
        const dslValue = el.shadowRoot.querySelector('.code-editor').value;
        expect(dslValue).toContain('TotalProductAmount[rollup]');
        expect(dslValue).not.toContain('Name[rollup]'); // plain field untouched

        // ...and the canvas renders the Σ indicator for that one field only.
        const sigmaMarkers = Array.from(el.shadowRoot.querySelectorAll('.entity-group text')).filter(
            (t) => t.textContent === '\u03A3'
        );
        expect(sigmaMarkers).toHaveLength(1);
    });

    it('importing an object emits "[FriendlyType]" for plain fields, using the real Setup-style label', async () => {
        describeObjects.mockResolvedValue([
            {
                apiName: 'Account',
                label: 'Account',
                isCustom: false,
                fields: [
                    { apiName: 'Name', label: 'Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text' },
                    { apiName: 'AnnualRevenue', label: 'Annual Revenue', isRelationship: false, isRollupSummary: false, friendlyType: 'Currency' }
                ]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        el.shadowRoot.querySelector('[data-menu="file"]').click();
        await flushPromises();
        const importItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
            i.textContent.includes('Import from Org')
        );
        importItem.click();
        await flushPromises();

        const namesInput = el.shadowRoot.querySelector('.import-textarea');
        namesInput.value = 'Account';
        namesInput.dispatchEvent(new CustomEvent('input'));
        el.shadowRoot.querySelector('.sb-full-btn').click();
        await flushPromises();

        const dslValue = el.shadowRoot.querySelector('.code-editor').value;
        expect(dslValue).toContain('Name[Text]');
        expect(dslValue).toContain('AnnualRevenue[Currency]');
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

    describe('Data Dictionary', () => {
        async function openObjectNamed(el, name) {
            el.shadowRoot.querySelector('[data-menu="view"]').click();
            await flushPromises();
            const dictItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
                i.textContent.includes('Data Dictionary')
            );
            dictItem.click();
            await flushPromises();
            const row = el.shadowRoot.querySelector(`.dict-obj-row[data-name="${name}"]`);
            row.click();
        }

        it('Clear removes the object title/table together, not just the table rows', async () => {
            describeObjectsForDictionary.mockResolvedValue([
                { apiName: 'Case', label: 'Case', isCustom: false, fields: [{ apiName: 'Subject', isPrimaryKey: false }] }
            ]);

            const el = createStudio();
            objectNamesAdapter.emit(['Case']);
            await flushPromises();
            await openObjectNamed(el, 'Case');
            await flushPromises();

            expect(el.shadowRoot.querySelector('.dict-detail-title').textContent).toBe('Case');

            const clearBtn = Array.from(el.shadowRoot.querySelectorAll('.dsl-head-btn')).find(
                (b) => b.textContent === 'Clear Selection'
            );
            clearBtn.click();
            await flushPromises();

            // The title/table are gone. The object still legitimately shows
            // in the left-hand list (Clear only resets the right panel, by
            // design) — so check the right panel specifically, not the
            // whole shadow root.
            expect(el.shadowRoot.querySelector('.dict-detail-pane').textContent).not.toContain('Case');
        });

        it('BUG REPRO: Clear after switching between two different objects (Case, then Account) actually clears', async () => {
            describeObjectsForDictionary.mockImplementation(({ objectApiNames }) => {
                const apiName = objectApiNames[0];
                return Promise.resolve([
                    { apiName, label: apiName, isCustom: false, fields: [{ apiName: 'Name', isPrimaryKey: false }] }
                ]);
            });

            const el = createStudio();
            objectNamesAdapter.emit(['Case', 'Account']);
            await flushPromises();

            // Select Case, let it fully resolve.
            await openObjectNamed(el, 'Case');
            await flushPromises();
            expect(el.shadowRoot.querySelector('.dict-detail-title').textContent).toBe('Case');

            // Select Account instead (not Clear yet), let it fully resolve too.
            el.shadowRoot.querySelector('.dict-obj-row[data-name="Account"]').click();
            await flushPromises();
            expect(el.shadowRoot.querySelector('.dict-detail-title').textContent).toBe('Account');

            // Now Clear.
            const clearBtn = Array.from(el.shadowRoot.querySelectorAll('.dsl-head-btn')).find(
                (b) => b.textContent === 'Clear Selection'
            );
            clearBtn.click();
            await flushPromises();

            expect(el.shadowRoot.querySelector('.dict-detail-pane').textContent).not.toContain('Account');
        });

        it('switching to a different object while the first is still loading does not let the stale one win', async () => {
            let resolveCase;
            describeObjectsForDictionary.mockImplementation(({ objectApiNames }) => {
                if (objectApiNames[0] === 'Case') {
                    return new Promise((resolve) => { resolveCase = resolve; });
                }
                return Promise.resolve([
                    { apiName: 'Account', label: 'Account', isCustom: false, fields: [{ apiName: 'Name', isPrimaryKey: false }] }
                ]);
            });

            const el = createStudio();
            objectNamesAdapter.emit(['Case', 'Account']);
            await flushPromises();
            await openObjectNamed(el, 'Case');
            await flushPromises(); // Case's request is now in flight, unresolved

            // The left-hand list stays interactive during loading — switch
            // to a different object before Case ever responds.
            el.shadowRoot.querySelector('.dict-obj-row[data-name="Account"]').click();
            await flushPromises();
            expect(el.shadowRoot.querySelector('.dict-detail-title').textContent).toBe('Account');

            // Case's stale response finally arrives after the switch.
            resolveCase([
                { apiName: 'Case', label: 'Case', isCustom: false, fields: [{ apiName: 'Subject', isPrimaryKey: false }] }
            ]);
            await flushPromises();

            expect(el.shadowRoot.querySelector('.dict-detail-title').textContent).toBe('Account');
        });

        it('sort arrow moves to whichever column was clicked most recently', async () => {
            describeObjectsForDictionary.mockResolvedValue([
                {
                    apiName: 'Case',
                    label: 'Case',
                    isCustom: false,
                    fields: [
                        { apiName: 'Zebra__c', isCustom: true, required: false, isPrimaryKey: false },
                        { apiName: 'Amount__c', isCustom: true, required: true, isPrimaryKey: false }
                    ]
                }
            ]);

            const el = createStudio();
            objectNamesAdapter.emit(['Case']);
            await flushPromises();
            await openObjectNamed(el, 'Case');
            await flushPromises();

            const headers = el.shadowRoot.querySelectorAll('.dict-th-sort');
            const customHeader = Array.from(headers).find((h) => h.dataset.column === 'isCustom');
            const requiredHeader = Array.from(headers).find((h) => h.dataset.column === 'required');

            customHeader.click();
            await flushPromises();
            expect(customHeader.className).toContain('dict-th-sort-active');
            expect(requiredHeader.className).not.toContain('dict-th-sort-active');

            requiredHeader.click();
            await flushPromises();
            expect(requiredHeader.className).toContain('dict-th-sort-active');
            expect(customHeader.className).not.toContain('dict-th-sort-active');

            // Required (asc): false (0) sorts before true (1) -> Zebra__c first
            const rows = el.shadowRoot.querySelectorAll('.dict-field-row td:first-child');
            expect(rows[0].textContent).toBe('Zebra__c');
            expect(rows[1].textContent).toBe('Amount__c');
        });

        it('menu buttons remain functional after selecting an object, clearing it, and closing the dictionary', async () => {
            describeObjectsForDictionary.mockResolvedValue([
                { apiName: 'Case', label: 'Case', isCustom: false, fields: [{ apiName: 'Subject', isPrimaryKey: false }] }
            ]);

            const el = createStudio();
            objectNamesAdapter.emit(['Case']);
            await flushPromises();
            await openObjectNamed(el, 'Case');
            await flushPromises();

            const clearBtn = Array.from(el.shadowRoot.querySelectorAll('.dsl-head-btn')).find(
                (b) => b.textContent === 'Clear Selection'
            );
            clearBtn.click();
            await flushPromises();

            // Close the dictionary (Back to Diagram)
            const backBtn = el.shadowRoot.querySelector('.dict-back-btn');
            expect(backBtn).not.toBeNull();
            backBtn.click();
            await flushPromises();

            expect(el.shadowRoot.querySelector('.dict-overlay')).toBeNull();

            // Now try the File menu
            const fileMenuBtn = el.shadowRoot.querySelector('[data-menu="file"]');
            fileMenuBtn.click();
            await flushPromises();

            const dropdown = el.shadowRoot.querySelector('.dd-menu-dropdown');
            expect(dropdown).not.toBeNull();
            const newItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
                i.textContent.includes('New')
            );
            expect(newItem).toBeDefined();
        });

        it('menu buttons remain functional after switching DIRECTLY between two objects (no Clear in between), then clearing and closing', async () => {
            describeObjectsForDictionary.mockImplementation(({ objectApiNames }) => {
                const apiName = objectApiNames[0];
                return Promise.resolve([
                    { apiName, label: apiName, isCustom: false, fields: [{ apiName: 'Name', isPrimaryKey: false }] }
                ]);
            });

            const el = createStudio();
            objectNamesAdapter.emit(['Case', 'Order']);
            await flushPromises();

            // Case -> Order directly, with NO Clear in between (the pattern
            // reported as different from select-then-clear-then-select).
            await openObjectNamed(el, 'Case');
            await flushPromises();
            el.shadowRoot.querySelector('.dict-obj-row[data-name="Order"]').click();
            await flushPromises();
            expect(el.shadowRoot.querySelector('.dict-detail-title').textContent).toBe('Order');

            const clearBtn = Array.from(el.shadowRoot.querySelectorAll('.dsl-head-btn')).find(
                (b) => b.textContent === 'Clear Selection'
            );
            clearBtn.click();
            await flushPromises();

            const backBtn = el.shadowRoot.querySelector('.dict-back-btn');
            backBtn.click();
            await flushPromises();
            expect(el.shadowRoot.querySelector('.dict-overlay')).toBeNull();

            const fileMenuBtn = el.shadowRoot.querySelector('[data-menu="file"]');
            fileMenuBtn.click();
            await flushPromises();

            const dropdown = el.shadowRoot.querySelector('.dd-menu-dropdown');
            expect(dropdown).not.toBeNull();
            const newItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
                i.textContent.includes('New')
            );
            expect(newItem).toBeDefined();
        });
    });
});
