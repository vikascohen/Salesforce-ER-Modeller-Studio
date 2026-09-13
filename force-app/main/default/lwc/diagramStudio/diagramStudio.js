/**
 * @author Vikas Cohen
 */
import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import listFiles      from '@salesforce/apex/DiagramFileController.listFiles';
import getFile        from '@salesforce/apex/DiagramFileController.getFile';
import saveFile       from '@salesforce/apex/DiagramFileController.saveFile';
import deleteFile     from '@salesforce/apex/DiagramFileController.deleteFile';
import renameFile     from '@salesforce/apex/DiagramFileController.renameFile';
import saveDiagramAsFile from '@salesforce/apex/DiagramFileController.saveDiagramAsFile';
import describeObjects   from '@salesforce/apex/SchemaMetadataController.describeObjects';
import getAllObjectNames  from '@salesforce/apex/SchemaMetadataController.getAllObjectNames';
import { exportSvgAsPng } from 'c/diagramExportUtils';
import { ER_SAMPLE, parseEr, buildErGeometry, buildLegendGroup } from 'c/erDiagramLogic';

const SVG_NS = 'http://www.w3.org/2000/svg';

function injectDefs(svg) {
    if (!svg || svg.querySelector('defs')) return;
    const defs = document.createElementNS(SVG_NS, 'defs');
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
        m.appendChild(path); defs.appendChild(m);
    });
    svg.insertBefore(defs, svg.firstChild);
}

// ── page-size options for the export modal ──
const EXPORT_SIZE_OPTIONS = [
    { label: 'PNG  –  native diagram size',   value: 'PNG' },
    { label: 'A4 Landscape  (1123 × 794 px)', value: 'A4'  },
    { label: 'A3 Landscape  (1587 × 1123 px)', value: 'A3'  }
];

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
    resizingEntity    = null;
    resizeStartY      = 0;
    resizeStartHeight = 0;
    resizingWidthEntity = null;
    resizeStartX      = 0;
    resizeStartWidth  = 0;
    draggedObjectName = null;
    renderTimer       = null;

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

    // ── zoom ──
    @track zoomLevel = 1;

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
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('click',   this._handleGlobalClick);
    }

    renderedCallback() {
        injectDefs(this.template.querySelector('svg[data-role="er-svg"]'));

        // A <textarea> stops honoring template-level value={} updates once the
        // user has typed into it at least once (the browser's own "dirty value
        // flag" — a well-known cross-framework quirk, not an LWC-specific one).
        // Typing itself is unaffected (the DOM's own value and this.sourceText
        // are already identical by the time this runs, so this is a no-op) —
        // this only kicks in for programmatic replacements like Import, New,
        // Clear Canvas, etc., which otherwise silently fail to show on screen.
        const ta = this.template.querySelector('.code-editor');
        if (ta && ta.value !== (this.sourceText || '')) {
            ta.value = this.sourceText || '';
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
        return this._erBoxes.map((b) => {
            const pkFields    = b.fields.filter((f) => f.isPrimaryKey);
            const relFields   = b.fields.filter((f) => f.isRelationship);
            const plainFields = b.fields.filter((f) => f.isPlain);
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
                resizeRightHeight: b.height
            };
        });
    }

    set erBoxes(val) { this._erBoxes = val; }

    get statusLabel() { return this.isDirty ? '●  Unsaved' : '✓  Saved'; }
    get statusClass()  { return this.isDirty ? 'status-label status-dirty' : 'status-label status-saved'; }

    get sidebarClass() { return this.sidebarOpen ? 'sidebar sidebar-open' : 'sidebar sidebar-closed'; }
    get toggleSidebarIcon() { return this.sidebarOpen ? 'utility:chevronleft' : 'utility:chevronright'; }

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
        this.erPositions  = {};
        this.boxHeightOverrides = {};
        this.boxWidthOverrides  = {};
        this.sourceText   = '';
        this.resetEmptyCanvas();
        this.svgWidth  = 1600;
        this.svgHeight = 900;
        this.isDirty   = true;
        this._markTabDirty(this.activeTabId, true);
    }

    // An empty canvas is a valid, error-free state — not something to parse.
    resetEmptyCanvas() {
        this._erBoxes     = [];
        this.erConnectors = [];
        this.svgWidth  = 800;
        this.svgHeight = 500;
        this.errorMessage = '';
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
        this.resetEmptyCanvas();
        this._addTab({ id: tabId, name: this.fileName, dirty: false, isUnsaved: true });
        this._activateTabId(tabId);
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
    }

    handleGlobalClick() {
        if (this.ctxMenu) this.ctxMenu = null;
    }

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
            this.errorMessage = '';
            this.importPanelOpen = false;
            this._markTabDirty(this.activeTabId, true);
            this.renderDiagram();
        } catch (e) {
            this.errorMessage = this.reduceError(e);
        }
    }

    buildErSource(objects) {
        const presentNames = new Set(objects.map((o) => o.apiName));
        const lines = [];
        objects.forEach((o) => {
            const plain = o.fields.filter((f) => !f.isRelationship).map((f) => f.apiName);
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
            const allNames = Array.from(new Set([...existingNames, name]));
            const objects  = await describeObjects({ objectApiNames: allNames });
            if (!objects || !objects.length) { this.errorMessage = `Could not find "${name}", or you lack access.`; return; }
            this.erPositions[name] = { x: x - 120, y: y - 18 };
            this.sourceText = this.buildErSource(objects);
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
        this.draggingEntity = name;
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
        if (this.draggingEntity || this.resizingEntity) {
            const svg = this.template.querySelector('svg[data-role="er-svg"]');
            try { svg.releasePointerCapture(event.pointerId); } catch (_) {}
        }
        this.draggingEntity  = null;
        this.resizingEntity  = null;
    }

    // Keep these stubs so old html attribute references don't error
    handleBoxPointerMove() {}
    handleBoxPointerUp()   {}

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
                .map((f) => ({ id: 'fld-' + f.apiName, label: f.apiName, detail: f.isRelationship ? 'Lookup field' : 'Field', insertText: f.apiName }));
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
