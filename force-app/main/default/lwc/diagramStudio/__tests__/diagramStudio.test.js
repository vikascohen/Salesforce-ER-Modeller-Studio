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
jest.mock('@salesforce/apex/SchemaMetadataController.getSharingSignals', () => ({ default: jest.fn() }), { virtual: true });
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
// eslint-disable-next-line no-undef
const getSharingModels = require('@salesforce/apex/SchemaMetadataController.getSharingModels').default;
// eslint-disable-next-line no-undef
const getSharingSignals = require('@salesforce/apex/SchemaMetadataController.getSharingSignals').default;

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
        getRecordCounts.mockResolvedValue({ Account: { count: 42, lastModifiedDate: new Date().toISOString() } });

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

    it('NEW FEATURE: Heatmap distinguishes stale objects (records exist, none touched in over a year) from active ones, not just empty-vs-not', async () => {
        // Real, reported limitation: the heatmap only ever showed two
        // colors, any records vs zero records — an object with 50,000
        // records nobody has touched in three years looked identical to
        // one actively being used today, as long as both had at least one
        // record. Two accounts here, one genuinely stale, one genuinely
        // active, to prove the fix tells them apart rather than just
        // asserting the color constant changed.
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        getRecordCounts.mockResolvedValue({
            Account: { count: 500, lastModifiedDate: twoYearsAgo.toISOString() },
            Contact: { count: 500, lastModifiedDate: yesterday.toISOString() }
        });

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name\nentity Contact : LastName';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        el.shadowRoot.querySelector('[data-menu="view"]').click();
        await flushPromises();
        Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) => i.textContent.includes('Heatmap')).click();
        await new Promise((resolve) => setTimeout(resolve, 400));

        // The shadow rect (always #c8cdd6) renders before the body rect
        // within each entity group, so querySelectorAll(...)[1] is the
        // one whose fill actually reflects heatColorFor()'s result.
        const accountRect = el.shadowRoot.querySelectorAll('.entity-group[data-name="Account"] rect')[1];
        const contactRect = el.shadowRoot.querySelectorAll('.entity-group[data-name="Contact"] rect')[1];

        // Stale and active must render as genuinely different colors —
        // and neither should be the "empty" orange, since both have records.
        expect(accountRect.getAttribute('fill')).toBe('#fef3c7'); // stale
        expect(contactRect.getAttribute('fill')).toBe('#cfe8fb'); // active
        expect(accountRect.getAttribute('fill')).not.toBe(contactRect.getAttribute('fill'));

        // The hover card states this in words too, not just a color the
        // person has to already know how to interpret.
        const accountBox = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        accountBox.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(el.shadowRoot.querySelector('.hover-card-freshness').textContent).toContain('Stale');
        expect(el.shadowRoot.querySelector('.hover-card-freshness').textContent).toContain('Last touched');
        accountBox.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await flushPromises();

        const contactBox = el.shadowRoot.querySelector('.entity-group[data-name="Contact"]');
        contactBox.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(el.shadowRoot.querySelector('.hover-card-freshness').textContent).not.toContain('Stale');
        expect(el.shadowRoot.querySelector('.hover-card-freshness').textContent).toContain('Last touched');
    });

    it('NEW FEATURE: hover card shows Sharing Rules and Apex Sharing, with Apex Sharing correctly marked "not determinable" on a standard object', async () => {
        // Real, deliberate accuracy limit, not an oversight: Apex Managed
        // Sharing on a STANDARD object uses the exact same RowCause
        // ('Manual') as a person manually sharing one record — the two are
        // genuinely indistinguishable there. Showing a definite Yes/No for
        // Account specifically would be actively misleading, not just
        // incomplete, so it must say "not determinable" instead — this
        // test asserts on that exact wording, not just "something shows".
        getSharingModels.mockResolvedValue({ Account: { internalModel: 'Private', externalModel: null } });
        getSharingSignals.mockResolvedValue({
            Account: { shareTableAvailable: true, isCustomObject: false, hasSharingRule: true, hasApexSharing: false }
        });

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        el.shadowRoot.querySelector('[data-menu="view"]').click();
        await flushPromises();
        Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) => i.textContent.includes('Sharing View')).click();
        await new Promise((resolve) => setTimeout(resolve, 400));

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));

        const values = Array.from(el.shadowRoot.querySelectorAll('.hover-card-value')).map((v) => v.textContent);
        expect(values).toContain('Yes'); // Sharing Rules
        expect(values).toContain('Not determinable on standard objects'); // Apex Sharing on a standard object
        expect(values).not.toContain('No'); // hasApexSharing was false, but must never surface as a definite "No" on a standard object
    });

    it('NEW FEATURE: Apex Sharing shows a real Yes/No on a custom object, since it is reliably detectable there', async () => {
        getSharingModels.mockResolvedValue({ Diagram_File__c: { internalModel: 'Private', externalModel: null } });
        getSharingSignals.mockResolvedValue({
            Diagram_File__c: { shareTableAvailable: true, isCustomObject: true, hasSharingRule: false, hasApexSharing: true }
        });

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Diagram_File__c : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        el.shadowRoot.querySelector('[data-menu="view"]').click();
        await flushPromises();
        Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) => i.textContent.includes('Sharing View')).click();
        await new Promise((resolve) => setTimeout(resolve, 400));

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Diagram_File__c"]');
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));

        const values = Array.from(el.shadowRoot.querySelectorAll('.hover-card-value')).map((v) => v.textContent);
        expect(values).toContain('No');  // Sharing Rules — hasSharingRule was false
        expect(values).toContain('Yes'); // Apex Sharing — a real, definite answer on a custom object
    });

    it('NEW FEATURE: an object with no __Share table at all shows a clear "no sharing data" message, not a misleading No', async () => {
        getSharingModels.mockResolvedValue({ Account: { internalModel: 'ReadWrite', externalModel: null } });
        getSharingSignals.mockResolvedValue({
            Account: { shareTableAvailable: false, isCustomObject: false, hasSharingRule: false, hasApexSharing: false }
        });

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        el.shadowRoot.querySelector('[data-menu="view"]').click();
        await flushPromises();
        Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) => i.textContent.includes('Sharing View')).click();
        await new Promise((resolve) => setTimeout(resolve, 400));

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));

        expect(el.shadowRoot.querySelectorAll('.hover-card-hint')[1].textContent).toBe('No sharing data for this object');
    });

    it('BUG FIX: hover card field count reflects the true total, not just the currently visible rows, after a box has been resized shorter', async () => {
        // Real, related bug: box.fields from the geometry engine is only
        // the rows that currently FIT in the box's height — resizing a
        // box shorter hides some rows behind a "+N more" indicator, and
        // the old fieldCount computation (box.fields.length alone) simply
        // never accounted for those hidden rows, silently under-reporting
        // the field count the moment a box had ever been shrunk.
        const el = createStudio();
        await flushPromises();

        // 20 fields is comfortably more than fit in any reasonably-sized
        // resized box, so shrinking guarantees a non-zero hidden count.
        const manyFields = Array.from({ length: 20 }, (_, i) => `Field${i}`).join(', ');
        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = `entity Account : ${manyFields}`;
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const handle = el.shadowRoot.querySelector('.resize-handle[data-name="Account"]');
        expect(handle).not.toBeNull();
        handle.dispatchEvent(new CustomEvent('pointerdown', { clientY: 300, pointerId: 1 }));
        handle.dispatchEvent(new CustomEvent('pointermove', { clientY: 60, pointerId: 1 })); // drag far up — shrink hard
        handle.dispatchEvent(new CustomEvent('pointerup', { pointerId: 1 }));
        await flushPromises();

        const box = el.shadowRoot.querySelector('.entity-group[data-name="Account"]');
        box.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 200, clientY: 150 }));
        await new Promise((resolve) => setTimeout(resolve, 400));

        // 20 explicit fields + the implicit Id = 21, regardless of how many
        // of those rows currently fit inside the shrunk box.
        expect(el.shadowRoot.querySelector('.hover-card-sub').textContent).toContain('21 fields');
    });

    it('NEW FEATURE: clicking "+N more" (or double-clicking the resize handle) restores a shrunk box to its natural height, showing every field', async () => {
        // Real, reported problem: with enough fields (Account can easily
        // have 70+), manually dragging a box tall enough to see everything
        // requires an impractically large drag distance -- 70 fields at
        // ROW_HEIGHT (22px) is 1,500+ pixels, well beyond what a single
        // mouse drag comfortably covers, since the drag is bounded by the
        // user's actual cursor position on screen, not the logical canvas
        // size. Reported as "I stretched, shrunk, still shows limited
        // fields" -- that's this exact ceiling, not a hidden bug in how
        // many fields are hidden.
        const el = createStudio();
        await flushPromises();

        const manyFields = Array.from({ length: 20 }, (_, i) => `Field${i}`).join(', ');
        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = `entity Account : ${manyFields}`;
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Shrink it hard first, so there's genuinely something hidden.
        const handle = el.shadowRoot.querySelector('.resize-handle[data-name="Account"]');
        handle.dispatchEvent(new CustomEvent('pointerdown', { clientY: 300, pointerId: 1 }));
        handle.dispatchEvent(new CustomEvent('pointermove', { clientY: 60, pointerId: 1 }));
        handle.dispatchEvent(new CustomEvent('pointerup', { pointerId: 1 }));
        await flushPromises();

        const moreText = el.shadowRoot.querySelector('.more-fields-text[data-name="Account"]');
        expect(moreText).not.toBeNull();
        expect(moreText.textContent).toContain('more');
        expect(moreText.textContent).toContain('click to show all'); // the old "drag bottom to expand" text is gone

        // Click it — this is the fix.
        moreText.dispatchEvent(new CustomEvent('click', { bubbles: true }));
        await flushPromises();

        // Every field row now renders, and the "+N more" indicator itself
        // is gone since there's nothing left hidden.
        const fieldRows = el.shadowRoot.querySelectorAll('.entity-group[data-name="Account"] text');
        // Id + 20 explicit fields = 21 rows, plus the entity name itself in
        // the header — comfortably more than the handful that fit before.
        expect(fieldRows.length).toBeGreaterThanOrEqual(21);
        expect(el.shadowRoot.querySelector('.more-fields-text[data-name="Account"]')).toBeNull();
    });

    it('NEW FEATURE: double-clicking the resize handle also restores the natural height', async () => {
        const el = createStudio();
        await flushPromises();

        const manyFields = Array.from({ length: 20 }, (_, i) => `Field${i}`).join(', ');
        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = `entity Account : ${manyFields}`;
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const handle = el.shadowRoot.querySelector('.resize-handle[data-name="Account"]');
        handle.dispatchEvent(new CustomEvent('pointerdown', { clientY: 300, pointerId: 1 }));
        handle.dispatchEvent(new CustomEvent('pointermove', { clientY: 60, pointerId: 1 }));
        handle.dispatchEvent(new CustomEvent('pointerup', { pointerId: 1 }));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.more-fields-text[data-name="Account"]')).not.toBeNull();

        handle.dispatchEvent(new CustomEvent('dblclick', { bubbles: true }));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.more-fields-text[data-name="Account"]')).toBeNull();
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

    it('a required field renders a red "R" marker on the canvas, a non-required field does not', async () => {
        const el = createStudio();
        await flushPromises();

        const dslEditor = el.shadowRoot.querySelector('.code-editor');
        dslEditor.value = 'entity Contact : LastName[Required], Fax';
        dslEditor.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));

        const requiredMarkers = Array.from(el.shadowRoot.querySelectorAll('.entity-group text')).filter(
            (t) => t.textContent === 'R' && t.getAttribute('fill') === '#d92d20'
        );
        expect(requiredMarkers).toHaveLength(1);
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

    it('importing an object emits "[Required]", combines it with the type/rollup marker, and sorts required fields first', async () => {
        describeObjects.mockResolvedValue([
            {
                apiName: 'Contact',
                label: 'Contact',
                isCustom: false,
                fields: [
                    // Deliberately listed NOT-required-first in the mock,
                    // so a passing test proves real sorting happened, not
                    // that the mock's own order was echoed back untouched.
                    { apiName: 'Fax', label: 'Fax', isRelationship: false, isRollupSummary: false, friendlyType: 'Phone', required: false },
                    { apiName: 'LastName', label: 'Last Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: true },
                    { apiName: 'Email', label: 'Email', isRelationship: false, isRollupSummary: false, friendlyType: 'Email', required: false },
                    { apiName: 'AccountId', label: 'Account', isRelationship: true, relatesTo: null, isRollupSummary: false, required: true }
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
        namesInput.value = 'Contact';
        namesInput.dispatchEvent(new CustomEvent('input'));
        el.shadowRoot.querySelector('.sb-full-btn').click();
        await flushPromises();

        const dslValue = el.shadowRoot.querySelector('.code-editor').value;
        expect(dslValue).toContain('LastName[Text, Required]');

        // Required field (LastName) sorted before the non-required ones
        // (Fax, Email), even though the mock listed it second.
        const entityLine = dslValue.split('\n').find((l) => l.startsWith('entity Contact'));
        expect(entityLine.indexOf('LastName')).toBeLessThan(entityLine.indexOf('Fax'));
        expect(entityLine.indexOf('LastName')).toBeLessThan(entityLine.indexOf('Email'));

        // AccountId is a REQUIRED relationship field, but with no target
        // object specified in this mock (relatesTo: null) — it is correctly
        // treated the same as any relationship field whose target isn't
        // present: shown as a plain field, not silently dropped (see the
        // dedicated orphaned-relationship-field test below for the full
        // behavior, including the type label). With no relationshipType
        // set in this mock either, only [Required] appears — no type prefix.
        expect(entityLine).toContain('AccountId[Required]');
    });

    it('BUG FIX: a relationship field whose target object is not on the canvas is shown as a plain field with its relationship kind as the type label, not silently dropped', async () => {
        // The real, reported bug: previously, a relationship field was
        // excluded from the plain field list unconditionally (it IS a
        // relationship), and only included as a relationship line if its
        // target was also present. Import Contact alone, without Account,
        // and AccountId disappeared from the DSL entirely — not in the
        // field list, not as a relationship line, just gone, even though
        // it's a real field on the object. Confirmed directly against
        // dropping a single object without its related object also on the
        // canvas.
        describeObjects.mockResolvedValue([
            {
                apiName: 'Contact',
                label: 'Contact',
                isCustom: false,
                fields: [
                    { apiName: 'LastName', label: 'Last Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: true },
                    { apiName: 'AccountId', label: 'Account', isRelationship: true, relatesTo: 'Account', relationshipType: 'Lookup', isRollupSummary: false, required: false }
                ]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        el.shadowRoot.querySelector('[data-menu="file"]').click();
        await flushPromises();
        Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) => i.textContent.includes('Import from Org')).click();
        await flushPromises();

        const namesInput = el.shadowRoot.querySelector('.import-textarea');
        namesInput.value = 'Contact'; // deliberately NOT importing Account too
        namesInput.dispatchEvent(new CustomEvent('input'));
        el.shadowRoot.querySelector('.sb-full-btn').click();
        await flushPromises();

        const dslValue = el.shadowRoot.querySelector('.code-editor').value;
        const entityLine = dslValue.split('\n').find((l) => l.startsWith('entity Contact'));

        expect(entityLine).toContain('AccountId[Lookup]');
        // And critically: no broken relationship line pointing at an
        // object that was never actually imported.
        expect(dslValue).not.toContain('Contact.AccountId');
    });

    it('BUG REPRO: dragging a new entity onto the canvas does not touch a manually-curated field list on an existing entity', async () => {
        // User has typed Account by hand with only 3 fields -- a deliberately
        // trimmed-down list, not what a full describe would return.
        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Account : Name, Industry, Phone';
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(1);

        // Contact is dragged onto the canvas. If Account were re-described
        // here too, this mock would need an Account entry -- it deliberately
        // only has Contact, so the test fails loudly if the fix regresses
        // and the component tries to re-describe Account as well.
        describeObjects.mockImplementation(({ objectApiNames }) => {
            expect(objectApiNames).toEqual(['Contact']); // never re-describes Account
            return Promise.resolve([
                {
                    apiName: 'Contact',
                    label: 'Contact',
                    isCustom: false,
                    fields: [
                        { apiName: 'LastName', label: 'Last Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text' },
                        {
                            apiName: 'AccountId', label: 'Account', isRelationship: true,
                            relatesTo: 'Account', relationshipType: 'Lookup', isRollupSummary: false
                        }
                    ]
                }
            ]);
        });

        const dropEvent = new CustomEvent('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(dropEvent, 'dataTransfer', { value: { getData: () => 'Contact' } });
        Object.defineProperty(dropEvent, 'clientX', { value: 300 });
        Object.defineProperty(dropEvent, 'clientY', { value: 200 });
        const canvasWrap = el.shadowRoot.querySelector('.canvas-wrap');
        canvasWrap.dispatchEvent(dropEvent);
        await flushPromises();

        const dslValue = el.shadowRoot.querySelector('.code-editor').value;
        // Account's original, manually-curated field list survives exactly —
        // no field it didn't have before, nothing dropped either. This exact
        // line match is the real proof; Account never gets touched at all.
        expect(dslValue).toContain('entity Account : Name, Industry, Phone');
        // Contact was correctly added, including its relationship to Account.
        expect(dslValue).toContain('entity Contact : LastName');
        expect(dslValue).toContain('Contact.AccountId -> Account');

        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(2);
        expect(el.shadowRoot.querySelector('.error-bar')).toBeNull();
    });

    it('BUG REPRO (multiple existing entities, real-world DSL): dragging Contact onto Account/Order__c/WebCart leaves all three exactly as typed', async () => {
        const startingDsl =
            'entity Account : Name, Industry, Phone, Website, Type, AnnualRevenue[Currency], Description[Text Area (Long)]\n' +
            'entity Order__c : Order_Date__c, Status__c\n' +
            'entity WebCart : Name, TotalProductAmount[rollup]';

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = startingDsl;
        textarea.dispatchEvent(new CustomEvent('input'));
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(3);

        // Contact is dropped. If any of the three existing entities got
        // re-described too, this mock (Contact only) would be the wrong
        // shape and objectApiNames wouldn't equal ['Contact'] -- the
        // assertion inside the mock itself catches that regression.
        describeObjects.mockImplementation(({ objectApiNames }) => {
            expect(objectApiNames).toEqual(['Contact']);
            return Promise.resolve([
                {
                    apiName: 'Contact',
                    label: 'Contact',
                    isCustom: false,
                    fields: [
                        { apiName: 'LastName', label: 'Last Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text' }
                    ]
                }
            ]);
        });

        const dropEvent = new CustomEvent('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(dropEvent, 'dataTransfer', { value: { getData: () => 'Contact' } });
        Object.defineProperty(dropEvent, 'clientX', { value: 300 });
        Object.defineProperty(dropEvent, 'clientY', { value: 200 });
        el.shadowRoot.querySelector('.canvas-wrap').dispatchEvent(dropEvent);
        await flushPromises();

        const dslValue = el.shadowRoot.querySelector('.code-editor').value;
        // All three original lines survive completely untouched, including
        // the bracket type annotations and the [rollup] marker.
        expect(dslValue).toContain(
            'entity Account : Name, Industry, Phone, Website, Type, AnnualRevenue[Currency], Description[Text Area (Long)]'
        );
        expect(dslValue).toContain('entity Order__c : Order_Date__c, Status__c');
        expect(dslValue).toContain('entity WebCart : Name, TotalProductAmount[rollup]');
        expect(dslValue).toContain('entity Contact : LastName');

        expect(el.shadowRoot.querySelectorAll('.entity-group').length).toBe(4);
        expect(el.shadowRoot.querySelector('.error-bar')).toBeNull();
    });

    it('selecting a field from the DSL autocomplete dropdown inserts its type marker automatically, matching what Import from Org would generate', async () => {
        describeObjects.mockResolvedValue([
            {
                apiName: 'Contact',
                label: 'Contact',
                isCustom: false,
                fields: [
                    { apiName: 'AccountNumber', label: 'Account Number', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false }
                ]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Contact : AccountNum';
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(new CustomEvent('input'));
        await flushPromises(); // ensureFieldsCached()'s describeObjects call resolves, re-triggering suggestions

        const items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const match = items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'AccountNumber');
        expect(match).toBeDefined();

        match.dispatchEvent(new CustomEvent('click'));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.code-editor').value).toBe('entity Contact : AccountNumber[Text]');
    });

    it('the caret lands at the end of the inserted text and stays there after a full render cycle settles, not reset by the dirty-value-flag workaround', async () => {
        // Not a direct test of the real-browser "textarea ignores
        // template value updates after the user has typed once" quirk
        // itself — jsdom's textarea may not reproduce that exact
        // behavior the same way every real browser does. What this DOES
        // verify: the observable, correct end state — that
        // _pendingCaretPos set by applySuggestionAtIndex is actually
        // consumed by renderedCallback and the caret ends up exactly
        // where it should, even after LWC's own render cycle (which
        // includes the dirty-value-flag re-assignment of ta.value) has
        // fully run, not just immediately after the synchronous click handler.
        describeObjects.mockResolvedValue([
            { apiName: 'Contact', label: 'Contact', isCustom: false, fields: [{ apiName: 'LastName', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false }] }
        ]);

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Contact : LastNam';
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        const items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'LastName').dispatchEvent(new CustomEvent('click'));
        await flushPromises(); // let every scheduled render cycle actually settle, not just the synchronous handler

        const finalTextarea = el.shadowRoot.querySelector('.code-editor');
        const expectedLength = 'entity Contact : LastName[Text]'.length;
        expect(finalTextarea.value).toBe('entity Contact : LastName[Text]');
        expect(finalTextarea.selectionStart).toBe(expectedLength);
        expect(finalTextarea.selectionEnd).toBe(expectedLength);
    });

    it('BUG REPRO 2: full end-to-end sequence via intellisense only — select the object itself from the dropdown, then a field, then try a second field whose name starts the same way as the first', async () => {
        // A more precise reproduction than the previous test: the object
        // name itself is picked from the dropdown (not typed by hand),
        // and critically, the SECOND field search term ("acc") is a
        // prefix of the FIRST field already added ("AccountStatus") —
        // testing specifically whether the "already typed" exclusion
        // still lets OTHER same-prefix fields through correctly, rather
        // than only testing a case where the two field names don't overlap.
        describeObjects.mockResolvedValue([
            {
                apiName: 'Account',
                label: 'Account',
                isCustom: false,
                fields: [
                    { apiName: 'AccountStatus__c', label: 'Account Status', isRelationship: false, isRollupSummary: false, friendlyType: 'Picklist', required: false },
                    { apiName: 'AccountSource', label: 'Account Source', isRelationship: false, isRollupSummary: false, friendlyType: 'Picklist', required: false }
                ]
            }
        ]);

        const el = createStudio();
        objectNamesAdapter.emit(['Account']);
        await flushPromises();

        // Step 1: type "entity acc" and pick "Account" from the dropdown.
        const ta = el.shadowRoot.querySelector('.code-editor');
        ta.value = 'entity acc';
        ta.selectionStart = ta.value.length;
        ta.selectionEnd = ta.value.length;
        ta.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        let items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const accountItem = items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'Account');
        expect(accountItem).toBeDefined();
        accountItem.dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        expect(el.shadowRoot.querySelector('.code-editor').value).toBe('entity Account');

        // Step 2: type " : acc" and pick "AccountStatus__c" from the dropdown.
        let ta2 = el.shadowRoot.querySelector('.code-editor');
        ta2.value = ta2.value + ' : acc';
        ta2.selectionStart = ta2.value.length;
        ta2.selectionEnd = ta2.value.length;
        ta2.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const statusItem = items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'AccountStatus__c');
        expect(statusItem).toBeDefined();
        statusItem.dispatchEvent(new CustomEvent('click'));
        await flushPromises();
        expect(el.shadowRoot.querySelector('.code-editor').value).toBe('entity Account : AccountStatus__c[Picklist]');

        // Step 3: type ", acc" again — this is the exact reported failure.
        let ta3 = el.shadowRoot.querySelector('.code-editor');
        ta3.value = ta3.value + ', acc';
        ta3.selectionStart = ta3.value.length;
        ta3.selectionEnd = ta3.value.length;
        ta3.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const sourceItem = items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'AccountSource');
        expect(sourceItem).toBeDefined(); // this is what must not be undefined
    });

    it('BUG REPRO: autocomplete still works for a second field typed right after a bracket-suffixed one from the dropdown', async () => {
        // The exact reported bug: pick a field from the dropdown (which
        // inserts "FieldName[Type]"), then try to autocomplete a second
        // field right after it — this used to do nothing at all until the
        // "[Type]" was deleted by hand, because the context-detection
        // regex assumed every already-typed field was bracket-free.
        describeObjects.mockResolvedValue([
            {
                apiName: 'Contact',
                label: 'Contact',
                isCustom: false,
                fields: [
                    { apiName: 'AccountNumber', label: 'Account Number', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false },
                    { apiName: 'Status__c', label: 'Status', isRelationship: false, isRollupSummary: false, friendlyType: 'Picklist', required: false }
                ]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        // First field, picked from the dropdown exactly like a real user would.
        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Contact : AccountNum';
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        let items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'AccountNumber').dispatchEvent(new CustomEvent('click'));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.code-editor').value).toBe('entity Contact : AccountNumber[Text]');

        // Now the user types ", Stat" to start a second field — this is
        // the exact step that was broken.
        const textarea2 = el.shadowRoot.querySelector('.code-editor');
        textarea2.value = textarea2.value + ', Stat';
        textarea2.selectionStart = textarea2.value.length;
        textarea2.selectionEnd = textarea2.value.length;
        textarea2.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const match = items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'Status__c');
        expect(match).toBeDefined(); // this used to be undefined — the whole point of this test

        match.dispatchEvent(new CustomEvent('click'));
        await flushPromises();

        expect(el.shadowRoot.querySelector('.code-editor').value).toBe('entity Contact : AccountNumber[Text], Status__c[Picklist]');
    });

    it('a field already typed with a bracket suffix is correctly excluded from further suggestions, not just visually present', async () => {
        // The second half of the same root bug: the "already typed" set
        // used to be computed by naively splitting on comma without
        // stripping the "[Type]" suffix, so "accountnumber[text]" never
        // matched the bare "accountnumber" being checked against it —
        // meaning the same field could be suggested and inserted a
        // second time right next to itself.
        describeObjects.mockResolvedValue([
            {
                apiName: 'Contact',
                label: 'Contact',
                isCustom: false,
                fields: [{ apiName: 'AccountNumber', label: 'Account Number', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false }]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        const textarea = el.shadowRoot.querySelector('.code-editor');
        textarea.value = 'entity Contact : AccountNumber[Text], Acc';
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        textarea.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        const items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const match = items.find((i) => i.querySelector('.dsl-suggest-label').textContent === 'AccountNumber');
        expect(match).toBeUndefined(); // already typed once — must not be offered again
    });

    it('BUG FIX: a field already typed AFTER the cursor is also correctly excluded, not just fields typed before it', async () => {
        // Real, reported bug, distinct from the one above: "already typed"
        // was computed only from what comes BEFORE the cursor on the
        // line — a field sitting AFTER wherever the cursor happens to be
        // (the normal case when inserting a new field into the middle of
        // an existing list, rather than always typing strictly left to
        // right) was never excluded at all. Reported directly: a field
        // already on the entity's line kept showing up in the dropdown as
        // if it weren't there yet.
        describeObjects.mockResolvedValue([
            {
                apiName: 'Account',
                label: 'Account',
                isCustom: false,
                fields: [
                    { apiName: 'Active', label: 'Active', isRelationship: false, isRollupSummary: false, friendlyType: 'Checkbox', required: false },
                    { apiName: 'AccountNumber', label: 'Account Number', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false }
                ]
            }
        ]);

        const el = createStudio();
        await flushPromises();

        // "Active" is already in the field list, AFTER the position the
        // cursor is placed at (right after "Ac", before the comma) — both
        // "Active" and "AccountNumber" start with "Ac", so this genuinely
        // tests the exclusion, not just a prefix that happens not to match.
        const textarea = el.shadowRoot.querySelector('.code-editor');
        const value = 'entity Account : Ac, Active';
        const caretPos = 'entity Account : Ac'.length;
        textarea.value = value;
        textarea.selectionStart = caretPos;
        textarea.selectionEnd = caretPos;
        textarea.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        const items = Array.from(el.shadowRoot.querySelectorAll('.dsl-suggestions [data-index]'));
        const labels = items.map((i) => i.querySelector('.dsl-suggest-label').textContent);
        expect(labels).toContain('AccountNumber');
        expect(labels).not.toContain('Active'); // already on the line, just after the cursor — must not be offered
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

    describe('Compare with Org (schema drift)', () => {
        it('BUG FIX: a field added via Compare with Org gets the same [Type] marker Import from Org would generate, not a bare name', async () => {
            // Real reported bug: newFields, computed in checkSchemaDrift,
            // was reduced to just { id, name: f.apiName } — discarding
            // friendlyType/isRollupSummary/required entirely — so by the
            // time addFieldToEntity ran, there was no way to know what
            // marker the field should carry. Every other way a field gets
            // added to the DSL (Import from Org, drag-and-drop, the
            // autocomplete dropdown) already carried this marker; this was
            // the one path that silently didn't.
            const el = createStudio();
            await flushPromises();

            const dslEditor = el.shadowRoot.querySelector('.code-editor');
            dslEditor.value = 'entity Account : Name';
            dslEditor.dispatchEvent(new CustomEvent('input'));
            await new Promise((resolve) => setTimeout(resolve, 300));

            describeObjects.mockResolvedValue([
                {
                    apiName: 'Account',
                    label: 'Account',
                    isCustom: false,
                    fields: [
                        { apiName: 'Name', label: 'Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false },
                        { apiName: 'AnnualRevenue', label: 'Annual Revenue', isRelationship: false, isRollupSummary: false, friendlyType: 'Currency', required: false }
                    ]
                }
            ]);

            el.shadowRoot.querySelector('[data-menu="diagram"]').click();
            await flushPromises();
            const compareItem = Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) =>
                i.textContent.includes('Compare with Org')
            );
            compareItem.click();
            await flushPromises();

            const addBtn = el.shadowRoot.querySelector('.rel-suggest-add[data-field="AnnualRevenue"]');
            expect(addBtn).not.toBeNull();
            addBtn.click();
            await flushPromises();

            expect(el.shadowRoot.querySelector('.code-editor').value).toBe('entity Account : Name, AnnualRevenue[Currency]');
        });

        it('BUG FIX (Add All variant): every field added via Add All also carries its correct marker', async () => {
            const el = createStudio();
            await flushPromises();

            const dslEditor = el.shadowRoot.querySelector('.code-editor');
            dslEditor.value = 'entity Account : Name';
            dslEditor.dispatchEvent(new CustomEvent('input'));
            await new Promise((resolve) => setTimeout(resolve, 300));

            describeObjects.mockResolvedValue([
                {
                    apiName: 'Account',
                    label: 'Account',
                    isCustom: false,
                    fields: [
                        { apiName: 'Name', label: 'Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: false },
                        { apiName: 'AnnualRevenue', label: 'Annual Revenue', isRelationship: false, isRollupSummary: false, friendlyType: 'Currency', required: false },
                        { apiName: 'LastName__c', label: 'Last Name', isRelationship: false, isRollupSummary: false, friendlyType: 'Text', required: true }
                    ]
                }
            ]);

            el.shadowRoot.querySelector('[data-menu="diagram"]').click();
            await flushPromises();
            Array.from(el.shadowRoot.querySelectorAll('.dd-menu-item')).find((i) => i.textContent.includes('Compare with Org')).click();
            await flushPromises();

            const btn = el.shadowRoot.querySelector('.dsl-head-btn[data-entity="Account"]');
            expect(btn).not.toBeNull();
            btn.click();
            await flushPromises();

            const finalValue = el.shadowRoot.querySelector('.code-editor').value;
            expect(finalValue).toContain('AnnualRevenue[Currency]');
            expect(finalValue).toContain('LastName__c[Text, Required]');
        });
    });
});
