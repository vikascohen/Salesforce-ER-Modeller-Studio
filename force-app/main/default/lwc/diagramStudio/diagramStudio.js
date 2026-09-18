/**
 * @author Vikas Cohen
 */
import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadScript } from 'lightning/platformResourceLoader';
import SHEETJS from '@salesforce/resourceUrl/sheetjs';
import { refreshApex } from '@salesforce/apex';
import listFiles      from '@salesforce/apex/DiagramFileController.listFiles';
import getFile        from '@salesforce/apex/DiagramFileController.getFile';
import saveFile       from '@salesforce/apex/DiagramFileController.saveFile';
import deleteFile     from '@salesforce/apex/DiagramFileController.deleteFile';
import renameFile     from '@salesforce/apex/DiagramFileController.renameFile';
import saveDiagramAsFile from '@salesforce/apex/DiagramFileController.saveDiagramAsFile';
import describeObjects   from '@salesforce/apex/SchemaMetadataController.describeObjects';
import getAllObjectNames  from '@salesforce/apex/SchemaMetadataController.getAllObjectNames';
import getSharingModels   from '@salesforce/apex/SchemaMetadataController.getSharingModels';
import getRecordCounts    from '@salesforce/apex/SchemaMetadataController.getRecordCounts';
import describeObjectsForDictionary from '@salesforce/apex/SchemaMetadataController.describeObjectsForDictionary';
import getFieldUsageStats from '@salesforce/apex/SchemaMetadataController.getFieldUsageStats';
import getTheme  from '@salesforce/apex/DiagramPreferenceController.getTheme';
import saveTheme from '@salesforce/apex/DiagramPreferenceController.saveTheme';
import { exportSvgAsPng } from 'c/diagramExportUtils';
import { ER_SAMPLE, parseEr, buildErGeometry, buildLegendGroup, buildMermaidErDiagram, buildDrawioXml } from 'c/erDiagramLogic';

// ── page-size options for the export modal ──
const EXPORT_SIZE_OPTIONS = [
    { label: 'PNG  –  native diagram size',   value: 'PNG' },
    { label: 'A4 Landscape  (1123 × 794 px)', value: 'A4'  },
    { label: 'A3 Landscape  (1587 × 1123 px)', value: 'A3'  }
];

const SVG_NS = 'http://www.w3.org/2000/svg';

// LWC's template compiler doesn't recognize <marker> (or its refX/markerWidth
// attributes) as valid static markup, so these are still built via the DOM
// API rather than declared in the template. The template marks the <defs>
// container itself with lwc:dom="manual" so this appendChild is supported by
// LWC — scoped to just that empty placeholder, not the whole <svg>, which
// stays fully reactive for the template-driven boxes/connectors inside it.
function injectDefs(defsEl) {
    if (!defsEl || defsEl.childElementCount > 0) return;
    [
        { id: 'er-arrow',        w: 10, h: 10, rx: 8,  ry: 3, d: 'M0,0 L8,3 L0,6',         fill: 'none',          stroke: 'context-stroke' },
        { id: 'er-diamond',      w: 14, h: 10, rx: 12, ry: 3, d: 'M0,3 L6,0 L12,3 L6,6 Z', fill: 'context-stroke', stroke: null },
        { id: 'er-diamond-open', w: 14, h: 10, rx: 12, ry: 3, d: 'M0,3 L6,0 L12,3 L6,6 Z', fill: 'none',          stroke: 'context-stroke' }
    ].forEach(({ id, w, h, rx, ry, d, fill, stroke }) => {
        const m = document.createElementNS(SVG_NS, 'marker');
        m.setAttribute('id', id); m.setAttribute('markerWidth', w); m.setAttribute('markerHeight', h);
        m.setAttribute('refX', rx); m.setAttribute('refY', ry); m.setAttribute('orient', 'auto');
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d); path.setAttribute('fill', fill);
        if (stroke) path.setAttribute('stroke', stroke);
        m.appendChild(path); defsEl.appendChild(m);
    });
}

export default class DiagramStudio extends NavigationMixin(LightningElement) {
    @api diagramId;

    // ── sidebar file list ──
    @track files        = [];
    @track sidebarOpen  = true;
    wiredFilesResult;

    // ── open-tab strip (VS Code style) ──
    @track openTabs = []; // { id, name, dirty, active, renaming, renameValue }

    // ── active diagram state ──
    @track currentId   = null;
    @track fileName    = 'Untitled ER Diagram';
    @track sourceText  = ER_SAMPLE;
    @track errorMessage = '';
    @track isDirty     = false;

    // ── import panel ──
    @track importObjectNames = '';
    @track importPanelOpen   = false;

    // ── palette ──
    @track paletteFilter  = '';
    @track paletteObjects = [];

    // ── export modal ──
    @track exportModalOpen   = false;
    @track exportPageSize    = 'PNG';
    @track exportSaveToFiles = false;
    @track exportBusy        = false;
    exportSizeOptions = EXPORT_SIZE_OPTIONS;

    // ── context menu ──
    @track ctxMenu       = null; // { x, y, fileId, fileName }

    // ── canvas ──
    @track _erBoxes     = [];
    @track erConnectors = [];
    @track svgWidth     = 800;
    @track svgHeight    = 600;

    erPositions       = {};
    boxHeightOverrides = {};
    boxWidthOverrides  = {};
    draggingEntity    = null;
    dragOffsetX       = 0;
    dragOffsetY       = 0;
    @track focusedEntity = null;
    _clickCandidateName  = null;
    _clickStartX = 0;
    _clickStartY = 0;
    resizingEntity    = null;
    resizeStartY      = 0;
    resizeStartHeight = 0;
    resizingWidthEntity = null;
    resizeStartX      = 0;
    resizeStartWidth  = 0;
    draggedObjectName = null;
    renderTimer       = null;
    _focusNameOnNextRender = false;

    // ── DSL editor panel (left, next to the file explorer) ──
    @track dslPanelOpen   = true;
    @track dslPanelWidth  = 460;
    @track dslSuggestions = [];
    @track dslSuggestOpen = false;
    @track dslSuggestActiveIndex = 0;
    @track dslSuggestStyle = '';
    dslReplaceStart      = 0;
    dslReplaceEnd        = 0;
    dslResizing          = false;
    dslResizeStartX      = 0;
    dslResizeStartWidth  = 0;
    objectFieldsCache    = {};
    objectFieldsFetching = {};
    DSL_SUGGEST_WIDTH    = 280; // px — kept in sync with the CSS width of .dsl-suggestions

    // ── smart relationship linter ──
    @track missingRelationshipSuggestions = [];
    dismissedSuggestionKeys = new Set();
    _relScanTimer = null;

    // ── schema drift check ──
    @track driftModalOpen = false;
    @track driftBusy      = false;
    @track driftChecked   = false;
    @track driftResults   = [];

    // ── zoom ──
    @track zoomLevel = 1;

    // ── sharing model view ──
    @track sharingViewOn = false;
    @track sharingModels = {}; // lowercased apiName -> { internal, external } raw sharing model strings
    _sharingFetchTimer = null;

    // ── record-count heatmap ──
    @track heatmapOn = false;
    @track recordCounts = {}; // lowercased apiName -> Integer record count
    _heatmapFetchTimer = null;

    // ── object summary hover card ──
    // Aggregates whatever's already been fetched by the toggles above (plus
    // the field count, always available from the canvas model itself) into
    // one glanceable card on hover — no new Apex calls of its own.
    @track hoverCard = null;
    _hoverTimer = null;

    // ── data dictionary ──
    @track dictionaryOpen       = false;
    @track dictionaryFullScreen = true;
    @track dictionarySearch     = '';
    @track dictionarySelectedObject = null;
    @track dictionaryRow        = null;  // ObjectWrap for the selected object
    @track dictionaryLoading    = false;
    @track dictionaryUsagePending  = false;
    @track dictionaryUsageComputed = false;
    @track dictionarySort = null; // { column, direction } | null
    @track dictionaryExportBusy    = false;
    @track dictionaryExportAllBusy = false;
    @track dictionaryExportAllProgress = '';
    @track openMenu = null; // 'file' | 'diagram' | 'view' | null
    @track currentTheme = 'theme-dark-plus';
    sheetJsLoaded = false;
    sheetJsLoadPromise = null;

    // ────────────────────────────────────────────────────────
    //  Lifecycle
    // ────────────────────────────────────────────────────────

    connectedCallback() {
        window.addEventListener('keydown', this._handleKeyDown = this.handleKeyDown.bind(this));
        window.addEventListener('click',   this._handleGlobalClick = this.handleGlobalClick.bind(this));
        if (this.diagramId) {
            this.loadById(this.diagramId);
        } else {
            this.openNewUnsaved();
        }
        this.loadSavedTheme();
    }

    async loadSavedTheme() {
        const validThemes = ['theme-dark-plus', 'theme-light-plus', 'theme-monokai', 'theme-solarized-light'];
        try {
            const saved = await getTheme();
            if (saved && validThemes.includes(saved)) {
                this.currentTheme = saved;
            }
        } catch (e) {
            // No saved preference yet, or the call failed — keep the default
            // theme rather than blocking startup on this.
        }
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('click',   this._handleGlobalClick);
    }

    renderedCallback() {
        // Marker <defs> (arrowheads/diamonds) are injected into a dedicated
        // lwc:dom="manual" placeholder in the template (see injectDefs above)
        // rather than the whole <svg> — LWC's template compiler doesn't
        // recognize <marker>/refX/markerWidth as valid static markup, and
        // manually inserting into the *whole* SVG via insertBefore (the
        // original approach) triggers an "unsupported without lwc:dom=manual"
        // warning that can't just be silenced by adding that directive to
        // the SVG itself, since that would also disable LWC's reactive
        // rendering for the for:each-driven boxes/connectors living in it.
        injectDefs(this.template.querySelector('svg[data-role="er-svg"] defs'));

        // A <textarea>/<input> stops honoring template-level value={} updates
        // once the user has typed into it at least once (the browser's own
        // "dirty value flag" — a well-known cross-framework quirk, not an
        // LWC-specific one). Typing itself is unaffected (the DOM's value and
        // the tracked property are already identical by the time this runs),
        // but programmatic replacements — Import, New, Clear Canvas, Open,
        // Import-from-Org, switching tabs/diagrams — otherwise silently fail
        // to show on screen after the first keystroke in a session.
        const ta = this.template.querySelector('.code-editor');
        if (ta && ta.value !== (this.sourceText || '')) {
            ta.value = this.sourceText || '';
        }
        const nameInput = this.template.querySelector('.diag-name-input');
        if (nameInput && nameInput.value !== (this.fileName || '') && this.template.activeElement !== nameInput) {
            nameInput.value = this.fileName || '';
        }

        if (this._focusNameOnNextRender && nameInput) {
            this._focusNameOnNextRender = false;
            nameInput.focus();
            nameInput.select();
        }
    }

    // ────────────────────────────────────────────────────────
    //  Wire adapters
    // ────────────────────────────────────────────────────────

    @wire(listFiles)
    wiredFiles(result) {
        this.wiredFilesResult = result;
        if (result.data) {
            this.files = result.data.map((f) => this.toFileRow(f));
        } else if (result.error) {
            this.errorMessage = this.reduceError(result.error);
        }
    }

    @wire(getAllObjectNames)
    wiredObjectNames({ data }) {
        if (data) this.paletteObjects = data;
    }

    // ────────────────────────────────────────────────────────
    //  Getters
    // ────────────────────────────────────────────────────────

    get filteredPaletteObjects() {
        const f = (this.paletteFilter || '').toLowerCase();
        const list = f ? this.paletteObjects.filter((n) => n.toLowerCase().includes(f)) : this.paletteObjects;
        return list.slice(0, 80);
    }

    get svgViewBox() { return `0 0 ${this.svgWidth} ${this.svgHeight}`; }

    get erBoxes() {
        if (!this._erBoxes) return [];
        const focused = this.focusedEntity ? this.focusedEntity.toLowerCase() : null;
        let neighborNames = null;
        if (focused) {
            neighborNames = new Set([focused]);
            (this.erConnectors || []).forEach((c) => {
                if (c.childEntity.toLowerCase() === focused) neighborNames.add(c.parentEntity.toLowerCase());
                if (c.parentEntity.toLowerCase() === focused) neighborNames.add(c.childEntity.toLowerCase());
            });
        }

        return this._erBoxes.map((b) => {
            const pkFields    = b.fields.filter((f) => f.isPrimaryKey);
            const relFields   = b.fields.filter((f) => f.isRelationship);
            const plainFields = b.fields.filter((f) => f.isPlain);
            const isFocused   = !!focused && b.name.toLowerCase() === focused;
            const boxOpacity  = neighborNames && !neighborNames.has(b.name.toLowerCase()) ? '0.15' : '1';

            // Badges render left-to-right in a row just above the box header.
            const badges = [];
            let badgeX = b.x + 14;
            const badgeY = b.y - 10;
            let bodyFill = '#ffffff';

            if (this.heatmapOn) {
                const rc = this.recordCounts[b.name.toLowerCase()];
                if (rc != null) {
                    const heatColor = this.heatColorFor(rc);
                    bodyFill = heatColor;
                    badges.push({
                        id: b.name + '-heat',
                        cx: badgeX, cy: badgeY,
                        fillColor: '#1e1e2e',
                        strokeColor: '#1e1e2e',
                        textColor: '#ffffff',
                        filled: true,
                        code: this.formatCount(rc),
                        title: `${rc.toLocaleString()} record${rc === 1 ? '' : 's'}`
                    });
                    badgeX += 32;
                }
            }

            if (this.sharingViewOn) {
                const sm = this.sharingModels[b.name.toLowerCase()];
                if (sm && sm.internal) {
                    const ib = this.sharingBadgeFor(sm.internal);
                    badges.push({
                        id: b.name + '-int',
                        cx: badgeX, cy: badgeY,
                        fillColor: ib.color, strokeColor: ib.color, textColor: '#ffffff',
                        filled: true,
                        code: ib.code,
                        title: 'Internal sharing: ' + ib.label
                    });
                    badgeX += 30;
                }
                if (sm && sm.external) {
                    const eb = this.sharingBadgeFor(sm.external);
                    badges.push({
                        id: b.name + '-ext',
                        cx: badgeX, cy: badgeY,
                        fillColor: '#ffffff', strokeColor: eb.color, textColor: eb.color,
                        filled: false,
                        code: eb.code,
                        title: 'External sharing: ' + eb.label
                    });
                    badgeX += 30;
                }
            }

            return {
                ...b,
                pkFields,
                relFields,
                plainFields,
                hasHidden:       b.hiddenCount > 0,
                moreLabel:       b.hiddenCount > 0 ? '+' + b.hiddenCount + ' more (drag bottom to expand)' : '',
                xEnd:            b.x + b.width,
                shadowX:         b.x + 3,
                shadowY:         b.y + 4,
                headerBodyY:     b.y + 26,
                dividerY:        b.y + 36,
                deleteTransform: `translate(${b.x + b.width - 16},${b.y + 18})`,
                moreTextY:       b.y + b.height - 8,
                resizeY:         b.y + b.height - 6,
                resizeDotX1:     b.x + b.width / 2 - 18,
                resizeDotX2:     b.x + b.width / 2 + 18,
                resizeLineY:     b.y + b.height - 2,
                resizeRightX:    b.x + b.width - 6,
                resizeRightY:    b.y,
                resizeRightHeight: b.height,
                boxOpacity,
                boxStroke:      isFocused ? '#f5a623' : '#d0d5dd',
                boxStrokeWidth: isFocused ? '3' : '1.5',
                bodyFill,
                badges
            };
        });
    }

    get connectorsView() {
        const focused = this.focusedEntity ? this.focusedEntity.toLowerCase() : null;
        return (this.erConnectors || []).map((c) => {
            const isFocusRelated = !focused || c.childEntity.toLowerCase() === focused || c.parentEntity.toLowerCase() === focused;
            return { ...c, connOpacity: isFocusRelated ? '1' : '0.1' };
        });
    }

    set erBoxes(val) { this._erBoxes = val; }

    get statusLabel() { return this.isDirty ? '●  Unsaved' : '✓  Saved'; }
    get statusClass()  { return this.isDirty ? 'status-label status-dirty' : 'status-label status-saved'; }

    get sidebarClass() { return this.sidebarOpen ? 'sidebar sidebar-open' : 'sidebar sidebar-closed'; }
    get toggleSidebarIcon() { return this.sidebarOpen ? 'utility:chevronleft' : 'utility:chevronright'; }
    get driftHasResults() { return this.driftResults && this.driftResults.length > 0; }
    get driftNoIssues() { return this.driftChecked && !this.driftBusy && !this.driftHasResults; }

    // ── data dictionary ──
    get dictionaryObjectList() {
        const q = (this.dictionarySearch || '').trim().toLowerCase();
        const source = this.paletteObjects || [];
        const list = q ? source.filter((n) => n.toLowerCase().includes(q)) : source;
        return list.map((n) => ({
            name: n,
            rowClass: (this.dictionarySelectedObject && this.dictionarySelectedObject.toLowerCase() === n.toLowerCase())
                ? 'dict-obj-row dict-obj-row-active'
                : 'dict-obj-row'
        }));
    }
    get dictionaryObjectCount() { return this.dictionaryObjectList.length; }
    get dictionaryHasSelection() { return !!this.dictionaryRow; }
    get dictionaryPanelClass() { return this.dictionaryFullScreen ? 'dict-overlay dict-fullscreen' : 'dict-overlay'; }
    get dictionaryFullScreenIcon() { return this.dictionaryFullScreen ? 'utility:contract_alt' : 'utility:expand_alt'; }
    get dictionaryFullScreenLabel() { return this.dictionaryFullScreen ? 'Restore' : 'Full Screen'; }
    get dictionaryObjectTypeText() { return this.dictionaryRow && this.dictionaryRow.isCustom ? 'Custom Object' : 'Standard Object'; }
    get dictionaryFieldCount() { return this.dictionaryRow && this.dictionaryRow.fields ? this.dictionaryRow.fields.length : 0; }
    get dictionaryCalcUsageLabel() { return this.dictionaryUsageComputed ? 'Recalculate Usage %' : 'Calculate Usage %'; }
    getSortedDictionaryFields() {
        const fields = (this.dictionaryRow && this.dictionaryRow.fields) || [];
        if (!this.dictionarySort) return fields;
        const { column, direction } = this.dictionarySort;
        const mult = direction === 'desc' ? -1 : 1;
        const valueOf = (f) => {
            if (column === 'apiName')  return (f.apiName || '').toLowerCase();
            if (column === 'isCustom') return f.isCustom ? 1 : 0;
            if (column === 'required') return f.required ? 1 : 0;
            return '';
        };
        return [...fields].sort((a, b) => {
            const av = valueOf(a);
            const bv = valueOf(b);
            if (av < bv) return -1 * mult;
            if (av > bv) return 1 * mult;
            return 0;
        });
    }

    handleSortDictionary(event) {
        const column = event.currentTarget.dataset.column;
        if (!column) return;
        const current = this.dictionarySort;
        const direction = (current && current.column === column && current.direction === 'asc') ? 'desc' : 'asc';
        this.dictionarySort = { column, direction };
    }

    get dictionaryFieldRows() {
        return this.getSortedDictionaryFields().map((f) => ({
            key: f.apiName,
            apiName: f.apiName,
            label: f.label || '',
            description: f.description || '—',
            dataType: f.dataType || '',
            requiredText: f.required ? 'Yes' : 'No',
            customText: f.isCustom ? 'Yes' : 'No',
            pkText: f.isPrimaryKey ? 'Yes' : 'No',
            fkText: f.isRelationship ? 'Yes' : 'No',
            fkTarget: f.isRelationship ? (f.relatesTo || '—') : '—',
            lastModified: f.lastModifiedDate || '—',
            usageText: f.percentUsed != null ? (Math.round(f.percentUsed * 10) / 10 + '%') : (this.dictionaryUsageComputed ? 'N/A' : '—'),
            rowClass: f.isPrimaryKey ? 'dict-field-row dict-field-pk' : 'dict-field-row'
        }));
    }
    get dictSortArrowApiName() { return this.dictSortArrowFor('apiName'); }
    get dictSortArrowCustom()  { return this.dictSortArrowFor('isCustom'); }
    get dictSortArrowRequired() { return this.dictSortArrowFor('required'); }
    get dictSortClassApiName() { return this.dictSortClassFor('apiName'); }
    get dictSortClassCustom()  { return this.dictSortClassFor('isCustom'); }
    get dictSortClassRequired() { return this.dictSortClassFor('required'); }
    dictSortArrowFor(column) {
        // Always shows something — a faint neutral indicator when this
        // column isn't the active sort (so the user can see up front that
        // clicking it does something), the real direction arrow when it is.
        if (!this.dictionarySort || this.dictionarySort.column !== column) return ' \u21C5';
        return this.dictionarySort.direction === 'asc' ? ' \u25B2' : ' \u25BC';
    }
    dictSortClassFor(column) {
        const active = this.dictionarySort && this.dictionarySort.column === column;
        return active ? 'dict-th-sort dict-th-sort-active' : 'dict-th-sort';
    }

    // ── DSL panel ──
    get dslPanelClass() { return this.dslPanelOpen ? 'dsl-panel dsl-panel-open' : 'dsl-panel dsl-panel-closed'; }
    get dslPanelStyle() { return this.dslPanelOpen ? `width:${this.dslPanelWidth}px` : 'width:0px'; }
    get dslToggleIcon() { return this.dslPanelOpen ? 'utility:chevronleft' : 'utility:chevronright'; }
    get computedSuggestions() {
        return this.dslSuggestions.map((s, i) => ({
            ...s,
            idx: i,
            rowClass: i === this.dslSuggestActiveIndex ? 'dsl-suggest-row dsl-suggest-active' : 'dsl-suggest-row'
        }));
    }

    // ── zoom ──
    get zoomPercentLabel() { return Math.round(this.zoomLevel * 100) + '%'; }
    get svgScaleWrapStyle() {
        return `width:${Math.round(this.svgWidth * this.zoomLevel)}px;height:${Math.round(this.svgHeight * this.zoomLevel)}px;`;
    }
    get svgTransformStyle() {
        return `transform:scale(${this.zoomLevel});transform-origin:0 0;`;
    }

    get hasOpenTabs() { return this.openTabs.length > 0; }
    get noFiles() { return !this.files || this.files.length === 0; }

    get computedTabs() {
        return this.openTabs.map((t) => ({
            ...t,
            tabClass: 'tab' + (t.active ? ' tab-active' : '') + (t.dirty ? ' tab-dirty' : '')
        }));
    }

    stopProp(event) { event.stopPropagation(); }

    clearError() { this.errorMessage = ''; }

    handleClearCanvas() {
        // eslint-disable-next-line no-alert
        if (!window.confirm('Clear the entire canvas? This cannot be undone.')) return;
        this.hideHoverCard(); // every box on the canvas is about to disappear
        this.erPositions  = {};
        this.boxHeightOverrides = {};
        this.boxWidthOverrides  = {};
        this.sourceText   = '';
        this.dismissedSuggestionKeys = new Set();
        this.focusedEntity = null;
        this.resetEmptyCanvas();
        this.svgWidth  = 1600;
        this.svgHeight = 900;
        this.isDirty   = true;
        this._markTabDirty(this.activeTabId, true);
        // Sharing View / Heatmap badge whatever's currently on the canvas —
        // with nothing left on it, leaving them ticked was stale/misleading.
        this.sharingViewOn = false;
        this.heatmapOn = false;
        this.sharingModels = {};
        this.recordCounts = {};
    }

    // An empty canvas is a valid, error-free state — not something to parse.
    resetEmptyCanvas() {
        this._erBoxes     = [];
        this.erConnectors = [];
        this.svgWidth  = 800;
        this.svgHeight = 500;
        this.errorMessage = '';
        this.missingRelationshipSuggestions = [];
    }

    get exportModalSaveDisabled() { return this.exportBusy; }

    // ────────────────────────────────────────────────────────
    //  File row helpers
    // ────────────────────────────────────────────────────────

    toFileRow(f) {
        const isOpen   = this.openTabs.some((t) => t.id === f.id);
        const isActive = f.id === this.currentId;
        return {
            id:       f.id,
            name:     f.name,
            modified: f.lastModified ? f.lastModified.substring(0, 10) : '',
            rowClass: 'file-row' + (isActive ? ' file-row-active' : '') + (isOpen ? ' file-row-open' : '')
        };
    }

    refreshFileList() {
        this.files = this.files.map((f) => this.toFileRow(f));
    }

    // ────────────────────────────────────────────────────────
    //  Tab management
    // ────────────────────────────────────────────────────────

    openNewUnsaved() {
        const tabId = 'new-' + Date.now();
        this.currentId   = null;
        this.fileName    = 'Untitled ER Diagram';
        this.sourceText  = '';
        this.erPositions = {};
        this.boxHeightOverrides = {};
        this.boxWidthOverrides  = {};
        this.isDirty     = false;
        this.zoomLevel   = 1;
        this.dslSuggestOpen = false;
        this.missingRelationshipSuggestions = [];
        this.dismissedSuggestionKeys = new Set();
        this.focusedEntity = null;
        this.resetEmptyCanvas();
        this._addTab({ id: tabId, name: this.fileName, dirty: false, isUnsaved: true });
        this._activateTabId(tabId);
        // Let the user type a name immediately instead of having to notice
        // and click into the name field themselves.
        this._focusNameOnNextRender = true;
    }

    _addTab(tab) {
        // Don't duplicate
        if (this.openTabs.find((t) => t.id === tab.id)) {
            this._activateTabId(tab.id);
            return;
        }
        this.openTabs = [...this.openTabs.map((t) => ({ ...t, active: false })), {
            ...tab,
            active:       true,
            renaming:     false,
            renameValue:  tab.name
        }];
    }

    _activateTabId(tabId) {
        this.openTabs = this.openTabs.map((t) => ({ ...t, active: t.id === tabId }));
    }

    _markTabDirty(tabId, dirty) {
        this.openTabs = this.openTabs.map((t) => t.id === tabId ? { ...t, dirty } : t);
    }

    _renameTabLabel(tabId, name) {
        this.openTabs = this.openTabs.map((t) => t.id === tabId ? { ...t, name, renameValue: name } : t);
    }

    get activeTabId() {
        const t = this.openTabs.find((t) => t.active);
        return t ? t.id : null;
    }

    handleTabClick(event) {
        const tabId = event.currentTarget.dataset.tabid;
        if (tabId === this.activeTabId) return;
        // Save current state before switching? Just mark — state is already in properties
        this._activateTabId(tabId);
        // Find which saved file this tab corresponds to
        const tab = this.openTabs.find((t) => t.id === tabId);
        if (tab && !tab.isUnsaved) {
            this.loadById(tab.id);
        } else if (tab && tab.isUnsaved) {
            this.currentId   = null;
            this.fileName    = tab.name;
            this.sourceText  = '';
            this.erPositions = {};
            this.boxHeightOverrides = {};
            this.boxWidthOverrides  = {};
            this._erBoxes     = [];
            this.erConnectors = [];
            this.isDirty     = tab.dirty;
        }
    }

    handleTabClose(event) {
        event.stopPropagation();
        const tabId = event.currentTarget.dataset.tabid;
        const tab   = this.openTabs.find((t) => t.id === tabId);
        if (tab && tab.dirty) {
            // eslint-disable-next-line no-alert
            if (!window.confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return;
        }
        const remaining = this.openTabs.filter((t) => t.id !== tabId);
        this.openTabs   = remaining;
        if (this.activeTabId === tabId || !remaining.length) {
            if (remaining.length) {
                const last = remaining[remaining.length - 1];
                this._activateTabId(last.id);
                if (!last.isUnsaved) this.loadById(last.id);
                else this.openNewUnsaved();
            } else {
                this.openNewUnsaved();
            }
        }
    }

    // ── Tab rename (double-click) ──

    handleTabDblClick(event) {
        const tabId = event.currentTarget.dataset.tabid;
        this.openTabs = this.openTabs.map((t) => t.id === tabId
            ? { ...t, renaming: true, renameValue: t.name }
            : { ...t, renaming: false });
    }

    handleTabRenameChange(event) {
        const tabId = event.currentTarget.dataset.tabid;
        const val   = event.target.value;
        this.openTabs = this.openTabs.map((t) => t.id === tabId ? { ...t, renameValue: val } : t);
    }

    async handleTabRenameCommit(event) {
        if (event.key && event.key !== 'Enter' && event.key !== 'Escape') return;
        const tabId = event.currentTarget.dataset.tabid;
        const tab   = this.openTabs.find((t) => t.id === tabId);
        if (!tab) return;
        if (event.key === 'Escape') {
            this.openTabs = this.openTabs.map((t) => t.id === tabId ? { ...t, renaming: false } : t);
            return;
        }
        const newName = (tab.renameValue || '').trim() || tab.name;
        this.openTabs = this.openTabs.map((t) => t.id === tabId ? { ...t, renaming: false, name: newName } : t);
        if (tab.id === this.currentId) {
            this.fileName = newName;
            this.isDirty  = true;
            this._markTabDirty(tabId, true);
        }
        // If it's a persisted file, also rename in org
        if (!tab.isUnsaved) {
            try { await renameFile({ fileId: tab.id, newName }); } catch (_) {}
        }
    }

    handleTabRenameBlur(event) {
        this.handleTabRenameCommit(event);
    }

    // ────────────────────────────────────────────────────────
    //  Sidebar toggle
    // ────────────────────────────────────────────────────────

    handleToggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
    }

    // ────────────────────────────────────────────────────────
    //  Keyboard shortcuts
    // ────────────────────────────────────────────────────────

    handleKeyDown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.handleSave();
        }
        if (event.key === 'Escape') {
            this.hideHoverCard();
        }
    }

    handleGlobalClick() {
        if (this.ctxMenu) this.ctxMenu = null;
        if (this.openMenu) this.openMenu = null;
    }

    // ────────────────────────────────────────────────────────
    //  Menu bar — File / Diagram / View
    // ────────────────────────────────────────────────────────

    handleToggleMenu(event) {
        event.stopPropagation();
        const menu = event.currentTarget.dataset.menu;
        this.openMenu = this.openMenu === menu ? null : menu;
    }

    get fileMenuClass()    { return this.openMenu === 'file'    ? 'dd-menu-btn dd-menu-btn-open' : 'dd-menu-btn'; }
    get diagramMenuClass() { return this.openMenu === 'diagram' ? 'dd-menu-btn dd-menu-btn-open' : 'dd-menu-btn'; }
    get viewMenuClass()    { return this.openMenu === 'view'    ? 'dd-menu-btn dd-menu-btn-open' : 'dd-menu-btn'; }
    get rootClass() { return 'er-studio ' + this.currentTheme; }
    // Kept as separate, explicitly-named getters (isThemeX) rather than a
    // single value binding on <select> itself -- LWC reliably re-applies a
    // reactive change to a per-<option> `selected` boolean on every render,
    // but a `value` bound directly on the parent <select> only reliably
    // applies at the very first render. Since the saved theme loads
    // asynchronously (after the initial render), relying on the latter left
    // the dropdown showing the default option even though the actual
    // applied theme (and its colors) were already correct underneath it.
    get isThemeDarkPlus() { return this.currentTheme === 'theme-dark-plus'; }
    get isThemeLightPlus() { return this.currentTheme === 'theme-light-plus'; }
    get isThemeMonokai() { return this.currentTheme === 'theme-monokai'; }
    get isThemeSolarizedLight() { return this.currentTheme === 'theme-solarized-light'; }
    handleThemeChange(event) {
        this.currentTheme = event.target.value;
        saveTheme({ theme: this.currentTheme }).catch((e) => {
            // The theme still applies for this session either way — but
            // surface the failure rather than swallowing it silently, since
            // a silent failure here looks identical to "my theme choice
            // never sticks," which is exactly the bug this is meant to catch.
            this.errorMessage = 'Theme applied, but saving it for next time failed: ' + this.reduceError(e);
        });
    }
    get fileMenuOpen()    { return this.openMenu === 'file'; }
    get diagramMenuOpen() { return this.openMenu === 'diagram'; }
    get viewMenuOpen()    { return this.openMenu === 'view'; }
    get sharingViewMenuText() { return this.sharingViewOn ? 'Sharing View \u2713' : 'Sharing View'; }
    get dictionaryMenuText()  { return this.dictionaryOpen ? 'Data Dictionary \u2713' : 'Data Dictionary'; }
    get heatmapMenuText()     { return this.heatmapOn ? 'Heatmap \u2713' : 'Heatmap'; }

    // Each wraps an existing, already-tested handler — closes the dropdown
    // first, then delegates, so none of the underlying action logic changes.
    handleMenuNew()            { this.openMenu = null; this.handleNew(); }
    handleMenuSave()           { this.openMenu = null; this.handleSave(); }
    handleMenuImport()         { this.openMenu = null; this.handleToggleImport(); }
    handleMenuExport()         { this.openMenu = null; this.handleOpenExport(); }
    handleMenuAutoLayout()     { this.openMenu = null; this.handleAutoLayout(); }
    handleMenuCompareOrg()     { this.openMenu = null; this.handleOpenDriftCheck(); }
    handleMenuClearCanvas()    { this.openMenu = null; this.handleClearCanvas(); }
    handleMenuSharingView()    { this.openMenu = null; this.handleToggleSharingView(); }
    handleMenuDataDictionary() { this.openMenu = null; this.handleToggleDictionary(); }
    handleMenuHeatmap()        { this.openMenu = null; this.handleToggleHeatmap(); }

    // ────────────────────────────────────────────────────────
    //  Toolbar / file actions
    // ────────────────────────────────────────────────────────

    handleNew() {
        this.openNewUnsaved();
    }

    handleNameChange(event) {
        this.fileName = event.target.value;
        this.isDirty  = true;
        this._markTabDirty(this.activeTabId, true);
    }

    async handleSave() {
        try {
            const id = await saveFile({
                fileId:      this.currentId,
                fileName:    this.fileName,
                diagramType: 'ER',
                sourceCode:  this.sourceText
            });
            const wasNew    = !this.currentId;
            this.currentId  = id;
            this.isDirty    = false;
            this.errorMessage = '';
            // Update tab: replace unsaved-tab id with real record id
            const activeId = this.activeTabId;
            if (activeId) {
                this.openTabs = this.openTabs.map((t) => t.id === activeId
                    ? { ...t, id: wasNew ? id : t.id, name: this.fileName, dirty: false, isUnsaved: false }
                    : t);
            }
            await refreshApex(this.wiredFilesResult);
            this.refreshFileList();
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    async handleOpen(event) {
        const id = event.currentTarget.dataset.id;
        // If already open in a tab, just switch to it
        if (this.openTabs.find((t) => t.id === id)) {
            this._activateTabId(id);
            await this.loadById(id);
            return;
        }
        await this.loadById(id);
    }

    async loadById(id) {
        try {
            const rec = await getFile({ fileId: id });
            if (rec) {
                this.currentId  = rec.Id;
                this.fileName   = rec.Name;
                this.sourceText = rec.Source_Code__c || '';
                this.erPositions = {};
                this.boxHeightOverrides = {};
                this.boxWidthOverrides  = {};
                this.isDirty    = false;
                this.errorMessage = '';
                this.dismissedSuggestionKeys = new Set();
                this.focusedEntity = null;
                this.renderDiagram();
                this._addTab({ id: rec.Id, name: rec.Name, dirty: false, isUnsaved: false });
                this._activateTabId(rec.Id);
                this.refreshFileList();
            } else {
                this.errorMessage = `No saved diagram found for Id "${id}".`;
            }
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    async handleDeleteFile(event) {
        event.stopPropagation();
        const id   = event.currentTarget.dataset.id;
        const file = this.files.find((f) => f.id === id);
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete "${file ? file.name : id}"? This cannot be undone.`)) return;
        try {
            await deleteFile({ fileId: id });
            // Close tab if open
            this.openTabs = this.openTabs.filter((t) => t.id !== id);
            if (id === this.currentId) this.openNewUnsaved();
            await refreshApex(this.wiredFilesResult);
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    // ── Context menu (right-click on file row) ──

    handleFileContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        const id   = event.currentTarget.dataset.id;
        const file = this.files.find((f) => f.id === id);
        this.ctxMenu = { x: event.clientX, y: event.clientY, fileId: id, fileName: file ? file.name : '' };
    }

    get ctxMenuStyle() {
        if (!this.ctxMenu) return '';
        return `left:${this.ctxMenu.x}px;top:${this.ctxMenu.y}px`;
    }

    async handleCtxOpen() {
        const id = this.ctxMenu.fileId;
        this.ctxMenu = null;
        await this.loadById(id);
    }

    async handleCtxDuplicate() {
        const id = this.ctxMenu.fileId;
        this.ctxMenu = null;
        const rec = await getFile({ fileId: id });
        if (!rec) return;
        const newName = rec.Name + ' (copy)';
        await saveFile({ fileId: null, fileName: newName, diagramType: 'ER', sourceCode: rec.Source_Code__c });
        await refreshApex(this.wiredFilesResult);
    }

    async handleCtxDelete() {
        const id   = this.ctxMenu.fileId;
        const name = this.ctxMenu.fileName;
        this.ctxMenu = null;
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteFile({ fileId: id });
            this.openTabs = this.openTabs.filter((t) => t.id !== id);
            if (id === this.currentId) this.openNewUnsaved();
            await refreshApex(this.wiredFilesResult);
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    // ── Copy ID ──

    handleCopyId() {
        if (!this.currentId) return;
        if (navigator.clipboard) navigator.clipboard.writeText(this.currentId).catch(() => {});
    }

    // ────────────────────────────────────────────────────────
    //  Import panel
    // ────────────────────────────────────────────────────────

    handleToggleImport() {
        this.importPanelOpen = !this.importPanelOpen;
    }

    handleImportNamesChange(event) {
        this.importObjectNames = event.target.value;
    }

    async handleImportSchema() {
        const names = this.importObjectNames.split(',').map((n) => n.trim()).filter(Boolean);
        if (!names.length) { this.errorMessage = 'Enter one or more object API names, e.g. Account, Contact'; return; }
        try {
            const objects = await describeObjects({ objectApiNames: names });
            if (!objects || !objects.length) { this.errorMessage = 'No matching objects found, or you lack access.'; return; }
            this.sourceText = this.buildErSource(objects);
            this.isDirty    = true;
            this.erPositions = {};
            this.boxHeightOverrides = {};
            this.boxWidthOverrides  = {};
            this.dismissedSuggestionKeys = new Set();
            this.focusedEntity = null;
            this.errorMessage = '';
            this.importPanelOpen = false;
            this._markTabDirty(this.activeTabId, true);
            this.renderDiagram();
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    // Shared by buildErSource() and the DSL autocomplete (detectDslContext,
    // the "entity Name : field1, <partial>" case) so the exact same
    // "[Type, Required]" bracket text is generated whichever way a field
    // ends up in the DSL — importing an object and picking a field from
    // the intellisense dropdown produce byte-identical output for the
    // same field, not two similar-but-separately-maintained versions of
    // this logic that could drift apart over time.
    buildFieldMarkerSuffix(f) {
        const markers = [];
        if (f.isRollupSummary) markers.push('rollup');
        else if (f.friendlyType) markers.push(f.friendlyType);
        if (f.required) markers.push('Required');
        return markers.length ? `[${markers.join(', ')}]` : '';
    }

    // presentNamesOverride: normally presentNames is just the names of the
    // objects passed in (the full Import from Org case, rebuilding DSL for
    // all of them). addEntityByDrop() passes only the one newly dropped
    // object here, but still needs relationships to whatever's ALREADY on
    // the canvas to wire correctly — hence the override, covering every
    // entity name currently present, not just the one being described.
    buildErSource(objects, presentNamesOverride) {
        const presentNames = presentNamesOverride || new Set(objects.map((o) => o.apiName));
        const lines = [];
        objects.forEach((o) => {
            const plain = o.fields
                .filter((f) => !f.isRelationship)
                .slice() // sort a copy — don't mutate the shared fields array
                // Required fields first, in a stable sort — everything with
                // equal required-ness keeps its original relative order
                // (JS's Array.sort has been a stable sort since ES2019, in
                // every engine this app runs on), so this only ever
                // reorders required-vs-not, nothing else.
                .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
                .map((f) => `${f.apiName}${this.buildFieldMarkerSuffix(f)}`);
            lines.push(`entity ${o.apiName} : ${plain.join(', ')}`);
        });
        lines.push('');
        objects.forEach((o) => {
            o.fields.filter((f) => f.isRelationship && presentNames.has(f.relatesTo)).forEach((f) => {
                const a = f.relationshipType === 'Master-Detail' ? '=>' : f.relationshipType === 'Polymorphic Lookup' ? '~>' : '->';
                lines.push(`${o.apiName}.${f.apiName} ${a} ${f.relatesTo}`);
            });
        });
        return lines.join('\n');
    }

    // ────────────────────────────────────────────────────────
    //  Export modal
    // ────────────────────────────────────────────────────────

    handleOpenExport() {
        this.exportModalOpen   = true;
        this.exportPageSize    = 'PNG';
        this.exportSaveToFiles = false;
        this.exportBusy        = false;
    }

    handleCloseExport() {
        this.exportModalOpen = false;
    }

    handleExportSizeChange(event) {
        this.exportPageSize = event.target.value;
    }

    handleExportSaveToFilesChange(event) {
        this.exportSaveToFiles = event.target.checked;
    }

    handleCopyMermaid() {
        try {
            const mmd = buildMermaidErDiagram(parseEr(this.sourceText));
            if (navigator.clipboard) navigator.clipboard.writeText(mmd).catch(() => {});
        } catch (e) {
            this.errorMessage = 'Could not build Mermaid diagram: ' + e.message;
        }
    }

    handleDownloadMermaid() {
        try {
            const mmd = buildMermaidErDiagram(parseEr(this.sourceText));
            const safeName = (this.fileName || 'diagram').replace(/\s+/g, '-');
            const dataUri  = 'data:text/plain;charset=utf-8,' + encodeURIComponent(mmd);
            const a = document.createElement('a');
            a.href = dataUri;
            a.download = safeName + '.mmd';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            this.errorMessage = 'Could not build Mermaid diagram: ' + e.message;
        }
    }

    handleCopyDrawio() {
        try {
            const xml = buildDrawioXml(parseEr(this.sourceText), this._erBoxes);
            if (navigator.clipboard) navigator.clipboard.writeText(xml).catch(() => {});
        } catch (e) {
            this.errorMessage = 'Could not build draw.io diagram: ' + e.message;
        }
    }

    handleDownloadDrawio() {
        try {
            const xml = buildDrawioXml(parseEr(this.sourceText), this._erBoxes);
            const safeName = (this.fileName || 'diagram').replace(/\s+/g, '-');
            const dataUri  = 'data:application/xml;charset=utf-8,' + encodeURIComponent(xml);
            const a = document.createElement('a');
            a.href = dataUri;
            a.download = safeName + '.drawio';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            this.errorMessage = 'Could not build draw.io diagram: ' + e.message;
        }
    }

    async handleDoExport() {
        this.exportBusy = true;
        try {
            const liveSvg  = this.template.querySelector('svg[data-role="er-svg"]');
            const safeName = (this.fileName || 'diagram').replace(/\s+/g, '-');

            // Clone so the legend can be baked into the export without touching
            // the live, interactive canvas (which shows it as an HTML overlay).
            const exportSvg = liveSvg.cloneNode(true);
            exportSvg.appendChild(buildLegendGroup(this.svgWidth, this.svgHeight));

            // Render SVG → base64 PNG (pure canvas, no download attempted here)
            const base64 = await exportSvgAsPng(exportSvg, this.exportPageSize);

            // Save PNG to Salesforce Files — this is the LWS-safe way to deliver a download
            const cvId = await saveDiagramAsFile({
                diagramFileId: this.currentId || null,
                fileName:      safeName,
                pngBase64:     base64,
                pageSize:      this.exportPageSize
            });

            this.exportModalOpen = false;
            this.errorMessage = '';

            // Navigate to the ContentVersion download URL — triggers browser file download
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: '/sfc/servlet.shepherd/version/download/' + cvId
                }
            });
        } catch (e) {
            this.errorMessage = 'Export failed: ' + (e.message || JSON.stringify(e));
        } finally {
            this.exportBusy = false;
        }
    }

    // ────────────────────────────────────────────────────────
    //  Palette drag & drop
    // ────────────────────────────────────────────────────────

    handlePaletteFilterChange(event) {
        this.paletteFilter = event.target.value;
    }

    handlePaletteDragStart(event) {
        const name = event.currentTarget.dataset.name;
        this.draggedObjectName = name;
        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', name);
            event.dataTransfer.effectAllowed = 'copy';
        }
    }

    handleCanvasDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    async handleCanvasDrop(event) {
        event.preventDefault();
        const name = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || this.draggedObjectName;
        this.draggedObjectName = null;
        if (!name) return;
        const svg = this.template.querySelector('svg[data-role="er-svg"]');
        const pt  = this.toSvgPoint(svg, event.clientX, event.clientY);
        await this.addEntityByDrop(name, pt.x, pt.y);
    }

    async addEntityByDrop(name, x, y) {
        try {
            let existingNames = [];
            if (this.sourceText.trim()) {
                try { existingNames = parseEr(this.sourceText).entities.map((e) => e.name); } catch (_) {}
            }
            if (existingNames.includes(name)) return;

            // Describe ONLY the newly dropped entity, never re-describe and
            // rebuild the whole DSL from the org — that would silently
            // overwrite any entity already on the canvas back to its full,
            // as-described field list, discarding a manually trimmed-down
            // field list the user had typed for it. Existing entities are
            // appended to, never regenerated, unless the user deletes and
            // re-adds them.
            const objects = await describeObjects({ objectApiNames: [name] });
            if (!objects || !objects.length) { this.errorMessage = `Could not find "${name}", or you lack access.`; return; }
            const newObject = objects[0];

            this.erPositions[name] = { x: x - 120, y: y - 18 };
            const newLines = this.buildErSource([newObject], new Set([...existingNames, name]));
            this.sourceText = (this.sourceText.trim() ? this.sourceText.trimEnd() + '\n\n' : '') + newLines;
            this.isDirty    = true;
            this._markTabDirty(this.activeTabId, true);
            this.errorMessage = '';
            this.renderDiagram();
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    // ────────────────────────────────────────────────────────
    //  Delete entity from canvas
    // ────────────────────────────────────────────────────────

    handleDeleteEntity(event) {
        event.stopPropagation();
        this.hideHoverCard(); // the box under the cursor is about to disappear
        const name = event.currentTarget.dataset.name;
        try {
            const filtered = this.sourceText.split('\n').filter((line) => {
                const t = line.trim();
                if (!t || t.startsWith('#')) return true;
                const em = t.match(/^entity\s+(\w+)/i);
                if (em && em[1].toLowerCase() === name.toLowerCase()) return false;
                const rm = t.match(/^(\w+)\.(\w+)\s*(=>|~>|->)\s*(\w+)\s*$/);
                if (rm && (rm[1].toLowerCase() === name.toLowerCase() || rm[4].toLowerCase() === name.toLowerCase())) return false;
                return true;
            });
            const remaining  = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            const hasEntity  = /^\s*entity\s+\w+/im.test(remaining);
            delete this.erPositions[name];
            delete this.boxHeightOverrides[name];
            delete this.boxWidthOverrides[name];
            this.isDirty    = true;
            this._markTabDirty(this.activeTabId, true);
            if (!hasEntity) {
                // Deleting the last entity on the canvas is the same end state as
                // Clear Canvas — an empty, error-free canvas, not a parse failure.
                this.erPositions = {};
                this.boxHeightOverrides = {};
                this.boxWidthOverrides  = {};
                this.sourceText = '';
                this.resetEmptyCanvas();
            } else {
                this.sourceText = remaining;
                this.errorMessage = '';
                this.renderDiagram();
            }
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    // ────────────────────────────────────────────────────────
    //  Box drag (move) — pointer captured on the SVG element
    // ────────────────────────────────────────────────────────

    handleBoxPointerDown(event) {
        if (event.target.dataset.role === 'resize') return;
        const name = event.currentTarget.dataset.name;
        const box  = this._erBoxes && this._erBoxes.find((b) => b.name === name);
        if (!box) return;
        this.hideHoverCard(); // don't leave a stale tooltip sitting over a box being dragged
        this.draggingEntity = name;
        this._clickCandidateName = name;
        this._clickStartX = event.clientX;
        this._clickStartY = event.clientY;
        // Capture on the SVG so pointermove fires even when cursor leaves the box
        const svg = this.template.querySelector('svg[data-role="er-svg"]');
        svg.setPointerCapture(event.pointerId);
        const pt = this.toSvgPoint(svg, event.clientX, event.clientY);
        this.dragOffsetX = pt.x - box.x;
        this.dragOffsetY = pt.y - box.y;
    }

    // Called from SVG onpointermove
    handleSvgPointerMove(event) {
        if (this.resizingEntity) {
            const dy    = event.clientY - this.resizeStartY;
            this.boxHeightOverrides[this.resizingEntity] = Math.max(60, this.resizeStartHeight + dy);
            this.rerenderGeometry();
            return;
        }
        if (!this.draggingEntity) return;
        const svg = this.template.querySelector('svg[data-role="er-svg"]');
        const pt  = this.toSvgPoint(svg, event.clientX, event.clientY);
        this.erPositions[this.draggingEntity] = {
            x: Math.max(0, pt.x - this.dragOffsetX),
            y: Math.max(0, pt.y - this.dragOffsetY)
        };
        this.rerenderGeometry();
    }

    // Called from SVG onpointerup / onpointerleave
    handleSvgPointerUp(event) {
        const wasDraggingBox = !!this.draggingEntity;
        if (this.draggingEntity || this.resizingEntity) {
            const svg = this.template.querySelector('svg[data-role="er-svg"]');
            try { svg.releasePointerCapture(event.pointerId); } catch (_) {}
        }
        // Distinguish a click (toggle focus) from a drag (position already moved) —
        // only counts as a click if the pointer barely moved between down and up.
        if (wasDraggingBox && this._clickCandidateName) {
            const dx = event.clientX - this._clickStartX;
            const dy = event.clientY - this._clickStartY;
            if (Math.sqrt(dx * dx + dy * dy) < 4) {
                this.toggleFocusEntity(this._clickCandidateName);
            }
        }
        this._clickCandidateName = null;
        this.draggingEntity  = null;
        this.resizingEntity  = null;
    }

    // Keep these stubs so old html attribute references don't error
    handleBoxPointerMove() {}
    handleBoxPointerUp()   {}

    // ────────────────────────────────────────────────────────
    //  Focus mode — click an entity to fade everything except it and
    //  its direct relationships; click empty canvas to release.
    // ────────────────────────────────────────────────────────

    toggleFocusEntity(name) {
        this.focusedEntity = this.focusedEntity === name ? null : name;
    }

    handleCanvasBackgroundClick() {
        this.focusedEntity = null;
    }

    // ────────────────────────────────────────────────────────
    //  Box resize — also captured on SVG
    // ────────────────────────────────────────────────────────

    handleResizePointerDown(event) {
        event.stopPropagation();
        const name = event.currentTarget.dataset.name;
        const box  = this._erBoxes && this._erBoxes.find((b) => b.name === name);
        if (!box) return;
        this.resizingEntity    = name;
        this.resizeStartY      = event.clientY;
        this.resizeStartHeight = box.height;
        // Capture on the element that received the event so pointermove tracks globally
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
    }

    handleResizePointerMove(event) {
        if (!this.resizingEntity) return;
        event.stopPropagation();
        const dy = event.clientY - this.resizeStartY;
        const newH = this.resizeStartHeight + dy;
        // Minimum: just the header (36px) so user can shrink to tiny
        this.boxHeightOverrides[this.resizingEntity] = Math.max(36, newH);
        this.rerenderGeometry();
    }

    handleResizePointerUp(event) {
        if (!this.resizingEntity) return;
        event.stopPropagation();
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) {}
        this.resizingEntity = null;
    }

    // ────────────────────────────────────────────────────────
    //  Box horizontal resize (right edge)
    // ────────────────────────────────────────────────────────

    handleResizeRightPointerDown(event) {
        event.stopPropagation();
        const name = event.currentTarget.dataset.name;
        const box  = this._erBoxes && this._erBoxes.find((b) => b.name === name);
        if (!box) return;
        this.resizingWidthEntity = name;
        this.resizeStartX        = event.clientX;
        this.resizeStartWidth    = box.width;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
    }

    handleResizeRightPointerMove(event) {
        if (!this.resizingWidthEntity) return;
        event.stopPropagation();
        const dx = event.clientX - this.resizeStartX;
        this.boxWidthOverrides[this.resizingWidthEntity] = Math.max(80, this.resizeStartWidth + dx);
        this.rerenderGeometry();
    }

    handleResizeRightPointerUp(event) {
        if (!this.resizingWidthEntity) return;
        event.stopPropagation();
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) {}
        this.resizingWidthEntity = null;
    }

    // ────────────────────────────────────────────────────────
    //  DSL panel — toggle & resize
    // ────────────────────────────────────────────────────────

    handleToggleDslPanel() {
        this.dslPanelOpen = !this.dslPanelOpen;
        if (!this.dslPanelOpen) this.dslSuggestOpen = false;
    }

    handleDslResizePointerDown(event) {
        this.dslResizing         = true;
        this.dslResizeStartX     = event.clientX;
        this.dslResizeStartWidth = this.dslPanelWidth;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
    }

    handleDslResizePointerMove(event) {
        if (!this.dslResizing) return;
        const dx = event.clientX - this.dslResizeStartX;
        this.dslPanelWidth = Math.min(900, Math.max(280, this.dslResizeStartWidth + dx));
    }

    handleDslResizePointerUp(event) {
        if (!this.dslResizing) return;
        this.dslResizing = false;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) {}
    }

    // ────────────────────────────────────────────────────────
    //  Zoom
    // ────────────────────────────────────────────────────────

    handleZoomIn()    { this.zoomLevel = Math.min(2.5, Math.round((this.zoomLevel + 0.1) * 100) / 100); }
    handleZoomOut()   { this.zoomLevel = Math.max(0.3, Math.round((this.zoomLevel - 0.1) * 100) / 100); }
    handleZoomReset() { this.zoomLevel = 1; }

    // ────────────────────────────────────────────────────────
    //  Sharing model view — badges each box with its org-wide default
    //  sharing model (from EntityDefinition). A Master-Detail child
    //  naturally comes back as 'ControlledByParent', which is exactly
    //  what shows that its sharing is inherited rather than independent.
    // ────────────────────────────────────────────────────────

    handleToggleSharingView() {
        this.sharingViewOn = !this.sharingViewOn;
        if (this.sharingViewOn) this.scheduleSharingFetch();
    }

    scheduleSharingFetch() {
        clearTimeout(this._sharingFetchTimer);
        this._sharingFetchTimer = setTimeout(() => this.fetchSharingModels(), 300);
    }

    async fetchSharingModels() {
        if (!this.sharingViewOn || !this._erBoxes || !this._erBoxes.length) return;
        try {
            const names = this._erBoxes.map((b) => b.name);
            const fresh = await getSharingModels({ objectApiNames: names });
            const next = {};
            Object.keys(fresh || {}).forEach((name) => {
                next[name.toLowerCase()] = {
                    internal: fresh[name] ? fresh[name].internalModel : null,
                    external: fresh[name] ? fresh[name].externalModel : null
                };
            });
            this.sharingModels = next;
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    sharingBadgeFor(model) {
        const map = {
            Private:                   { code: 'PR',  color: '#c0392b', label: 'Private' },
            Read:                      { code: 'RO',  color: '#d68910', label: 'Public Read Only' },
            ReadWrite:                 { code: 'RW',  color: '#1a7f37', label: 'Public Read/Write' },
            ReadWriteTransfer:         { code: 'RWT', color: '#1a7f37', label: 'Public Read/Write/Transfer' },
            FullAccess:                { code: 'FA',  color: '#1a7f37', label: 'Full Access' },
            ControlledByParent:        { code: 'CP',  color: '#0070d2', label: 'Controlled by Parent (inherits sharing)' },
            ControlledByCampaign:      { code: 'CC',  color: '#0070d2', label: 'Controlled by Campaign' },
            ControlledByLeadOrContact: { code: 'CL',  color: '#0070d2', label: 'Controlled by Lead/Contact' }
        };
        return map[model] || { code: '?', color: '#8896a6', label: model ? model : 'Unknown / not available' };
    }

    // ────────────────────────────────────────────────────────
    //  Record-count heatmap — colors each box by relative record volume
    //  among whatever's currently on the canvas, with the actual count
    //  badged at the top. Same opt-in-and-cache-nothing pattern as
    //  Sharing View: toggle on, fetch for the current canvas, refetch
    //  whenever the diagram's content changes while it's still on.
    // ────────────────────────────────────────────────────────

    handleToggleHeatmap() {
        this.heatmapOn = !this.heatmapOn;
        if (this.heatmapOn) this.scheduleHeatmapFetch();
    }

    scheduleHeatmapFetch() {
        clearTimeout(this._heatmapFetchTimer);
        this._heatmapFetchTimer = setTimeout(() => this.fetchRecordCounts(), 300);
    }

    async fetchRecordCounts() {
        if (!this.heatmapOn || !this._erBoxes || !this._erBoxes.length) return;
        try {
            const names = this._erBoxes.map((b) => b.name);
            const fresh = await getRecordCounts({ objectApiNames: names });
            const next = {};
            Object.keys(fresh || {}).forEach((name) => { next[name.toLowerCase()] = fresh[name]; });
            this.recordCounts = next;
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    // Cool blue (fewest records, relative to what's on canvas) through
    // yellow to hot red (most records) — the conventional heat-map scale,
    // not a reuse of the app's red=error/green=success semantic colors.
    // Binary by design, not a gradient: light blue for any object that has
    // at least one record, light orange for genuinely empty ones. A relative
    // gradient looked informative but was actually harder to read at a
    // glance than a simple "has data / doesn't" signal.
    heatColorFor(count) {
        return count > 0 ? '#cfe8fb' : '#fde3cc';
    }

    formatCount(n) {
        if (n >= 1000000) return Math.round(n / 100000) / 10 + 'M';
        if (n >= 1000) return Math.round(n / 100) / 10 + 'K';
        return String(n);
    }

    // ────────────────────────────────────────────────────────
    //  Object summary hover card
    // ────────────────────────────────────────────────────────

    handleBoxMouseEnter(event) {
        const name = event.currentTarget.dataset.name;
        if (!name) return;
        const clientX = event.clientX;
        const clientY = event.clientY;
        clearTimeout(this._hoverTimer);
        this._hoverTimer = setTimeout(() => this.showHoverCard(name, clientX, clientY), 350);
    }

    handleBoxMouseLeave() {
        this.hideHoverCard();
    }

    hideHoverCard() {
        clearTimeout(this._hoverTimer);
        this.hoverCard = null;
    }

    showHoverCard(name, clientX, clientY) {
        const box = this._erBoxes && this._erBoxes.find((b) => b.name === name);
        if (!box) return;
        const key = name.toLowerCase();

        const recordCount = this.recordCounts[key];
        const sharing     = this.sharingModels[key];

        this.hoverCard = {
            name,
            style: `left:${clientX + 16}px;top:${clientY + 12}px`,
            fieldCount: box.fields.length,
            objectTypeText: name.endsWith('__c') ? 'Custom Object' : 'Standard Object',

            hasRecordData: this.heatmapOn && recordCount != null,
            recordCountText: recordCount != null ? recordCount.toLocaleString() : '',

            hasSharingData: this.sharingViewOn && !!sharing,
            internalSharingText: sharing && sharing.internal ? this.sharingBadgeFor(sharing.internal).label : 'Unknown',
            externalSharingText: sharing && sharing.external ? this.sharingBadgeFor(sharing.external).label : 'None configured'
        };
    }

    // ────────────────────────────────────────────────────────
    //  Data Dictionary
    // ────────────────────────────────────────────────────────

    handleToggleDictionary() {
        this.dictionaryOpen = !this.dictionaryOpen;
        this.hideHoverCard(); // a hover triggered right before opening could still be pending
    }

    handleCloseDictionary() {
        this.dictionaryOpen = false;
        this.hideHoverCard();
    }

    handleToggleDictionaryFullScreen() {
        this.dictionaryFullScreen = !this.dictionaryFullScreen;
    }

    handleDictionarySearchInput(event) {
        this.dictionarySearch = event.target.value;
    }

    handleSelectDictionaryObject(event) {
        const name = event.currentTarget.dataset.name;
        if (name) this.openDictionaryForObject(name);
    }

    // Every call to openDictionaryForObject() or Clear bumps this. Each
    // in-flight request captures its own token at start and checks it's
    // still the current one before applying its result — a plain name
    // comparison (the previous guard) can't tell two separate requests
    // for the *same* object apart, and depends on exact string matching
    // holding up across every call site; a counter can't have either gap.
    _dictionaryRequestToken = 0;

    async openDictionaryForObject(name) {
        const myToken = ++this._dictionaryRequestToken;
        this.dictionarySelectedObject = name;
        this.dictionaryRow = null;
        this.dictionaryUsageComputed = false;
        this.dictionarySort = null;
        this.dictionaryLoading = true;
        try {
            const rows = await describeObjectsForDictionary({ objectApiNames: [name] });
            // The user may have hit Clear, or picked a different (or even
            // the same) object again, while this was in flight — a slow
            // response arriving after that must not silently repopulate or
            // overwrite what's on screen now. Bail out rather than
            // applying a stale result.
            if (myToken !== this._dictionaryRequestToken) return;
            this.dictionaryRow = (rows && rows.length) ? rows[0] : null;
            if (!this.dictionaryRow) {
                this.errorMessage = `"${name}" could not be described — it may not exist or you may not have access to it.`;
            }
        } catch (e) {
            if (myToken !== this._dictionaryRequestToken) return;
            this.errorMessage = this.reduceError(e);
        } finally {
            if (myToken === this._dictionaryRequestToken) {
                this.dictionaryLoading = false;
            }
        }
    }

    // Resets the right-hand detail pane back to "nothing selected" without
    // touching the left-hand object list — the object stays selectable
    // again from the list on the left. Bumping the token here (not just
    // nulling state) is what actually invalidates any in-flight request —
    // without it, a response landing right after Clear would still pass a
    // stale "is this the current object" check based on state alone.
    handleClearDictionarySelection() {
        this._dictionaryRequestToken++;
        this.dictionarySelectedObject = null;
        this.dictionaryRow = null;
        this.dictionaryUsageComputed = false;
        this.dictionarySort = null;
        this.dictionaryLoading = false;
    }

    async handleCalculateUsage() {
        if (!this.dictionaryRow) return;
        this.dictionaryUsagePending = true;
        try {
            const fieldNames = this.dictionaryRow.fields.filter((f) => !f.isPrimaryKey).map((f) => f.apiName);
            const stats = await getFieldUsageStats({ objectApiName: this.dictionaryRow.apiName, fieldApiNames: fieldNames });
            const pct = (stats && stats.percentages) || {};
            this.dictionaryRow = {
                ...this.dictionaryRow,
                fields: this.dictionaryRow.fields.map((f) => ({
                    ...f,
                    percentUsed: f.isPrimaryKey ? 100 : (pct[f.apiName] != null ? pct[f.apiName] : null)
                }))
            };
            this.dictionaryUsageComputed = true;
            if (stats && stats.error) this.errorMessage = stats.error;
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        } finally {
            this.dictionaryUsagePending = false;
        }
    }

    // ── Excel / CSV export ──

    async ensureSheetJs() {
        if (this.sheetJsLoaded) return;
        if (!this.sheetJsLoadPromise) this.sheetJsLoadPromise = loadScript(this, SHEETJS);
        await this.sheetJsLoadPromise;
        this.sheetJsLoaded = true;
    }

    buildDictSheetAoA(objectWrap) {
        const header = ['Field API Name', 'Label', 'Description', 'Data Type', 'Required', 'Custom', 'Primary Key', 'Foreign Key', 'Foreign Key To', 'Last Modified', '% Used'];
        const rows = [header];
        (objectWrap.fields || []).forEach((f) => {
            rows.push([
                f.apiName,
                f.label || '',
                f.description || '',
                f.dataType || '',
                f.required ? 'Yes' : 'No',
                f.isCustom ? 'Yes' : 'No',
                f.isPrimaryKey ? 'Yes' : 'No',
                f.isRelationship ? 'Yes' : 'No',
                f.isRelationship ? (f.relatesTo || '') : '',
                f.lastModifiedDate || '',
                f.percentUsed != null ? Math.round(f.percentUsed * 10) / 10 + '%' : ''
            ]);
        });
        return rows;
    }

    csvEscape(val) {
        const s = val == null ? '' : String(val);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    downloadTextFile(content, filename, mime) {
        const dataUri = `data:${mime};charset=utf-8,` + encodeURIComponent(content);
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    safeSheetName(name) {
        let s = (name || 'Sheet').replace(/[:\\/?*[\]]/g, '_');
        if (s.length > 31) s = s.substring(0, 31);
        return s || 'Sheet';
    }

    // Single-object export respects whatever sort is currently applied to
    // the table (that's the point of asking for it); bulk Export All has no
    // per-object sort selection to respect, so it stays in natural order.
    getDictionaryRowForExport() {
        return { ...this.dictionaryRow, fields: this.getSortedDictionaryFields() };
    }

    handleExportDictionaryCsv() {
        if (!this.dictionaryRow) return;
        const rows = this.buildDictSheetAoA(this.getDictionaryRowForExport());
        const csv = rows.map((r) => r.map((cell) => this.csvEscape(cell)).join(',')).join('\n');
        this.downloadTextFile(csv, this.dictionaryRow.apiName + '-dictionary.csv', 'text/csv');
    }

    async handleExportDictionaryXlsx() {
        if (!this.dictionaryRow) return;
        this.dictionaryExportBusy = true;
        try {
            await this.ensureSheetJs();
            const wb = window.XLSX.utils.book_new();
            const ws = window.XLSX.utils.aoa_to_sheet(this.buildDictSheetAoA(this.getDictionaryRowForExport()));
            window.XLSX.utils.book_append_sheet(wb, ws, this.safeSheetName(this.dictionaryRow.apiName));
            window.XLSX.writeFile(wb, this.dictionaryRow.apiName + '-dictionary.xlsx');
        } catch (e) {
            this.errorMessage = 'Could not export to Excel: ' + (e.message || JSON.stringify(e));
        } finally {
            this.dictionaryExportBusy = false;
        }
    }

    async handleExportAllDictionary() {
        this.dictionaryExportAllBusy = true;
        this.dictionaryExportAllProgress = 'Loading object list...';
        try {
            await this.ensureSheetJs();
            const allNames = this.paletteObjects || [];
            const wb = window.XLSX.utils.book_new();
            const usedSheetNames = new Set();
            const chunkSize = 10;

            for (let i = 0; i < allNames.length; i += chunkSize) {
                const chunk = allNames.slice(i, i + chunkSize);
                this.dictionaryExportAllProgress = `Describing objects ${i + 1}\u2013${Math.min(i + chunkSize, allNames.length)} of ${allNames.length}...`;
                // eslint-disable-next-line no-await-in-loop
                const rows = await describeObjectsForDictionary({ objectApiNames: chunk });
                (rows || []).forEach((ow) => {
                    let sheetName = this.safeSheetName(ow.apiName);
                    let suffix = 1;
                    while (usedSheetNames.has(sheetName.toLowerCase())) {
                        sheetName = this.safeSheetName(ow.apiName).substring(0, 28) + '_' + suffix;
                        suffix++;
                    }
                    usedSheetNames.add(sheetName.toLowerCase());
                    const ws = window.XLSX.utils.aoa_to_sheet(this.buildDictSheetAoA(ow));
                    window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
                });
            }

            this.dictionaryExportAllProgress = 'Building workbook...';
            window.XLSX.writeFile(wb, 'data-dictionary-all-objects.xlsx');
        } catch (e) {
            this.errorMessage = 'Could not export all objects: ' + (e.message || JSON.stringify(e));
        } finally {
            this.dictionaryExportAllBusy = false;
            this.dictionaryExportAllProgress = '';
        }
    }

    // ────────────────────────────────────────────────────────
    //  Auto layout / copy DSL
    // ────────────────────────────────────────────────────────

    handleAutoLayout() {
        this.erPositions       = {};
        this.boxHeightOverrides = {};
        this.boxWidthOverrides  = {};
        this.renderDiagram();
        this.isDirty = true;
        this._markTabDirty(this.activeTabId, true);
    }

    handleExportDsl() {
        const content  = this.sourceText || '';
        const safeName = (this.fileName || 'diagram').replace(/\s+/g, '-');
        const dataUri  = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = safeName + '.dsl';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    handleImportDslClick() {
        const input = this.template.querySelector('.dsl-file-input');
        if (input) input.click();
    }

    handleImportDslFile(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = ''; // allow re-importing the same filename later
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.sourceText = String(reader.result || '');
            // A freshly-imported file is treated as a new layout — don't carry
            // over box positions/sizes from whatever was on the canvas before.
            this.erPositions       = {};
            this.boxHeightOverrides = {};
            this.boxWidthOverrides  = {};
            this.dismissedSuggestionKeys = new Set();
            this.focusedEntity = null;
            this.isDirty = true;
            this._markTabDirty(this.activeTabId, true);
            this.renderDiagram(); // parses + draws, and sets errorMessage on failure
            if (this.errorMessage) {
                this.errorMessage = `Could not import "${file.name}": ${this.errorMessage}`;
            }
        };
        reader.onerror = () => {
            this.errorMessage = `Could not read file "${file.name}".`;
        };
        reader.readAsText(file);
    }

    // ────────────────────────────────────────────────────────
    //  DSL editor — typing, debounced render, intellisense
    // ────────────────────────────────────────────────────────

    handleTextChange(event) {
        this.sourceText = event.target.value;
        this.isDirty    = true;
        this._markTabDirty(this.activeTabId, true);
        clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => this.renderDiagram(), 200);
        this.updateDslSuggestions(event.target);
    }

    handleDslClick(event) {
        this.updateDslSuggestions(event.target);
    }

    handleDslScroll() {
        this.dslSuggestOpen = false;
    }

    handleDslBlur() {
        // Delay so a suggestion click (mousedown fires first) still registers.
        setTimeout(() => { this.dslSuggestOpen = false; }, 150);
    }

    handleDslKeyDown(event) {
        if (this.dslSuggestOpen && this.dslSuggestions.length) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.dslSuggestActiveIndex = (this.dslSuggestActiveIndex + 1) % this.dslSuggestions.length;
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.dslSuggestActiveIndex = (this.dslSuggestActiveIndex - 1 + this.dslSuggestions.length) % this.dslSuggestions.length;
                return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                this.applySuggestionAtIndex(this.dslSuggestActiveIndex, event.target);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.dslSuggestOpen = false;
                return;
            }
        }
        // Tab with no suggestion open: insert 2 spaces instead of jumping focus away.
        if (event.key === 'Tab') {
            event.preventDefault();
            const ta    = event.target;
            const start = ta.selectionStart;
            const end   = ta.selectionEnd;
            const next  = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
            ta.value = next;
            ta.setSelectionRange(start + 2, start + 2);
            this.sourceText = next;
            this.isDirty    = true;
            this._markTabDirty(this.activeTabId, true);
            clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(() => this.renderDiagram(), 200);
        }
    }

    handleSuggestionMouseDown(event) {
        // Prevent the textarea's blur from closing the list before the click lands.
        event.preventDefault();
    }

    handleSuggestionClick(event) {
        const idx = Number(event.currentTarget.dataset.index);
        const ta  = this.template.querySelector('.code-editor');
        this.applySuggestionAtIndex(idx, ta);
    }

    applySuggestionAtIndex(idx, textareaEl) {
        const suggestion = this.dslSuggestions[idx];
        if (!suggestion || !textareaEl) { this.dslSuggestOpen = false; return; }
        const value  = this.sourceText || '';
        const before = value.substring(0, this.dslReplaceStart);
        const after  = value.substring(this.dslReplaceEnd);
        const insert = suggestion.insertText + (suggestion.appendText || '');
        const next   = before + insert + after;
        const caretPos = before.length + insert.length;

        textareaEl.value = next;
        textareaEl.setSelectionRange(caretPos, caretPos);
        textareaEl.focus();

        this.sourceText  = next;
        this.isDirty     = true;
        this._markTabDirty(this.activeTabId, true);
        this.dslSuggestOpen = false;

        clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => this.renderDiagram(), 150);

        // Re-apply the selection once LWC's re-render settles the DOM value.
        Promise.resolve().then(() => {
            try { textareaEl.setSelectionRange(caretPos, caretPos); } catch (_) {}
        });

        // Only chain into another suggestion when the pick was a single token
        // (keyword/object/field name) the user would naturally keep typing from.
        // A pick that auto-appended an arrow+target already completed a whole
        // line, so don't immediately reopen suggestions on top of it.
        if (!suggestion.appendText) this.updateDslSuggestions(textareaEl);
    }

    updateDslSuggestions(textareaEl) {
        if (!textareaEl) { this.dslSuggestOpen = false; return; }
        const text  = textareaEl.value;
        const caret = textareaEl.selectionStart;
        const lineStart   = text.lastIndexOf('\n', caret - 1) + 1;
        const linePrefix  = text.substring(lineStart, caret);

        const ctx = this.detectDslContext(linePrefix, text, lineStart);
        if (!ctx || !ctx.items || !ctx.items.length) {
            this.dslSuggestOpen = false;
            this.dslSuggestions = [];
            return;
        }
        this.dslReplaceStart      = ctx.replaceStart;
        this.dslReplaceEnd        = caret;
        this.dslSuggestions       = ctx.items;
        this.dslSuggestActiveIndex = 0;
        this.dslSuggestStyle      = this.computeDslSuggestStyle(textareaEl, caret);
        this.dslSuggestOpen       = true;
    }

    measureCharWidth(font) {
        if (!this._charWidthCache) this._charWidthCache = {};
        if (this._charWidthCache[font] != null) return this._charWidthCache[font];
        if (!this._measureCanvas) this._measureCanvas = document.createElement('canvas');
        const ctx = this._measureCanvas.getContext('2d');
        ctx.font = font;
        const w = ctx.measureText('0').width || 7;
        this._charWidthCache[font] = w;
        return w;
    }

    /**
     * Pixel position for the suggestions dropdown, anchored just under the
     * caret. The editor disables line-wrapping (white-space: pre, horizontal
     * scroll instead) so every DSL line is exactly one visual row — that
     * means caret position is plain monospace-grid arithmetic (row/column ×
     * char size) rather than needing a full mirror-element measurement.
     */
    computeDslSuggestStyle(textareaEl, caret) {
        const cs = getComputedStyle(textareaEl);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const charWidth  = this.measureCharWidth(font);
        const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padTop  = parseFloat(cs.paddingTop)  || 0;

        const before = textareaEl.value.substring(0, caret);
        const row = (before.match(/\n/g) || []).length;
        const col = caret - before.lastIndexOf('\n') - 1;

        const rawX = textareaEl.offsetLeft + padLeft + col * charWidth - textareaEl.scrollLeft;
        const rawY = textareaEl.offsetTop + padTop + (row + 1) * lineHeight - textareaEl.scrollTop;

        // Keep the dropdown from running past the panel's own right edge.
        const maxLeft = Math.max(4, this.dslPanelWidth - this.DSL_SUGGEST_WIDTH - 20);
        const x = Math.min(Math.max(4, rawX), maxLeft);
        const y = Math.max(4, rawY);

        return `left:${Math.round(x)}px; top:${Math.round(y)}px; width:${this.DSL_SUGGEST_WIDTH}px;`;
    }

    detectDslContext(linePrefix, fullText, lineStart) {
        let m;

        // 1) Partial "entity" keyword at the start of an otherwise-empty line.
        m = linePrefix.match(/^([A-Za-z]{0,6})$/);
        if (m && m[1].length > 0 && 'entity'.startsWith(m[1].toLowerCase())) {
            return {
                replaceStart: lineStart,
                items: [{ id: 'kw-entity', label: 'entity', detail: 'Declare an entity', insertText: 'entity ' }]
            };
        }

        // 2) entity <partial object name>
        m = linePrefix.match(/^entity\s+([A-Za-z0-9_]*)$/i);
        if (m) {
            const partial = m[1].toLowerCase();
            const start   = lineStart + m[0].length - m[1].length;
            const items = this.paletteObjects
                .filter((n) => n.toLowerCase().startsWith(partial))
                .slice(0, 50)
                .map((n) => ({ id: 'obj-' + n, label: n, detail: 'Object', insertText: n }));
            return { replaceStart: start, items };
        }

        // 3) entity Name : field1, field2, <partial field>
        m = linePrefix.match(/^entity\s+([A-Za-z0-9_]+)\s*:\s*(?:[A-Za-z0-9_]+\s*,\s*)*([A-Za-z0-9_]*)$/i);
        if (m) {
            const entityName = m[1];
            const partial    = m[2].toLowerCase();
            const start      = lineStart + m[0].length - m[2].length;
            const afterColon = linePrefix.split(':')[1] || '';
            const already    = new Set(afterColon.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
            const cached = this.objectFieldsCache[entityName.toLowerCase()];
            this.ensureFieldsCached(entityName);
            const items = (cached || [])
                .filter((f) => f.apiName.toLowerCase().startsWith(partial) && !already.has(f.apiName.toLowerCase()))
                .slice(0, 50)
                .map((f) => ({
                    id: 'fld-' + f.apiName,
                    label: f.apiName,
                    detail: f.isRelationship ? 'Lookup field' : 'Field',
                    // Same marker text buildErSource() would generate for
                    // this exact field — picking it from the dropdown and
                    // importing the object it belongs to produce identical
                    // DSL, not two different representations of the same field.
                    insertText: f.apiName + this.buildFieldMarkerSuffix(f)
                }));
            return { replaceStart: start, items };
        }

        // 4) Child.<partial field> — relationship source field
        m = linePrefix.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]*)$/);
        if (m) {
            const entityName = m[1];
            const partial    = m[2].toLowerCase();
            const start      = lineStart + m[0].length - m[2].length;
            const cached = this.objectFieldsCache[entityName.toLowerCase()];
            this.ensureFieldsCached(entityName);
            const items = (cached || [])
                .filter((f) => f.isRelationship && f.apiName.toLowerCase().startsWith(partial))
                .slice(0, 50)
                .map((f) => {
                    const arrow = f.relationshipType === 'Master-Detail' ? '=>' : f.relationshipType === 'Polymorphic Lookup' ? '~>' : '->';
                    return {
                        id: 'relfld-' + f.apiName,
                        label: f.apiName,
                        detail: `${f.relationshipType} → ${f.relatesTo}`,
                        insertText: f.apiName,
                        appendText: ` ${arrow} ${f.relatesTo}`
                    };
                });
            return { replaceStart: start, items };
        }

        // 5) Child.Field <partial arrow>
        m = linePrefix.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s+([=\-~]{0,2}>?)$/);
        if (m) {
            const typed = m[3];
            const start = lineStart + m[0].length - typed.length;
            const arrows = [
                { arrow: '=>', detail: 'Master-Detail' },
                { arrow: '->', detail: 'Lookup' },
                { arrow: '~>', detail: 'Polymorphic Lookup' }
            ].filter((a) => typed === '' || a.arrow.startsWith(typed));
            const items = arrows.map((a) => ({ id: 'arrow-' + a.arrow, label: a.arrow, detail: a.detail, insertText: a.arrow + ' ' }));
            return { replaceStart: start, items };
        }

        // 6) Child.Field => <partial parent entity>
        m = linePrefix.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*(=>|->|~>)\s*([A-Za-z0-9_]*)$/);
        if (m) {
            const partial   = m[4].toLowerCase();
            const start     = lineStart + m[0].length - m[4].length;
            const declared  = this.declaredEntityNames(fullText);
            const names     = Array.from(new Set([...declared, ...this.paletteObjects]));
            const items = names
                .filter((n) => n.toLowerCase().startsWith(partial))
                .slice(0, 50)
                .map((n) => ({ id: 'target-' + n, label: n, detail: declared.includes(n) ? 'On canvas' : 'Object', insertText: n }));
            return { replaceStart: start, items };
        }

        return null;
    }

    declaredEntityNames(text) {
        const names = [];
        const re = /^\s*entity\s+([A-Za-z0-9_]+)/gim;
        let m;
        while ((m = re.exec(text)) !== null) names.push(m[1]);
        return Array.from(new Set(names));
    }

    async ensureFieldsCached(entityName) {
        const key = entityName.toLowerCase();
        if (this.objectFieldsCache[key] || this.objectFieldsFetching[key]) return;
        this.objectFieldsFetching[key] = true;
        try {
            const objects = await describeObjects({ objectApiNames: [entityName] });
            this.objectFieldsCache[key] = (objects && objects.length) ? objects[0].fields : [];
            // Re-run detection so a still-open, matching context picks up the fetched fields.
            const ta = this.template.querySelector('.code-editor');
            if (ta) this.updateDslSuggestions(ta);
        } catch (_) {
            this.objectFieldsCache[key] = [];
        } finally {
            delete this.objectFieldsFetching[key];
        }
    }

    // ────────────────────────────────────────────────────────
    //  Smart relationship linter — notices relationship fields on
    //  entities already on the canvas that point at another entity also
    //  on the canvas, but aren't wired up as a DSL relationship line yet.
    // ────────────────────────────────────────────────────────

    scheduleRelationshipScan() {
        clearTimeout(this._relScanTimer);
        this._relScanTimer = setTimeout(() => this.scanForMissingRelationships(), 600);
    }

    async scanForMissingRelationships() {
        if (!this._erBoxes || !this._erBoxes.length) {
            this.missingRelationshipSuggestions = [];
            return;
        }
        const boxes = this._erBoxes;
        // Make sure every entity currently on canvas has its schema fetched
        // (a no-op for anything already cached, or anything that isn't a
        // real org object — that just resolves to an empty field list).
        await Promise.all(boxes.map((b) => this.ensureFieldsCached(b.name)));

        let model;
        try {
            model = parseEr(this.sourceText);
        } catch (_) {
            return; // mid-typing / invalid DSL — leave whatever suggestions were showing
        }

        const canvasNames = new Set(boxes.map((b) => b.name.toLowerCase()));
        const existing = new Set(
            model.relationships.map((r) =>
                [r.childEntity.toLowerCase(), r.childField.toLowerCase(), r.parentEntity.toLowerCase()].join('|')
            )
        );

        const suggestions = [];
        boxes.forEach((box) => {
            const fields = this.objectFieldsCache[box.name.toLowerCase()] || [];
            fields.forEach((f) => {
                if (!f.isRelationship || !f.relatesTo) return;
                if (!canvasNames.has(f.relatesTo.toLowerCase())) return; // target isn't on canvas — nothing to suggest
                const key = [box.name.toLowerCase(), f.apiName.toLowerCase(), f.relatesTo.toLowerCase()].join('|');
                if (existing.has(key) || this.dismissedSuggestionKeys.has(key)) return;
                const arrow = f.relationshipType === 'Master-Detail' ? '=>' : f.relationshipType === 'Polymorphic Lookup' ? '~>' : '->';
                suggestions.push({
                    id: key,
                    label: `${box.name}.${f.apiName} ${arrow} ${f.relatesTo}`,
                    line: `${box.name}.${f.apiName} ${arrow} ${f.relatesTo}`
                });
            });
        });
        this.missingRelationshipSuggestions = suggestions;
    }

    handleAddSuggestion(event) {
        const line = event.currentTarget.dataset.line;
        this.appendDslLines([line]);
    }

    handleAddAllSuggestions() {
        this.appendDslLines(this.missingRelationshipSuggestions.map((s) => s.line));
    }

    handleDismissSuggestions() {
        this.missingRelationshipSuggestions.forEach((s) => this.dismissedSuggestionKeys.add(s.id));
        this.missingRelationshipSuggestions = [];
    }

    appendDslLines(lines) {
        const trimmed = (this.sourceText || '').replace(/\s+$/, '');
        this.sourceText = (trimmed ? trimmed + '\n' : '') + lines.join('\n') + '\n';
        this.isDirty = true;
        this._markTabDirty(this.activeTabId, true);
        this.renderDiagram();
    }

    // ────────────────────────────────────────────────────────
    //  Schema drift check — re-describes every entity on canvas that
    //  maps to a real org object, right now, and compares the FRESH
    //  schema against what the diagram currently says, to catch fields
    //  added/removed/renamed in the org since the diagram was authored.
    //  Unlike the linter's cache (fetch once, reuse), this always fetches
    //  fresh — that's the whole point — and then refreshes the shared
    //  cache too, so intellisense/linter immediately benefit from it.
    // ────────────────────────────────────────────────────────

    handleOpenDriftCheck() {
        this.driftModalOpen = true;
        this.driftResults   = [];
        this.driftChecked   = false;
        this.checkSchemaDrift();
    }

    handleCloseDriftModal() {
        this.driftModalOpen = false;
    }

    async checkSchemaDrift() {
        let model;
        try {
            model = parseEr(this.sourceText);
        } catch (e) {
            this.driftModalOpen = false;
            this.errorMessage = e.message;
            return;
        }

        this.driftBusy = true;
        try {
            const entityNames = model.entities.map((e) => e.name);
            const objects = await describeObjects({ objectApiNames: entityNames });
            const freshByName = {};
            (objects || []).forEach((o) => {
                const key = o.apiName.toLowerCase();
                freshByName[key] = o.fields;
                this.objectFieldsCache[key] = o.fields; // refresh the shared cache too
            });

            const results = [];
            model.entities.forEach((ent) => {
                const fresh = freshByName[ent.name.toLowerCase()];
                if (!fresh) return; // not a real/accessible org object — nothing to compare, skip quietly

                const dslFieldNames   = new Set(ent.fields.map((f) => f.name.toLowerCase()));
                const freshFieldNames = new Set(fresh.map((f) => f.apiName.toLowerCase()));

                const newFields     = fresh.filter((f) => !dslFieldNames.has(f.apiName.toLowerCase()));
                const missingFields = ent.fields.filter((f) => !freshFieldNames.has(f.name.toLowerCase()));

                if (newFields.length || missingFields.length) {
                    results.push({
                        entityName: ent.name,
                        newFields: newFields.map((f) => ({ id: ent.name + '-new-' + f.apiName, name: f.apiName })),
                        missingFields: missingFields.map((f) => ({ id: ent.name + '-miss-' + f.name, name: f.name }))
                    });
                }
            });

            this.driftResults = results;
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        } finally {
            this.driftBusy    = false;
            this.driftChecked = true;
        }
    }

    handleAddDriftField(event) {
        const entityName = event.currentTarget.dataset.entity;
        const fieldName  = event.currentTarget.dataset.field;
        this.addFieldToEntity(entityName, fieldName);
        this.removeDriftEntry(entityName, 'newFields', fieldName);
    }

    handleAddAllDriftFields(event) {
        const entityName = event.currentTarget.dataset.entity;
        const result = this.driftResults.find((r) => r.entityName === entityName);
        if (!result) return;
        result.newFields.forEach((f) => this.addFieldToEntity(entityName, f.name, /* skipRender */ true));
        this.renderDiagram();
        this.driftResults = this.driftResults
            .map((r) => (r.entityName === entityName ? { ...r, newFields: [] } : r))
            .filter((r) => r.newFields.length || r.missingFields.length);
    }

    handleRemoveDriftField(event) {
        const entityName = event.currentTarget.dataset.entity;
        const fieldName  = event.currentTarget.dataset.field;
        this.removeFieldFromEntity(entityName, fieldName);
        this.removeDriftEntry(entityName, 'missingFields', fieldName);
    }

    removeDriftEntry(entityName, key, fieldName) {
        this.driftResults = this.driftResults
            .map((r) => {
                if (r.entityName !== entityName) return r;
                return { ...r, [key]: r[key].filter((f) => f.name !== fieldName) };
            })
            .filter((r) => r.newFields.length || r.missingFields.length);
    }

    addFieldToEntity(entityName, fieldName, skipRender) {
        const lines = this.sourceText.split('\n');
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^(\s*entity\s+)([A-Za-z0-9_]+)(\s*:\s*)?(.*)$/i);
            if (m && m[2].toLowerCase() === entityName.toLowerCase()) {
                found = true;
                const existing = (m[4] || '').trim();
                lines[i] = `${m[1]}${m[2]} : ${existing ? existing + ', ' : ''}${fieldName}`;
                break;
            }
        }
        if (!found) lines.push(`entity ${entityName} : ${fieldName}`);
        this.sourceText = lines.join('\n');
        this.isDirty = true;
        this._markTabDirty(this.activeTabId, true);
        if (!skipRender) this.renderDiagram();
    }

    removeFieldFromEntity(entityName, fieldName) {
        const lines = this.sourceText.split('\n').map((line) => {
            const m = line.match(/^(\s*entity\s+)([A-Za-z0-9_]+)(\s*:\s*)(.*)$/i);
            if (m && m[2].toLowerCase() === entityName.toLowerCase()) {
                const remaining = m[4].split(',').map((f) => f.trim()).filter((f) => f && f.toLowerCase() !== fieldName.toLowerCase());
                return remaining.length ? `${m[1]}${m[2]}${m[3]}${remaining.join(', ')}` : `${m[1]}${m[2]}`;
            }
            return line;
        }).filter((line) => {
            const t = line.trim();
            const rm = t.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*(=>|~>|->)/);
            return !(rm && rm[1].toLowerCase() === entityName.toLowerCase() && rm[2].toLowerCase() === fieldName.toLowerCase());
        });
        this.sourceText = lines.join('\n');
        this.isDirty = true;
        this._markTabDirty(this.activeTabId, true);
        this.renderDiagram();
    }

    // ────────────────────────────────────────────────────────
    //  Geometry helpers
    // ────────────────────────────────────────────────────────

    rerenderGeometry() {
        if (!this.sourceText || !this.sourceText.trim()) { this.resetEmptyCanvas(); return; }
        try {
            const geo = buildErGeometry(parseEr(this.sourceText), this.erPositions, this.boxHeightOverrides, this.boxWidthOverrides);
            this._erBoxes     = geo.boxes;
            this.erConnectors = geo.connectors;
            this.svgWidth     = geo.svgWidth;
            this.svgHeight    = geo.svgHeight;
        } catch (_) {}
    }

    renderDiagram() {
        if (!this.sourceText || !this.sourceText.trim()) { this.resetEmptyCanvas(); return; }
        try {
            const geo = buildErGeometry(parseEr(this.sourceText), this.erPositions, this.boxHeightOverrides, this.boxWidthOverrides);
            this._erBoxes     = geo.boxes;
            this.erConnectors = geo.connectors;
            this.svgWidth     = geo.svgWidth;
            this.svgHeight    = geo.svgHeight;
            geo.boxes.forEach((b) => {
                if (!this.erPositions[b.name]) this.erPositions[b.name] = { x: b.x, y: b.y };
            });
            this.errorMessage = '';
            this.scheduleRelationshipScan();
            if (this.sharingViewOn) this.scheduleSharingFetch();
            if (this.heatmapOn) this.scheduleHeatmapFetch();
        } catch (e) {
            this.errorMessage = e.message;
        }
    }

    toSvgPoint(svg, clientX, clientY) {
        // SVG is rendered at exact svgWidth × svgHeight logical pixels, then
        // visually scaled by zoomLevel via a CSS transform — divide back out
        // so drag/resize/drop math stays correct at any zoom level.
        const rect = svg.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / this.zoomLevel,
            y: (clientY - rect.top) / this.zoomLevel
        };
    }

    reduceError(err) {
        if (Array.isArray(err.body))                      return err.body.map((e) => e.message).join(', ');
        if (err.body && typeof err.body.message === 'string') return err.body.message;
        return err.message ? err.message : JSON.stringify(err);
    }
}
