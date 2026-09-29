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
import getSharingSignal   from '@salesforce/apex/SchemaMetadataController.getSharingSignal';
import getRecordCount     from '@salesforce/apex/SchemaMetadataController.getRecordCount';
import describeObjectsForDictionary from '@salesforce/apex/SchemaMetadataController.describeObjectsForDictionary';
import getFieldUsageStats from '@salesforce/apex/SchemaMetadataController.getFieldUsageStats';
import getSchemaReferences from '@salesforce/apex/SchemaMetadataController.getSchemaReferences';
import getTheme  from '@salesforce/apex/DiagramPreferenceController.getTheme';
import saveTheme from '@salesforce/apex/DiagramPreferenceController.saveTheme';
import fieldUsageGetObjects from '@salesforce/apex/FieldUsageController.getObjects';
import fieldUsageGetFields from '@salesforce/apex/FieldUsageController.getFields';
import fieldUsageGetEvidence from '@salesforce/apex/FieldUsageController.getEvidence';
import fieldUsageGetEvidenceSummary from '@salesforce/apex/FieldUsageController.getEvidenceSummary';
import fieldUsageGetEvidenceDetail from '@salesforce/apex/FieldUsageController.getEvidenceDetail';
import fieldUsageRunNow from '@salesforce/apex/FieldUsageController.runNow';
import fieldUsageBootstrap from '@salesforce/apex/FieldUsageController.bootstrap';
import fieldUsageGetStatus from '@salesforce/apex/FieldUsageController.getStatus';
import fieldUsageSaveSchedules from '@salesforce/apex/FieldUsageController.saveSchedules';
import fieldUsageDeleteSchedule from '@salesforce/apex/FieldUsageController.deleteSchedule';
import fieldUsageGetScheduledJobs from '@salesforce/apex/FieldUsageController.getScheduledJobs';
import fieldUsagePauseSchedule from '@salesforce/apex/FieldUsageController.pauseSchedule';
import fieldUsageResumeSchedule from '@salesforce/apex/FieldUsageController.resumeSchedule';
import fieldImpactSnapshot from '@salesforce/apex/FieldUsageController.getSnapshotAvailability';
import fieldImpactObjects from '@salesforce/apex/FieldUsageController.getSnapshotObjects';
import fieldUsageSearchEvidence from '@salesforce/apex/FieldUsageController.searchEvidence';
import fieldUsageGetSourceTypes from '@salesforce/apex/FieldUsageController.getSourceTypes';
import { exportSvgAsPng, exportArchitectureReportAsPng, exportArchitectureReportAsPdf } from 'c/diagramExportUtils';
import { ER_SAMPLE, parseEr, buildErGeometry, buildLegendGroup, buildMermaidErDiagram, buildDrawioXml, splitFieldList } from 'c/erDiagramLogic';
import { analyseArchitecture, analyseObject, findArchitecturePath, analyseBlastRadius, detectJunctionObjects, analyseDomains, deriveArchitectureIntelligence } from 'c/architectureIntelligence';

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
        { id: 'er-arrow',        w: 10, h: 10, rx: 8, ry: 3, d: 'M1,1 L8,3 L1,5 Z',           fill: 'context-stroke', stroke: 'context-stroke' },
        { id: 'er-diamond',      w: 12, h: 10, rx: 10, ry: 3, d: 'M1,3 L5,1 L10,3 L5,5 Z',   fill: 'context-stroke', stroke: null },
        { id: 'er-diamond-open', w: 12, h: 10, rx: 10, ry: 3, d: 'M1,3 L5,1 L10,3 L5,5 Z',   fill: 'none',          stroke: 'context-stroke' }
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
    @track mimicOpen = false;
    @track currentModelIsMimic = false;
    @track mimicModelName = 'Mimicked Model';
    @track mimicObjects = [];
    @track mimicRelationships = [];
    mimicSeq = 0;
    @track importObjectNames = '';
    @track importPanelOpen   = false;

    // ── palette ──
    @track paletteFilter  = '';
    @track paletteObjects = [];

    // ── export modal ──
    @track exportModalOpen   = false;
    @track architectureOpen  = false;
    @track architectureError = '';
    @track architectureSelectedObject = '';
    @track architecturePathSource = '';
    @track architecturePathTarget = '';
    @track architectureDomainAssignments = {};
    @track architectureSection = 'home';
    @track architectureOrgReferences = [];
    @track architectureOrgReferencesLoading = false;
    @track architectureOrgReferencesError = '';
    _architectureOrgReferenceKey = '';
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
    _fileLoadToken    = 0;
    _sharingRequestToken = 0;
    _heatmapRequestToken = 0;
    _isDisconnected = false;
    _focusNameOnNextRender = false;

    // ── DSL editor panel (left, next to the file explorer) ──
    @track dslPanelOpen   = true;
    @track dslPanelWidth  = 460;
    @track dslSuggestions = [];
    @track dslSuggestOpen = false;
    // Not @track — a plain instance field. renderedCallback() checks this
    // on every render and re-applies it if set, then clears it. See
    // applySuggestionAtIndex() for why this exists: setting a textarea's
    // .value programmatically (which renderedCallback's own "dirty value
    // flag" workaround, just below, does whenever it detects a mismatch)
    // resets the cursor position as a side effect, in every browser. A
    // generic Promise.resolve().then() is not a reliable fix for that —
    // it races against LWC's own render scheduling rather than being
    // guaranteed to run after it. renderedCallback is LWC's actual
    // guaranteed-to-run-after-every-render hook, so restoring the cursor
    // there, unconditionally, removes the race instead of hoping to win it.
    _pendingCaretPos = null;
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
    @track legendX = null;
    @track legendY = null;
    legendDragging = false;
    legendDragOffsetX = 0;
    legendDragOffsetY = 0;
    legendPointerId = null;


    // ── sharing model view ──
    @track sharingViewOn = false;
    @track sharingModels = {}; // lowercased apiName -> { internal, external } raw sharing model strings
    @track sharingSignals = {}; // lowercased apiName -> { shareTableAvailable, isCustomObject, hasSharingRule, hasApexSharing }
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
    // Phase 3 — Field Usage Intelligence
    @track fieldUsageOpen=false; @track fieldUsageConsoleOpen=false; @track fieldUsageObjects=[]; @track fieldUsageFields=[];
    @track fieldUsageLoading=false; @track fieldUsageSnapshotAvailable=false; @track fieldUsageBatchRunning=false; @track fieldUsageEntryMessage='';
    @track fieldUsageObject=''; @track fieldUsageSelectedFields=[]; @track fieldUsageEvidence=[]; @track fieldUsageRun=null; @track fieldUsageObjectSearch=''; @track fieldUsageFieldSearch='';
    @track fieldUsageZoom=1; @track fieldUsageConsoleLines=[]; @track fieldUsageConsoleCleared=false; @track _fieldUsageMapCache={nodes:[],edges:[],width:1320,height:650}; fieldUsagePollTimer=null;
    @track fieldImpactAvailable=false; @track fieldImpactLoading=false; @track fieldImpactBatchRunning=false; @track fieldImpactBatchStatus=''; @track fieldImpactObject=''; @track fieldImpactField='';
    @track fieldImpactObjectSearch=''; @track fieldImpactFieldSearch=''; @track fieldImpactObjects=[]; @track fieldImpactFields=[];
    @track fieldImpactEvidence=[]; @track fieldImpactZoom=1; @track fieldImpactSnapshotInfo=null; @track _fieldImpactMapCache={nodes:[],edges:[],width:1160,height:600};
    @track fieldImpactUsageSearch=''; @track fieldImpactSourceType=''; @track fieldImpactSourceTypes=[]; @track fieldImpactSearchResults=[]; @track fieldImpactSearchBusy=false;
    @track dictionaryOpen       = false;
    @track dictionaryFullScreen = true;
    @track dictionarySearch     = '';
    @track dictionaryFieldSearch = '';
    @track dictionaryFieldFilter = 'all';
    @track dictionarySelectedField = '';
    @track dictionaryIntelligenceExpanded = false;
    @track dictionaryArchaeologistOpen = false;
    @track dictionarySelectedObject = null;
    @track dictionaryRow        = null;  // ObjectWrap for the selected object
    @track dictionaryLoading    = false;
    @track dictionaryUsagePending  = false;
    @track dictionaryUsageComputed = false;
    @track dictionarySort = null; // { column, direction } | null
    @track dictionaryExportBusy    = false;
    @track dictionaryExportAllBusy = false;
    @track dictionaryExportAllProgress = '';
    @track openMenu = null; // 'file' | 'diagram' | 'view' | 'settings' | null
    @track settingsOpen = false;
    @track helpOpen = false;
    @track helpSection = 'configuration';
    @track settingsSection = 'field-usage-schedule';
    @track settingsTab = 'configuration';
    @track settingsSchedules = [];
    @track settingsJobs = [];
    @track settingsBusy = false;
    @track settingsMessage = '';
    settingsScheduleSeq = 0;
    @track currentTheme = 'theme-dark-plus';
    sheetJsLoaded = false;
    sheetJsLoadPromise = null;

    // ────────────────────────────────────────────────────────
    //  Lifecycle
    // ────────────────────────────────────────────────────────

    connectedCallback() {
        this._isDisconnected = false;
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
        this._isDisconnected = true;
        this._fileLoadToken++;
        this._sharingRequestToken++;
        this._heatmapRequestToken++;
        this._dictionaryRequestToken++;
        [this.renderTimer, this._sharingFetchTimer, this._heatmapFetchTimer, this._hoverTimer, this._relScanTimer].forEach((timer) => clearTimeout(timer));
        this.stopFieldUsagePolling();
        clearInterval(this.fieldUsagePollTimer);
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
        // Whatever the block above just did (or didn't do) to ta.value,
        // this runs unconditionally right after it, on every single
        // render, guaranteed — restoring a caret position requested by
        // applySuggestionAtIndex() (or anything else that sets
        // _pendingCaretPos) after LWC's own render has had its say,
        // rather than racing it.
        if (ta && this._pendingCaretPos !== null) {
            try { ta.setSelectionRange(this._pendingCaretPos, this._pendingCaretPos); } catch (_) { /* ignore */ }
            this._pendingCaretPos = null;
        }
        if (ta && this._pendingDslSelection) {
            const selection = this._pendingDslSelection;
            try {
                ta.setSelectionRange(selection.start, selection.end, selection.direction);
                ta.focus();
            } catch (_) { /* ignore */ }
            this._pendingDslSelection = null;
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

        // Native select elements can retain a user-chosen DOM value after a
        // programmatic state reset. Keep Architecture Intelligence selectors
        // synchronized so Clear / Refresh visibly resets the workspace too.
        const usageSelect = this.template.querySelector('.arch-workspace-usage select');
        if (usageSelect && usageSelect.value !== (this.architectureSelectedObject || '')) {
            usageSelect.value = this.architectureSelectedObject || '';
        }
        // Native <select> can keep a stale DOM value when Calculate Usage
        // replaces dictionaryRow.fields and causes the field table/tools to
        // rerender. Keep the Data Dictionary filter controlled by its tracked
        // state so the picklist remains usable after usage calculation.
        const dictionaryFilter = this.template.querySelector('.dict-field-filter');
        if (dictionaryFilter && dictionaryFilter.value !== (this.dictionaryFieldFilter || 'all')) {
            dictionaryFilter.value = this.dictionaryFieldFilter || 'all';
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
                    const staleText = this.staleBadgeText(rc);
                    badges.push({
                        id: b.name + '-heat',
                        cx: badgeX, cy: badgeY,
                        fillColor: '#1e1e2e',
                        strokeColor: '#1e1e2e',
                        textColor: '#ffffff',
                        filled: true,
                        code: this.formatCount(rc.count),
                        title: `${rc.count.toLocaleString()} record${rc.count === 1 ? '' : 's'}`
                            + (staleText ? ` — ${staleText}` : '')
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
                moreLabel:       b.hiddenCount > 0 ? '+' + b.hiddenCount + ' more (click to show all)' : '',
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
        const focused=this.focusedEntity?this.focusedEntity.toLowerCase():null;
        const boxes=new Map((this._erBoxes||[]).map(b=>[b.name,b])), allBoxes=[...boxes.values()];
        const raw=this.erConnectors||[], portUsage=new Map();
        const reservePort=(box,side,key)=>{
            const k=box.name+'|'+side, used=portUsage.get(k)||0; portUsage.set(k,used+1);
            const count=Math.max(1,raw.filter(r=>{
                if(r.childEntity===r.parentEntity)return false;
                const other=r.childEntity===box.name?boxes.get(r.parentEntity):r.parentEntity===box.name?boxes.get(r.childEntity):null;
                if(!other)return false;
                const bx=box.x+box.width/2,by=box.y+box.height/2,ox=other.x+other.width/2,oy=other.y+other.height/2;
                const sd=Math.abs(ox-bx)>=Math.abs(oy-by)?(ox>=bx?'right':'left'):(oy>=by?'bottom':'top');
                return sd===side;
            }).length);
            const edgePad=22, usable=(side==='left'||side==='right')?Math.max(24,box.height-edgePad*2):Math.max(24,box.width-edgePad*2);
            // Keep busy sides readable: ports have a real minimum gap rather than
            // collapsing into the same few pixels on high-degree objects.
            const idealGap=24, span=Math.min(usable,Math.max(idealGap*(count-1),idealGap)), start=(usable-span)/2;
            const offset=count===1?usable/2:start+(used/(count-1))*span;
            return side==='left'||side==='right'
                ? {x:side==='right'?box.x+box.width:box.x,y:box.y+edgePad+offset}
                : {x:box.x+edgePad+offset,y:side==='bottom'?box.y+box.height:box.y};
        };
        const clearSegment=(x1,y1,x2,y2,ignore)=>{
            const pad=18,minX=Math.min(x1,x2),maxX=Math.max(x1,x2),minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
            return !allBoxes.some(b=>{
                if(ignore.has(b.name))return false;
                const l=b.x-pad,r=b.x+b.width+pad,t=b.y-pad,bt=b.y+b.height+pad;
                return Math.abs(y1-y2)<1?y1>t&&y1<bt&&maxX>l&&minX<r:Math.abs(x1-x2)<1?x1>l&&x1<r&&maxY>t&&minY<bt:false;
            });
        };
        return raw.map((c,idx)=>{
            const isFocusRelated=!focused||c.childEntity.toLowerCase()===focused||c.parentEntity.toLowerCase()===focused;
            const child=boxes.get(c.childEntity),parent=boxes.get(c.parentEntity);
            if(!child||!parent||c.childEntity===c.parentEntity)return {...c,connOpacity:isFocusRelated?'1':'0.1'};
            const ccx=child.x+child.width/2,ccy=child.y+child.height/2,pcx=parent.x+parent.width/2,pcy=parent.y+parent.height/2,dx=pcx-ccx,dy=pcy-ccy;
            const horizontal=Math.abs(dx)>=Math.abs(dy), childSide=horizontal?(dx>=0?'right':'left'):(dy>=0?'bottom':'top'), parentSide=horizontal?(dx>=0?'left':'right'):(dy>=0?'top':'bottom');
            const sp=reservePort(child,childSide,c.key+'s'),ep=reservePort(parent,parentSide,c.key+'e'),sx=sp.x,sy=sp.y,ex=ep.x,ey=ep.y,ignore=new Set([c.childEntity,c.parentEntity]);
            let d,midX,midY;
            if(horizontal){
                const lo=Math.min(sx,ex)+28,hi=Math.max(sx,ex)-28,direct=(sx+ex)/2,candidates=[direct];
                for(let n=1;n<=10;n++){candidates.push(direct+n*36,direct-n*36);}
                let mx=candidates.find(x=>x>=lo&&x<=hi&&clearSegment(sx,sy,x,sy,ignore)&&clearSegment(x,sy,x,ey,ignore)&&clearSegment(x,ey,ex,ey,ignore));
                if(mx==null)mx=direct;
                d='M '+sx+' '+sy+' L '+mx+' '+sy+' L '+mx+' '+ey+' L '+ex+' '+ey;midX=mx;midY=(sy+ey)/2;
            }else{
                const lo=Math.min(sy,ey)+28,hi=Math.max(sy,ey)-28,direct=(sy+ey)/2,candidates=[direct];
                for(let n=1;n<=10;n++){candidates.push(direct+n*36,direct-n*36);}
                let my=candidates.find(y=>y>=lo&&y<=hi&&clearSegment(sx,sy,sx,y,ignore)&&clearSegment(sx,y,ex,y,ignore)&&clearSegment(ex,y,ex,ey,ignore));
                if(my==null)my=direct;
                d='M '+sx+' '+sy+' L '+sx+' '+my+' L '+ex+' '+my+' L '+ex+' '+ey;midX=(sx+ex)/2;midY=my;
            }
            // Cardinality belongs just outside the card, but must not sit on top
            // of the relationship path. Give each marker a perpendicular visual
            // offset from its port so the 1/N circle remains completely readable.
            const cardPoint=(side,p,index,isEnd)=>{
                const edgeGap=13, fan=((index%3)-1)*11, sign=isEnd?-1:1;
                if(side==='left')return {x:p.x-edgeGap,y:p.y+fan*sign};
                if(side==='right')return {x:p.x+edgeGap,y:p.y+fan*sign};
                if(side==='top')return {x:p.x+fan*sign,y:p.y-edgeGap};
                return {x:p.x+fan*sign,y:p.y+edgeGap};
            };
            const startCard=cardPoint(childSide,sp,idx,false),endCard=cardPoint(parentSide,ep,idx,true);
            return {...c,d,midX,midY:midY-7,cardStartX:startCard.x,cardStartY:startCard.y,cardEndX:endCard.x,cardEndY:endCard.y,strokeWidth:Math.max(2.75,Number(c.strokeWidth)||0),connOpacity:isFocusRelated?'1':'0.1'};
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

    get dictionaryIntelligenceClass(){ return this.dictionaryIntelligenceExpanded ? 'dict-intelligence dict-intelligence-expanded' : 'dict-intelligence dict-intelligence-collapsed'; }
    get dictionaryIntelligenceToggleLabel(){ return this.dictionaryIntelligenceExpanded ? 'Minimise Intelligence' : 'Expand Intelligence'; }
    handleDictionaryIntelligenceToggle(){ this.dictionaryIntelligenceExpanded=!this.dictionaryIntelligenceExpanded; }
    get dictionaryArchaeologistClass(){ return this.dictionaryArchaeologistOpen ? 'dict-archaeologist-overlay dict-archaeologist-open' : 'dict-archaeologist-overlay'; }
    handleOpenDictionaryArchaeologist(){ this.dictionaryArchaeologistOpen=true; }
    handleCloseDictionaryArchaeologist(){ this.dictionaryArchaeologistOpen=false; }
    normaliseDictionaryToken(value){
        return String(value||'').replace(/__c$/i,'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[^a-zA-Z0-9]+/g,' ').toLowerCase().trim();
    }
    get dictionaryFieldFamilies(){
        const stop=new Set(['id','is','has','the','a','an','of','to','for','and','or','field','value','date','number','type','name']);
        const map=new Map();
        this.dictionaryRawFields.filter(f=>!f.isPrimaryKey).forEach(f=>{
            const tokens=new Set((this.normaliseDictionaryToken(f.apiName)+' '+this.normaliseDictionaryToken(f.label)).split(/\s+/).filter(t=>t.length>2&&!stop.has(t)));
            tokens.forEach(t=>{ if(!map.has(t)) map.set(t,[]); map.get(t).push(f); });
        });
        return [...map.entries()].filter(([,fs])=>fs.length>=2).map(([token,fs])=>({key:token,label:token.charAt(0).toUpperCase()+token.slice(1),count:fs.length,fields:fs.map(f=>f.apiName).slice(0,6).join(', '),filter:token})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,12);
    }
    get dictionaryHasFieldFamilies(){ return this.dictionaryFieldFamilies.length>0; }
    get dictionaryPossibleOverlaps(){
        const fs=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey);
        const groups=new Map();
        fs.forEach(f=>{
            const key=this.normaliseDictionaryToken(f.label||f.apiName).replace(/\s+/g,'');
            if(key.length<4)return;
            if(!groups.has(key))groups.set(key,[]);
            groups.get(key).push(f);
        });
        return [...groups.entries()].filter(([,items])=>items.length>1).map(([key,items])=>({key,label:items[0].label||key,count:items.length,fields:items.map(f=>f.apiName).join(', ')})).slice(0,10);
    }
    get dictionaryHasPossibleOverlaps(){ return this.dictionaryPossibleOverlaps.length>0; }
    get dictionaryRelationshipConcentration(){
        const map=new Map();
        this.dictionaryRawFields.filter(f=>f.isRelationship&&f.relatesTo).forEach(f=>{
            String(f.relatesTo).split(',').map(x=>x.trim()).filter(Boolean).forEach(target=>map.set(target,(map.get(target)||0)+1));
        });
        return [...map.entries()].map(([target,count])=>({target,count,key:target})).sort((a,b)=>b.count-a.count||a.target.localeCompare(b.target)).slice(0,10);
    }
    get dictionaryArchaeologyFacts(){
        const fs=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey), custom=fs.filter(f=>f.isCustom), undocumented=custom.filter(f=>!(f.description||'').trim());
        return [
            {key:'extension',label:'Custom extension',value:fs.length?Math.round(custom.length/fs.length*100)+'%':'0%',detail:custom.length+' of '+fs.length+' business fields are custom.'},
            {key:'documentation',label:'Custom documentation',value:custom.length?Math.round((custom.length-undocumented.length)/custom.length*100)+'%':'—',detail:undocumented.length+' custom fields have no description.'},
            {key:'relationships',label:'Relationship footprint',value:String(fs.filter(f=>f.isRelationship).length),detail:this.dictionaryRelationshipConcentration.length+' distinct relationship targets detected.'},
            {key:'derived',label:'Derived behaviour',value:String(fs.filter(f=>String(f.dataType||'').startsWith('Formula')||f.isRollupSummary).length),detail:'Formula and roll up summary fields identified from loaded metadata.'}
        ];
    }
    handleDictionaryFamilySelect(event){
        const token=event.currentTarget.dataset.token||'';
        this.dictionaryArchaeologistOpen=false; this.dictionaryFieldFilter='all'; this.dictionaryFieldSearch=token;
    }
    get dictionaryIntelligenceHeadline(){
        const fs=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey), custom=fs.filter(f=>f.isCustom).length, rel=fs.filter(f=>f.isRelationship).length;
        const derived=fs.filter(f=>String(f.dataType||'').startsWith('Formula')||f.isRollupSummary).length;
        return (this.dictionaryRow?.apiName||'This object')+' contains '+fs.length+' business fields, including '+custom+' custom fields, '+rel+' relationships and '+derived+' derived fields.';
    }
    get dictionaryFieldTypeLandscape(){
        const map=new Map();
        this.dictionaryRawFields.filter(f=>!f.isPrimaryKey).forEach(f=>{const t=f.friendlyType||f.dataType||'Other';map.set(t,(map.get(t)||0)+1);});
        const rows=[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10), max=Math.max(1,...rows.map(x=>x[1]));
        return rows.map(([label,count])=>({key:label,label,count,width:'width:'+Math.max(4,Math.round(count/max*100))+'%'}));
    }
    get dictionaryComposition(){
        const fs=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey), custom=fs.filter(f=>f.isCustom).length, standard=fs.length-custom;
        return [{key:'custom',label:'Custom',count:custom,width:'width:'+(fs.length?Math.round(custom/fs.length*100):0)+'%'},{key:'standard',label:'Standard',count:standard,width:'width:'+(fs.length?Math.round(standard/fs.length*100):0)+'%'}];
    }
    get dictionaryDocumentationLandscape(){
        const custom=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey&&f.isCustom), documented=custom.filter(f=>(f.description||'').trim()).length, missing=custom.length-documented;
        return [{key:'documented',label:'Documented custom fields',count:documented,width:'width:'+(custom.length?Math.round(documented/custom.length*100):0)+'%'},{key:'missing',label:'Missing description',count:missing,width:'width:'+(custom.length?Math.round(missing/custom.length*100):0)+'%'}];
    }
    get dictionaryRelationshipMap(){
        const rel=this.dictionaryRelationshipConcentration, total=rel.length, radius=38;
        return rel.slice(0,8).map((x,i)=>{const a=(Math.PI*2*i/Math.max(total,1))-Math.PI/2, px=50+Math.cos(a)*radius, py=50+Math.sin(a)*radius;return {...x,x:px,y:py,style:'left:'+px+'%;top:'+py+'%'};});
    }
    get dictionaryHasRelationshipMap(){ return this.dictionaryRelationshipMap.length>0; }
    get dictionaryRawFields() { return (this.dictionaryRow&&this.dictionaryRow.fields)||[]; }
    get dictionaryObjectSummary() {
        const fields=this.dictionaryRawFields, nonPk=fields.filter(f=>!f.isPrimaryKey);
        const custom=nonPk.filter(f=>f.isCustom).length, relationships=nonPk.filter(f=>f.isRelationship).length;
        const required=nonPk.filter(f=>f.required).length, formulas=nonPk.filter(f=>String(f.dataType||'').startsWith('Formula')).length;
        const picklists=nonPk.filter(f=>String(f.dataType||'').includes('Picklist')).length;
        const described=nonPk.filter(f=>(f.description||'').trim()).length;
        return [
            {label:'Fields',value:nonPk.length},{label:'Custom',value:custom},{label:'Required',value:required},
            {label:'Relationships',value:relationships},{label:'Formula',value:formulas},{label:'Picklist',value:picklists},
            {label:'Documented',value:nonPk.length?Math.round(described/nonPk.length*100)+'%':'—'}
        ];
    }
    get dictionaryMetadataFindings() {
        const fields=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey), findings=[];
        const missing=fields.filter(f=>f.isCustom&&!(f.description||'').trim());
        if(missing.length) findings.push({key:'descriptions',kind:'DOCUMENTATION',title:missing.length+' custom field'+(missing.length===1?' is':'s are')+' missing descriptions',detail:'Descriptions make intent easier to understand for architects, designers and developers. Missing descriptions are documentation gaps, not proof that a field is unnecessary.'});
        const rel=fields.filter(f=>f.isRelationship);
        if(rel.length) findings.push({key:'relationships',kind:'RELATIONSHIPS',title:rel.length+' relationship field'+(rel.length===1?'':'s')+' connect this object',detail:'Relationship fields define this object’s structural dependencies. Review their targets and relationship types when assessing change impact.'});
        const formulas=fields.filter(f=>String(f.dataType||'').startsWith('Formula'));
        if(formulas.length) findings.push({key:'formula',kind:'DERIVED DATA',title:formulas.length+' formula field'+(formulas.length===1?'':'s')+' detected',detail:'Formula fields represent derived behaviour. They are useful review points when changing source fields or business semantics.'});
        if(this.dictionaryUsageComputed){
            const zero=fields.filter(f=>f.percentUsed===0), low=fields.filter(f=>f.percentUsed>0&&f.percentUsed<5);
            if(zero.length) findings.push({key:'unused',kind:'USAGE',title:zero.length+' field'+(zero.length===1?' has':'s have')+' 0% population',detail:'These are review candidates only. A zero population rate can be valid for new, seasonal, integration-specific or rarely used fields.'});
            if(low.length) findings.push({key:'low',kind:'USAGE',title:low.length+' field'+(low.length===1?' is':'s are')+' below 5% population',detail:'Low population can signal specialised fields or possible simplification opportunities. Confirm business purpose before drawing conclusions.'});
        }
        return findings.slice(0,6);
    }
    get dictionaryRelationshipRows() {
        return this.dictionaryRawFields.filter(f=>f.isRelationship).map(f=>({key:f.apiName,field:f.apiName,target:f.relatesTo||'—',type:f.dataType||f.relationshipType||'Relationship'}));
    }
    get dictionaryHasRelationships() { return this.dictionaryRelationshipRows.length>0; }
    get dictionaryUsageSummary() {
        if(!this.dictionaryUsageComputed) return [];
        const fields=this.dictionaryRawFields.filter(f=>!f.isPrimaryKey&&f.percentUsed!=null);
        return [
            {label:'0% populated',value:fields.filter(f=>f.percentUsed===0).length},
            {label:'Below 5%',value:fields.filter(f=>f.percentUsed>0&&f.percentUsed<5).length},
            {label:'5–49%',value:fields.filter(f=>f.percentUsed>=5&&f.percentUsed<50).length},
            {label:'50–89%',value:fields.filter(f=>f.percentUsed>=50&&f.percentUsed<90).length},
            {label:'90%+',value:fields.filter(f=>f.percentUsed>=90).length}
        ];
    }
    get dictionaryHasUsageSummary() { return this.dictionaryUsageComputed&&this.dictionaryUsageSummary.length>0; }
    get dictionaryFilterOptions() { return [
        {label:'All fields',value:'all'},{label:'Custom',value:'custom'},{label:'Standard',value:'standard'},
        {label:'Required',value:'required'},{label:'Relationships',value:'relationship'},{label:'Formula',value:'formula'},
        {label:'Picklist',value:'picklist'},{label:'Missing description',value:'undocumented'},
        {label:'0% used',value:'unused'},{label:'Below 5% used',value:'lowusage'}
    ]; }
    get dictionaryFilteredSortedFields() {
        const q=(this.dictionaryFieldSearch||'').trim().toLowerCase(), filter=this.dictionaryFieldFilter;
        return this.getSortedDictionaryFields().filter(f=>{
            if(q&&![(f.apiName||''),(f.label||''),(f.description||''),(f.dataType||''),(f.relatesTo||'')].some(v=>v.toLowerCase().includes(q))) return false;
            if(filter==='custom'&&!f.isCustom) return false;
            if(filter==='standard'&&f.isCustom) return false;
            if(filter==='required'&&!f.required) return false;
            if(filter==='relationship'&&!f.isRelationship) return false;
            if(filter==='formula'&&!String(f.dataType||'').startsWith('Formula')) return false;
            if(filter==='picklist'&&!String(f.dataType||'').includes('Picklist')) return false;
            if(filter==='undocumented'&&(f.description||'').trim()) return false;
            if(filter==='unused'&&f.percentUsed!==0) return false;
            if(filter==='lowusage'&&!(f.percentUsed>0&&f.percentUsed<5)) return false;
            return true;
        });
    }
    get dictionaryVisibleFieldCount() { return this.dictionaryFilteredSortedFields.length; }
    get dictionaryFieldRows() {
        return this.dictionaryFilteredSortedFields.map((f) => ({
            key: f.apiName, apiName:f.apiName, label:f.label||'', description:f.description||'—', dataType:f.dataType||'',
            requiredText:f.required?'Yes':'No', customText:f.isCustom?'Yes':'No', pkText:f.isPrimaryKey?'Yes':'No',
            fkText:f.isRelationship?'Yes':'No', fkTarget:f.isRelationship?(f.relatesTo||'—'):'—',
            lastModified:f.lastModifiedDate||'—', usageText:f.percentUsed!=null?(Math.round(f.percentUsed*10)/10+'%'):(this.dictionaryUsageComputed?'N/A':'—'),
            rowClass:f.isPrimaryKey?'dict-field-row dict-field-pk':'dict-field-row'
        }));
    }
    handleDictionaryFieldSearch(event){ this.dictionaryFieldSearch=event.target.value||''; }
    handleDictionaryFieldFilter(event){ this.dictionaryFieldFilter=event.target.value||'all'; }
    handleDictionaryFieldSelect(event){ this.dictionarySelectedField=event.currentTarget.dataset.name||''; }
    handleDictionaryFieldDrillClose(){ this.dictionarySelectedField=''; }
    get dictionaryFieldDetail(){
        const f=this.dictionaryRawFields.find(x=>x.apiName===this.dictionarySelectedField); if(!f) return null;
        return {apiName:f.apiName,label:f.label||'',description:f.description||'No description provided.',dataType:f.dataType||'',
            required:f.required?'Yes':'No',custom:f.isCustom?'Yes':'No',relationship:f.isRelationship?'Yes':'No',
            target:f.isRelationship?(f.relatesTo||'—'):'—',lastModified:f.lastModifiedDate||'—',
            usage:f.percentUsed!=null?(Math.round(f.percentUsed*10)/10+'%'):(this.dictionaryUsageComputed?'N/A':'Not calculated')};
    }
    get dictionaryHasFieldDetail(){ return !!this.dictionaryFieldDetail; }
    handleDictionaryViewArchitecture(){
        const name=this.dictionarySelectedObject; if(!name) return;
        this.dictionaryOpen=false; this.architectureOpen=true; this.refreshArchitectureAnalysis(true);
        const exists=(this.architectureNodes||[]).some(n=>n.name.toLowerCase()===name.toLowerCase());
        this.architectureSelectedObject=exists?name:'';
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

    // Phase 2 workspace presentation only. These controls never alter DSL text or compiler behaviour.
    @track dslMaximised = false;
    @track dslWordWrap = false;
    @track dslScrollTop = 0;
    @track canvasMaximised = false;
    @track canvasFitActive = false;
    @track canvasSummaryVisible = false;

    // ── DSL panel ──
    get dslPanelClass() { return this.dslPanelOpen ? 'dsl-panel dsl-panel-open'+(this.dslMaximised?' dsl-panel-maximised':'') : 'dsl-panel dsl-panel-closed'; }
    get dslPanelStyle() { return this.dslPanelOpen ? (this.dslMaximised?'width:100%':`width:${this.dslPanelWidth}px`) : 'width:0px'; }
    get canvasOuterClass(){ return 'canvas-outer'+(this.canvasMaximised?' canvas-outer-maximised':'')+(this.dslMaximised?' canvas-hidden-by-dsl':''); }
    get dslMaximiseLabel(){ return this.dslMaximised?'Restore':'Maximise'; }
    get dslWrapLabel(){ return this.dslWordWrap?'Wrap: On':'Wrap: Off'; }
    get dslWrapAttribute(){ return this.dslWordWrap?'soft':'off'; }
    get dslEditorClass(){ return 'code-editor'+(this.dslWordWrap?' code-editor-wrap':''); }
    get dslLineNumbers(){
        const count=Math.max(1,(this.sourceText||'').split('\n').length);
        return Array.from({length:count},(_,index)=>({key:'dsl-line-'+(index+1),number:index+1}));
    }
    get dslLineNumberStyle(){ return `transform:translateY(-${this.dslScrollTop}px)`; }
    preserveDslCaretForRender() {
        const ta = this.template.querySelector('.code-editor');
        if (!ta) return;
        this._pendingDslSelection = {
            start: ta.selectionStart,
            end: ta.selectionEnd,
            direction: ta.selectionDirection || 'none'
        };
    }
    handleToggleDslWrap(){
        this.preserveDslCaretForRender();
        this.dslWordWrap=!this.dslWordWrap;
        this.dslSuggestOpen=false;
        requestAnimationFrame(()=>{
            const ta=this.template.querySelector('.code-editor');
            if(ta) this.dslScrollTop=ta.scrollTop||0;
        });
    }
    get canvasMaximiseLabel(){ return this.canvasMaximised?'Restore':'Maximise'; }
    get canvasHasModel(){ return (this._erBoxes||[]).length>0; }
    get canvasRelationshipSummary(){
        if(!this.canvasHasModel) return [];
        return (this.erConnectors||[]).map((r,i)=>{
            const field=r.label||'relationship field';
            const isPolymorphic=r.markerEnd?.includes('diamond-open');
            const isMasterDetail=!isPolymorphic&&r.markerEnd?.includes('diamond');
            const isAccountSelf=r.childEntity==='Account'&&r.parentEntity==='Account';
            let kind=isPolymorphic?'Polymorphic Lookup':isMasterDetail?'Master Detail':'Lookup';
            let sentence=r.childEntity+' is related to '+r.parentEntity+' via '+field+' using '+kind+'.';
            if(!isPolymorphic&&!isMasterDetail&&isAccountSelf&&field==='ParentId'){
                kind='Hierarchical Lookup';
                sentence='Account.ParentId links an Account to its parent Account using the standard Account hierarchy.';
            }else if(!isPolymorphic&&!isMasterDetail&&isAccountSelf&&field==='MasterRecordId'){
                kind='Merge Master Reference';
                sentence='Account.MasterRecordId identifies the surviving master Account after a record merge; it is not a Master Detail relationship.';
            }
            const childCard=r.cardStartText||'N', parentCard=r.cardEndText||'1';
            let cardinality=childCard+' → '+parentCard;
            let cardinalityText='';
            if(childCard==='N'&&parentCard==='1'){
                cardinality='N → 1';
                cardinalityText='Many '+r.childEntity+' records can reference one '+r.parentEntity+' record. Each '+r.childEntity+' uses '+field+' to reference its '+r.parentEntity+'.';
            }else if(childCard==='1'&&parentCard==='N'){
                cardinality='1 → N';
                cardinalityText='One '+r.childEntity+' record can relate to many '+r.parentEntity+' records.';
            }else if(childCard==='1'&&parentCard==='1'){
                cardinality='1 → 1';
                cardinalityText='One '+r.childEntity+' record relates to one '+r.parentEntity+' record.';
            }else{
                cardinalityText=childCard+' '+r.childEntity+' record(s) relate to '+parentCard+' '+r.parentEntity+' record(s).';
            }
            return {key:r.key||'summary-'+i,child:r.childEntity,parent:r.parentEntity,field,kind,cardinality,cardinalityText,sentence:sentence+' '+cardinalityText};
        });
    }
    get canvasSummaryToggleLabel(){ return this.canvasSummaryVisible?'Hide Summary':'Show Summary'; }
    handleToggleCanvasSummary(){ this.canvasSummaryVisible=!this.canvasSummaryVisible; }
    get showCanvasFitExport(){ return this.canvasFitActive && this.canvasMaximised; }
    handleToggleDslMaximise(){ this.preserveDslCaretForRender(); this.dslMaximised=!this.dslMaximised; if(this.dslMaximised)this.canvasMaximised=false; }
    handleToggleCanvasMaximise(){ this.canvasMaximised=!this.canvasMaximised; if(this.canvasMaximised)this.dslMaximised=false; else this.canvasFitActive=false; }
    handleFitModel(){
        this.canvasFitActive=true;
        // Relationship-aware presentation layout only. DSL/parser/compiler remain untouched.
        const wrap=this.template.querySelector('.canvas-wrap');
        if(!wrap||!this.sourceText?.trim()) return;
        try {
            const model=parseEr(this.sourceText), entities=model.entities||[], rels=model.relationships||[];
            if(!entities.length) return;
            const byName=new Map(entities.map(e=>[e.name,e])), adj=new Map(entities.map(e=>[e.name,new Set()]));
            rels.forEach(r=>{
                if(r.childEntity!==r.parentEntity&&adj.has(r.childEntity)&&adj.has(r.parentEntity)){
                    adj.get(r.childEntity).add(r.parentEntity); adj.get(r.parentEntity).add(r.childEntity);
                }
            });
            const degree=n=>adj.get(n)?.size||0;
            const unplaced=new Set(entities.map(e=>e.name)), components=[];
            while(unplaced.size){
                const seed=[...unplaced].sort((a,b)=>degree(b)-degree(a)||a.localeCompare(b))[0], q=[seed], comp=[];unplaced.delete(seed);
                while(q.length){const n=q.shift();comp.push(n);[...(adj.get(n)||[])].sort((a,b)=>degree(b)-degree(a)||a.localeCompare(b)).forEach(x=>{if(unplaced.has(x)){unplaced.delete(x);q.push(x);}});}
                components.push(comp);
            }
            components.sort((a,b)=>b.length-a.length);
            const dense=entities.length>=16, veryDense=entities.length>=32;
            const cardW=veryDense?150:dense?170:205, visibleRows=veryDense?4:dense?5:7;
            const positions={},widths={},heights={}; let componentTop=70, maxRight=0;
            components.forEach(comp=>{
                const root=[...comp].sort((a,b)=>degree(b)-degree(a)||a.localeCompare(b))[0];
                const levels=[[root]],seen=new Set([root]);
                for(let li=0;li<levels.length;li++){
                    const next=[];
                    levels[li].forEach(n=>[...(adj.get(n)||[])].sort((a,b)=>degree(b)-degree(a)||a.localeCompare(b)).forEach(x=>{if(comp.includes(x)&&!seen.has(x)){seen.add(x);next.push(x);}}));
                    if(next.length)levels.push(next);
                }
                comp.filter(n=>!seen.has(n)).forEach(n=>levels.push([n]));
                const maxLevel=Math.max(...levels.map(x=>x.length)), colGap=veryDense?90:120,rowGap=veryDense?90:110;
                const usableW=Math.max(wrap.clientWidth-100,maxLevel*(cardW+colGap)+160);
                let levelTop=componentTop;
                levels.forEach((level,li)=>{
                    const rowMaxH=Math.max(...level.map(n=>Math.max(108,52+Math.min(visibleRows,(byName.get(n)?.fields?.length||0)+1)*22)));
                    const span=level.length*cardW+(level.length-1)*colGap, startX=Math.max(55,(usableW-span)/2);
                    level.forEach((n,i)=>{
                        const h=Math.max(108,52+Math.min(visibleRows,(byName.get(n)?.fields?.length||0)+1)*22);
                        // Alternate neighbouring nodes around the centre to create independent routing lanes.
                        const order=i%2===0?Math.floor(i/2):level.length-1-Math.floor(i/2);
                        const x=startX+order*(cardW+colGap);
                        positions[n]={x:Math.round(x),y:Math.round(levelTop)};widths[n]=cardW;heights[n]=h;maxRight=Math.max(maxRight,x+cardW);
                    });
                    levelTop+=rowMaxH+rowGap;
                });
                componentTop=levelTop+90;
            });
            this.erPositions=positions;this.boxWidthOverrides=widths;this.boxHeightOverrides=heights;this.zoomLevel=1;this.renderDiagram();
            requestAnimationFrame(()=>{
                const fit=Math.min((wrap.clientWidth-30)/this.svgWidth,(wrap.clientHeight-30)/this.svgHeight,1);
                this.zoomLevel=Math.max(0.65,Math.round(fit*20)/20);wrap.scrollLeft=0;wrap.scrollTop=0;
            });
        } catch(e){this.errorMessage=e?.message||'Could not fit the model.';}
    }
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
        this.canvasSummaryVisible = false;
        this.svgWidth  = 1600;
        this.svgHeight = 900;
        this.isDirty   = true;
        this._markTabDirty(this.activeTabId, true);
        // Sharing View / Heatmap badge whatever's currently on the canvas —
        // with nothing left on it, leaving them ticked was stale/misleading.
        this.sharingViewOn = false;
        this.heatmapOn = false;
        this.sharingModels = {};
        this.sharingSignals = {};
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
    get settingsMenuClass(){ return this.openMenu === 'settings'? 'dd-menu-btn dd-menu-btn-open' : 'dd-menu-btn'; }
    get helpMenuClass(){ return this.openMenu === 'help'? 'dd-menu-btn dd-menu-btn-open' : 'dd-menu-btn'; }
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
    get settingsMenuOpen(){ return this.openMenu === 'settings'; }
    get helpMenuOpen(){ return this.openMenu === 'help'; }
    get helpConfigurationOpen(){ return this.helpSection === 'configuration'; }
    get helpUserManualOpen(){ return this.helpSection === 'manual'; }
    get helpConfigurationClass(){ return this.helpConfigurationOpen ? 'help-nav-item help-nav-item-active' : 'help-nav-item'; }
    get helpUserManualClass(){ return this.helpUserManualOpen ? 'help-nav-item help-nav-item-active' : 'help-nav-item'; }
    handleMenuHelpConfiguration(){ this.openMenu=null; this.helpOpen=true; this.helpSection='configuration'; }
    handleMenuHelpUserManual(){ this.openMenu=null; this.helpOpen=true; this.helpSection='manual'; }
    handleHelpConfiguration(){ this.helpSection='configuration'; }
    handleHelpUserManual(){ this.helpSection='manual'; }
    handleCloseHelp(){ this.helpOpen=false; }
    get sharingViewMenuText() { return this.sharingViewOn ? 'Sharing View \u2713' : 'Sharing View'; }
    get dictionaryMenuText()  { return this.dictionaryOpen ? 'Data Dictionary \u2713' : 'Data Dictionary'; }
    get heatmapMenuText()     { return this.heatmapOn ? 'Heatmap \u2713' : 'Heatmap'; }
    get architectureMenuText(){ return this.architectureOpen ? 'Architecture Intelligence \u2713' : 'Architecture Intelligence'; }

    get settingsConfigurationTabClass(){return this.settingsTab==='configuration'?'settings-tab settings-tab-active':'settings-tab';}
    get settingsJobsTabClass(){return this.settingsTab==='jobs'?'settings-tab settings-tab-active':'settings-tab';}
    get settingsConfigurationOpen(){return this.settingsTab==='configuration';}
    get settingsJobsOpen(){return this.settingsTab==='jobs';}
    get settingsHasSchedules(){return (this.settingsSchedules||[]).length>0;}
    get settingsNoSchedules(){return !this.settingsHasSchedules;}
    get settingsHasJobs(){return (this.settingsJobs||[]).length>0;}
    get settingsNoJobs(){return !this.settingsHasJobs;}
    get settingsJobsView(){
        return (this.settingsJobs||[]).map(j=>({
            ...j,
            key:j.scheduleId||j.cronTriggerId||j.jobName,
            timeText:String(Math.trunc(Number(j.hour||0))).padStart(2,'0')+':'+String(Math.trunc(Number(j.minute||0))).padStart(2,'0'),
            nextRunText:j.nextFireTime?new Date(j.nextFireTime).toLocaleString():'—',
            canPause:!!j.enabled,
            canResume:!j.enabled
        }));
    }
    handleMenuSettings(){this.openMenu=null;this.openSettingsWorkspace();}
    async openSettingsWorkspace(){
        this.settingsOpen=true;this.settingsSection='field-usage-schedule';this.settingsTab='configuration';this.settingsMessage='';
        await this.loadScheduleSettings();
    }
    handleCloseSettings(){this.settingsOpen=false;this.settingsMessage='';}
    async loadScheduleSettings(){
        this.settingsBusy=true;
        try{
            const status=await fieldUsageGetStatus();
            this.settingsSchedules=(status?.schedules||[]).map(row=>({...row,_key:row.Id||'schedule-'+(++this.settingsScheduleSeq)}));
        }catch(e){this.settingsMessage='Could not load schedules: '+this.reduceError(e);}
        finally{this.settingsBusy=false;}
    }
    async handleSettingsConfigurationTab(){this.settingsTab='configuration';await this.loadScheduleSettings();}
    async handleSettingsJobsTab(){this.settingsTab='jobs';await this.loadScheduledJobs();}
    async loadScheduledJobs(){
        this.settingsBusy=true;this.settingsMessage='';
        try{this.settingsJobs=await fieldUsageGetScheduledJobs()||[];}
        catch(e){this.settingsMessage='Could not load scheduled jobs: '+this.reduceError(e);}
        finally{this.settingsBusy=false;}
    }
    handleAddSchedule(){
        const key='schedule-'+(++this.settingsScheduleSeq);
        this.settingsSchedules=[...this.settingsSchedules,{_key:key,Name:'Field Usage Schedule',Enabled__c:true,Hour__c:3,Minute__c:0}];
    }
    handleScheduleName(e){const key=e.currentTarget.dataset.key,value=e.target.value;this.settingsSchedules=this.settingsSchedules.map(r=>r._key===key?{...r,Name:value}:r);}
    handleScheduleEnabled(e){const key=e.currentTarget.dataset.key,value=e.target.checked;this.settingsSchedules=this.settingsSchedules.map(r=>r._key===key?{...r,Enabled__c:value}:r);}
    handleScheduleHour(e){const key=e.currentTarget.dataset.key,value=Number(e.target.value);this.settingsSchedules=this.settingsSchedules.map(r=>r._key===key?{...r,Hour__c:value}:r);}
    handleScheduleMinute(e){const key=e.currentTarget.dataset.key,value=Number(e.target.value);this.settingsSchedules=this.settingsSchedules.map(r=>r._key===key?{...r,Minute__c:value}:r);}
    async handleDeleteSchedule(e){
        const key=e.currentTarget.dataset.key,row=this.settingsSchedules.find(r=>r._key===key);
        this.settingsBusy=true;this.settingsMessage='';
        try{
            if(row?.Id) await fieldUsageDeleteSchedule({scheduleId:row.Id});
            this.settingsSchedules=this.settingsSchedules.filter(r=>r._key!==key);
            this.settingsMessage='Schedule deleted.';
        }catch(err){this.settingsMessage='Could not delete schedule: '+this.reduceError(err);}
        finally{this.settingsBusy=false;}
    }
    async handleSaveSchedules(){
        this.settingsBusy=true;this.settingsMessage='';
        try{
            const rows=this.settingsSchedules.map(r=>({Id:r.Id,Name:r.Name||'Field Usage Schedule',Enabled__c:!!r.Enabled__c,Hour__c:Number(r.Hour__c),Minute__c:Number(r.Minute__c)}));
            await fieldUsageSaveSchedules({rows});
            this.settingsMessage='Schedule configuration saved.';
            await this.loadScheduleSettings();
        }catch(e){this.settingsMessage='Could not save schedules: '+this.reduceError(e);this.settingsBusy=false;}
    }
    async handleRefreshScheduledJobs(){await this.loadScheduledJobs();}
    async handlePauseScheduledJob(e){
        this.settingsBusy=true;
        try{await fieldUsagePauseSchedule({scheduleId:e.currentTarget.dataset.id});this.settingsMessage='Schedule paused.';await this.loadScheduledJobs();}
        catch(err){this.settingsMessage='Could not pause schedule: '+this.reduceError(err);this.settingsBusy=false;}
    }
    async handleResumeScheduledJob(e){
        this.settingsBusy=true;
        try{await fieldUsageResumeSchedule({scheduleId:e.currentTarget.dataset.id});this.settingsMessage='Schedule resumed.';await this.loadScheduledJobs();}
        catch(err){this.settingsMessage='Could not resume schedule: '+this.reduceError(err);this.settingsBusy=false;}
    }
    async handleDeleteScheduledJob(e){
        this.settingsBusy=true;
        try{await fieldUsageDeleteSchedule({scheduleId:e.currentTarget.dataset.id});this.settingsMessage='Schedule deleted.';await this.loadScheduledJobs();}
        catch(err){this.settingsMessage='Could not delete schedule: '+this.reduceError(err);this.settingsBusy=false;}
    }

    // Each wraps an existing, already-tested handler — closes the dropdown
    // first, then delegates, so none of the underlying action logic changes.
    handleMenuNew()            { this.openMenu = null; this.handleNew(); }
    handleMenuSave()           { this.openMenu = null; this.handleSave(); }
    handleMenuImport()         { this.openMenu = null; this.handleToggleImport(); }
    handleMenuExport()         { this.openMenu = null; this.handleOpenExport(); }
    handleMenuAutoLayout()     { this.openMenu = null; this.handleAutoLayout(); }
    resetMimicDraft() {
        this.mimicModelName = 'Mimicked Model';
        this.mimicObjects = [];
        this.mimicRelationships = [];
        this.mimicSeq = 0;
        this.errorMessage = '';
    }
    handleMenuMimic() {
        this.openMenu = null;
        this.resetMimicDraft();
        this.mimicAddObject();
        this.mimicOpen = true;
    }
    handleCloseMimic() {
        this.mimicOpen = false;
        this.resetMimicDraft();
    }
    get mimicFieldTypeOptions(){return ['Text','Text Area','Long Text Area','Number','Currency','Percent','Checkbox','Date','DateTime','Email','Phone','URL','Picklist','Multi Select Picklist','Auto Number','Formula','Lookup','Master Detail','Polymorphic'];}
    handleMimicModelName(e){this.mimicModelName=e.target.value;}
    normaliseMimicApiBase(value) {
        // Mimic owns the custom suffix. Anything the user types from "__"
        // onward is discarded so Project, Project__c and Project__anything
        // all generate the same custom API name: Project__c.
        return String(value || '')
            .split('__')[0]
            .replace(/_c$/i, '')
            .replace(/_+$/g, '')
            .replace(/[^A-Za-z0-9_]/g, '');
    }
    mimicCustomApiName(value) {
        const base = this.normaliseMimicApiBase(value);
        return base ? base + '__c' : '';
    }
    mimicAddObject(){const id='mo'+(++this.mimicSeq);this.mimicObjects=[...this.mimicObjects,{id,name:'',fields:[{id:id+'id',name:'Id',type:'Id',locked:true,target:''},{id:id+'f1',name:'Name',type:'Text',locked:false,target:''}]}];}
    handleMimicAddObject(){this.mimicAddObject();}
    handleMimicObjectName(e){const id=e.currentTarget.dataset.id,name=this.normaliseMimicApiBase(e.target.value);e.target.value=name;this.mimicObjects=this.mimicObjects.map(o=>o.id===id?{...o,name}:o);}
    handleMimicRemoveObject(e){const id=e.currentTarget.dataset.id;this.mimicObjects=this.mimicObjects.filter(o=>o.id!==id).map(o=>({...o,fields:o.fields.map(f=>f.target===id?{...f,target:'',type:'Text'}:f)}));}
    handleMimicAddField(e){const id=e.currentTarget.dataset.id;this.mimicObjects=this.mimicObjects.map(o=>o.id===id?{...o,fields:[...o.fields,{id:id+'f'+(++this.mimicSeq),name:'',type:'Text',locked:false,target:''}]}:o);}
    handleMimicFieldName(e){const oid=e.currentTarget.dataset.object,fid=e.currentTarget.dataset.field,name=this.normaliseMimicApiBase(e.target.value);e.target.value=name;this.mimicObjects=this.mimicObjects.map(o=>o.id===oid?{...o,fields:o.fields.map(f=>f.id===fid&&!f.locked?{...f,name}:f)}:o);}
    handleMimicFieldType(e){const oid=e.currentTarget.dataset.object,fid=e.currentTarget.dataset.field,type=e.target.value,rel=['Lookup','Master Detail','Polymorphic'].includes(type),targets=this.mimicObjects.filter(o=>o.id!==oid);if(rel&&!targets.length){this.errorMessage='Add another object before creating a '+type+' relationship field.';e.target.value='Text';return;}this.errorMessage='';this.mimicObjects=this.mimicObjects.map(o=>o.id===oid?{...o,fields:o.fields.map(f=>f.id===fid?{...f,type,target:rel?(f.target||targets[0].id):''}:f)}:o);}
    handleMimicFieldTarget(e){const oid=e.currentTarget.dataset.object,fid=e.currentTarget.dataset.field;this.mimicObjects=this.mimicObjects.map(o=>o.id===oid?{...o,fields:o.fields.map(f=>f.id===fid?{...f,target:e.target.value}:f)}:o);}
    handleMimicRemoveField(e){const oid=e.currentTarget.dataset.object,fid=e.currentTarget.dataset.field;this.mimicObjects=this.mimicObjects.map(o=>o.id===oid?{...o,fields:o.fields.filter(f=>f.id!==fid||f.locked)}:o);}
    get mimicObjectsView(){return this.mimicObjects.map(o=>({...o,fields:o.fields.map(f=>({...f,isRelationship:['Lookup','Master Detail','Polymorphic'].includes(f.type),targetOptions:this.mimicObjects.filter(t=>t.id!==o.id).map(t=>({label:(this.mimicCustomApiName(t.name)||'Unnamed object')+' · Id',value:t.id}))}))}));}
    handleGenerateMimic(){
        const objs=this.mimicObjects.filter(o=>this.normaliseMimicApiBase(o.name));if(!objs.length){this.errorMessage='Mimic New ER needs at least one named object.';return;}
        const names=new Set(objs.map(o=>this.mimicCustomApiName(o.name).toLowerCase()));if(names.size!==objs.length){this.errorMessage='Object names in Mimic New ER must be unique.';return;}
        const byId=new Map(objs.map(o=>[o.id,o])),lines=[];
        for(const o of objs){for(const f of o.fields){if(['Lookup','Master Detail','Polymorphic'].includes(f.type)&&(!f.target||!byId.get(f.target))){this.errorMessage='Choose a target object for relationship field '+(this.mimicCustomApiName(f.name)||'(unnamed)')+' on '+this.mimicCustomApiName(o.name)+'.';return;}}}
        objs.forEach(o=>{const fs=o.fields.filter(f=>!f.locked&&this.normaliseMimicApiBase(f.name)&&!['Lookup','Master Detail','Polymorphic'].includes(f.type)).map(f=>this.mimicCustomApiName(f.name)+(f.type&&f.type!=='Text'?' ['+f.type+']':''));lines.push('entity '+this.mimicCustomApiName(o.name)+(fs.length?' : '+fs.join(', '):''));});
        objs.forEach(o=>o.fields.filter(f=>!f.locked&&this.normaliseMimicApiBase(f.name)&&['Lookup','Master Detail','Polymorphic'].includes(f.type)).forEach(f=>{const target=byId.get(f.target),op=f.type==='Master Detail'?'=>':f.type==='Polymorphic'?'~>':'->';lines.push(this.mimicCustomApiName(o.name)+'.'+this.mimicCustomApiName(f.name)+' '+op+' '+this.mimicCustomApiName(target.name));}));
        this.openNewUnsaved();this.currentModelIsMimic=true;this.fileName=(this.mimicModelName||'Mimicked Model').trim()||'Mimicked Model';this.sourceText=lines.join('\n');this.isDirty=true;this._markTabDirty(this.activeTabId,true);this.mimicOpen=false;this.resetMimicDraft();this.renderDiagram();
    }

    get fieldUsageMenuText() { return 'Field Usage Map'; }
    @track fieldUsageJobTotal = 0;
    @track fieldUsageJobProcessed = 0;
    @track fieldUsageJobErrors = 0;
    @track fieldUsageJobStatus = '';
    get fieldUsageProgress() {
        const value = Number(this.fieldUsageRun?.Progress_Percent__c || 0);
        return Math.max(0, Math.min(100, Math.round(value)));
    }
    get fieldUsagePhase() {
        const phase = this.fieldUsageRun?.Progress_Phase__c || this.fieldUsageRun?.Status__c || 'Ready';
        if (this.fieldUsageRunning && this.fieldUsageJobTotal > 0) {
            return phase + ' · ' + this.fieldUsageJobProcessed + ' / ' + this.fieldUsageJobTotal + ' batches';
        }
        return phase;
    }
    get fieldUsageProgressStyle() { return 'width:' + this.fieldUsageProgress + '%;'; }
    get fieldUsageRunning() {
        return ['Queued', 'Running'].includes(this.fieldUsageRun?.Status__c || '');
    }
    get fieldUsageNoConsoleLines() { return !(this.fieldUsageConsoleLines || []).length; }
    get fieldUsageIdle() { return !this.fieldUsageRunning; }
    get fieldUsageRunStatusText() {
        if (!this.fieldUsageRun) return 'Ready to start a new org snapshot scan.';
        if (this.fieldUsageRunning) return 'A Field Usage scan is already active. Live progress is attached below.';
        if (this.fieldUsageRun.Status__c === 'Completed') return 'Latest scan completed. The snapshot is ready for Field Usage Map.';
        if (this.fieldUsageRun.Status__c === 'Completed With Errors') return 'Latest scan completed with errors. Review the activity below before starting another scan.';
        if (this.fieldUsageRun.Status__c === 'Failed') return 'Latest scan failed. Review the activity below before starting another scan.';
        return 'No Field Usage scan is currently running.';
    }
    get fieldUsageCanCleanConsole() {
        return !this.fieldUsageRunning && (this.fieldUsageConsoleLines || []).length > 0;
    }

    async handleOpenFieldUsageConsole() {
        this.openMenu = null;
        this.fieldUsageConsoleOpen = true;
        // Reopening the console is a fresh view of the persisted server-side
        // run. Clear Console must not permanently hide subsequent status.
        this.fieldUsageConsoleCleared = false;
        // Opening the console is discovery, not continuation of an old local
        // selection. Ask Apex for the active run first; once attached, polling
        // pins every subsequent read to that exact run id.
        this.fieldUsageRun = null;
        try {
            await this.refreshFieldUsageConsole();
            // Opening the manual scan console must never create scheduled Apex jobs.
            // Scheduling is an explicit configuration concern, not a side effect of viewing scan status.
            this.startFieldUsagePolling();
        } catch (e) {
            this.errorMessage = 'Field Usage console: ' + this.reduceError(e);
        }
    }

    handleCloseFieldUsageConsole() {
        this.fieldUsageConsoleOpen = false;
        this.stopFieldUsagePolling();
    }

    async handleLaunchFieldUsageScan() {
        if (this.fieldUsageRunning) return;
        this.fieldUsageConsoleOpen = true;
        this.errorMessage = '';
        this.fieldUsageRun = { Status__c: 'Queued', Progress_Percent__c: 0, Progress_Phase__c: 'Starting Field Usage scan' };
        this.fieldUsageConsoleCleared = false;
        this.fieldUsageConsoleLines = [{ key: 'client-start', text: '[starting] Field Usage scan requested…' }];
        try {
            const runId = await fieldUsageRunNow();
            // Keep a durable local representation of the run returned by Apex.
            // The first getStatus() can race the just-committed transaction and
            // temporarily return no run; without the Id the UI fell back to
            // "Run Scan" even though the Batch Apex job was already running.
            this.fieldUsageRun = {
                Id: runId,
                Status__c: 'Queued',
                Progress_Percent__c: 0,
                Progress_Phase__c: 'Waiting for background scan to start'
            };
            this.fieldUsageBatchRunning = true;
            this.fieldUsageConsoleLines = [
                { key: 'client-started', text: '[queued] Scan started successfully' },
                { key: 'client-run', text: '[run] ' + runId }
            ];
            // Start the timer before the first refresh. A transient/failed
            // refresh must never prevent the console from following the job.
            this.startFieldUsagePolling(true);
            try {
                await this.refreshFieldUsageConsole();
            } catch (statusError) {
                // The launch succeeded. Treat status retrieval independently;
                // the next poll will retry instead of turning a successful
                // launch into an idle console.
                this.errorMessage = '';
            }
        } catch (e) {
            const message = this.reduceError(e);
            // A launch failure must not be replaced by a second status failure.
            // Refresh is best-effort so the original credential/concurrency
            // message always reaches the console and Help guidance below.
            try {
                await this.refreshFieldUsageConsole();
            } catch (refreshError) {
                this.stopFieldUsagePolling();
            }
            if (/already running/i.test(message)) {
                // This is a normal concurrency guard, not a canvas-level error.
                // Keep the console open and attach to the existing run instead.
                this.errorMessage = '';
                this.fieldUsageConsoleOpen = true;
                this.startFieldUsagePolling();
                return;
            }
            // Keep scan failures inside the scan console. Do not leak them onto
            // the ER canvas where they look like diagram/parser failures.
            this.errorMessage = '';
            const credentialHelp = /named credential|external credential|credential\(s\)|tooling api connection|salesforce_tooling_api/i.test(message);
            this.fieldUsageRun = null;
            this.fieldUsageBatchRunning = false;
            this.stopFieldUsagePolling();
            this.fieldUsageConsoleLines = [
                ...(this.fieldUsageConsoleLines || []),
                { key: 'launch-error-' + Date.now(), text: '[error] Could not start Field Usage scan: ' + message },
                ...(credentialHelp ? [{ key: 'credential-help-' + Date.now(), text: '[help] Tooling API configuration is required. Open Help → Configuration for the complete Salesforce setup guide.' }] : [])
            ];
        }
    }

    handleCleanFieldUsageConsole() {
        this.fieldUsageConsoleCleared = true;
        this.fieldUsageConsoleLines = [];
    }

    async refreshFieldUsageConsole() {
        const status = await fieldUsageGetStatus({ runId: this.fieldUsageRun?.Id || null });
        const statusRun = status?.run || null;
        // Do not throw away a locally known Queued/Running scan because one
        // status read returned no run. That used to reset the modal to Ready
        // and stop its timer while the AsyncApexJob was still Processing.
        if (statusRun) {
            this.fieldUsageRun = statusRun;
        } else if (!this.fieldUsageRun) {
            // An empty status response is not evidence that a previously
            // displayed run disappeared. Preserve terminal state too so a
            // completed run remains visible when the console is reopened.
            this.fieldUsageRun = null;
        }
        this.fieldUsageBatchRunning = this.fieldUsageRunning;
        const run = this.fieldUsageRun;
        const jobTotal = Number(status?.jobTotal || 0);
        const jobProcessed = Number(status?.jobProcessed || 0);
        const jobErrors = Number(status?.jobErrors || 0);
        const jobStatus = status?.jobStatus || '';
        const jobType = status?.jobType || '';
        this.fieldUsageJobTotal = jobTotal;
        this.fieldUsageJobProcessed = jobProcessed;
        this.fieldUsageJobErrors = jobErrors;
        this.fieldUsageJobStatus = jobStatus;
        const lines = [];
        // An empty/partial SObject is not a real run. This can occur after an
        // async job is manually aborted while its tracking record is stale.
        if (run && run.Status__c) {
            const state = run.Status__c;
            const phase = run.Progress_Phase__c || '';
            const processed = Number(run.Objects_Processed__c || 0);
            const total = Number(run.Objects_Total__c || 0);
            const dependencies = Number(run.Dependency_Count__c || 0);
            const errors = Number(run.Error_Count__c || 0);
            lines.push({ key: 'run-' + (run.Id || state), text: '[run] ' + state + (phase ? ' · ' + phase : '') });
            if (jobStatus) lines.push({ key: 'job-' + jobStatus + '-' + jobProcessed, text: '[apex job] ' + jobStatus + (jobType ? ' · ' + jobType : '') + (jobTotal > 0 ? ' · ' + jobProcessed + ' / ' + jobTotal + ' batches processed' : '') + (jobErrors > 0 ? ' · ' + jobErrors + ' errors' : '') });
            if (total > 0) lines.push({ key: 'work-' + processed + '-' + total, text: '[work] ' + processed + ' / ' + total + ' work units processed' });
            lines.push({ key: 'evidence-' + dependencies, text: '[evidence] ' + dependencies + ' dependency records discovered' });
            if (errors > 0) lines.push({ key: 'errors-' + errors, text: '[errors] ' + errors + ' work item(s) reported errors' });
            const log = run.Progress_Log__c || '';
            log.split(/\r?\n/).filter(Boolean).forEach((text, i) => lines.push({ key: 'log-' + i, text }));
            if (state === 'Completed') lines.push({ key: 'complete-' + run.Id, text: '[complete] Snapshot ready for Field Usage Map' });
            else if (state === 'Completed With Errors') lines.push({ key: 'complete-errors-' + run.Id, text: '[complete] Scan finished with errors; snapshot was not promoted' });
            else if (state === 'Failed') lines.push({ key: 'failed-' + run.Id, text: '[failed] Scan failed. Review the run error details.' });
        }
        if (run && !run.Status__c) this.fieldUsageRun = null;
        if (!this.fieldUsageConsoleCleared) this.fieldUsageConsoleLines = lines;
        if (!this.fieldUsageRunning) this.stopFieldUsagePolling();
    }

    startFieldUsagePolling(force = false) {
        this.stopFieldUsagePolling();
        if (!this.fieldUsageConsoleOpen || (!force && !this.fieldUsageRunning)) return;
        this.fieldUsagePollTimer = window.setInterval(async () => {
            if (!this.fieldUsageConsoleOpen) {
                this.stopFieldUsagePolling();
                return;
            }
            try {
                await this.refreshFieldUsageConsole();
            } catch (e) {
                this.errorMessage = 'Field Usage status: ' + this.reduceError(e);
                this.stopFieldUsagePolling();
            }
        }, 3000);
    }

    stopFieldUsagePolling() {
        if (this.fieldUsagePollTimer) {
            window.clearInterval(this.fieldUsagePollTimer);
            this.fieldUsagePollTimer = null;
        }
    }

    handleMenuCompareOrg()     { this.openMenu = null; this.handleOpenDriftCheck(); }
    handleMenuClearCanvas()    { this.openMenu = null; this.handleClearCanvas(); }
    handleMenuSharingView()    { this.openMenu = null; this.handleToggleSharingView(); }
    handleMenuDataDictionary() { this.openMenu = null; this.handleToggleDictionary(); }
    handleMenuRunFieldUsage() { this.handleOpenFieldUsageConsole(); }
    handleMenuHeatmap()        { this.openMenu = null; this.handleToggleHeatmap(); }
    handleMenuArchitecture()   {
        this.openMenu = null;
        this.architectureOpen = !this.architectureOpen;
        if (this.architectureOpen) { this.refreshArchitectureAnalysis(); this.loadArchitectureOrgReferences(); }
    }
    handleCloseArchitecture()  { this.architectureOpen = false; this.architectureSelectedObject=''; }
    async handleExportArchitectureImage() {
        const a=this.architectureAnalysis; if(!a) return;
        try {
            const base64=await exportArchitectureReportAsPng({
                fileName:this.fileName,
                summary:this.architectureExecutiveSummary,
                reviewLead:this.architectureReviewLead,
                findings:this.architectureFindings,
                nodes:this.architectureNodes,
                domains:this.architectureDomains,
                signals:[
                    {label:'Connectivity',value:this.architectureConnectivityLabel},
                    {label:'Maximum reach',value:a.maxRelationshipDepth+' hops'},
                    {label:'Cycles',value:this.architectureCycleLabel},
                    {label:'Isolated objects',value:this.architectureIslandLabel},
                    {label:'Junctions',value:this.architectureJunctionLabel}
                ],
                relationshipMix:[
                    {label:'Lookup',value:a.lookupCount},
                    {label:'Master-Detail',value:a.masterDetailCount},
                    {label:'Polymorphic',value:a.polymorphicCount}
                ],
                metrics:[
                    {label:'Objects',value:a.entityCount},{label:'Fields',value:a.fieldCount},{label:'Relationships',value:a.relationshipCount},
                    {label:'Unique object pairs',value:a.uniqueRelationshipPairs},{label:'Unique-pair density',value:a.relationshipDensity},{label:'Average degree',value:a.averageDegree},
                    {label:'Components',value:a.componentCount},{label:'Maximum depth',value:a.maxRelationshipDepth},{label:'Parallel relationships',value:a.parallelRelationshipCount}
                ]
            });
            const safeName=(this.fileName||'architecture').replace(/[^a-z0-9_-]+/gi,'_');
            const anchor=document.createElement('a');
            anchor.href='data:image/png;base64,'+base64;
            anchor.download=safeName+'_Architecture_Intelligence.png';
            anchor.click();
        } catch(e) {
            this.architectureError='Architecture report export failed. '+(e?.message||'Unknown export error.');
        }
    }
    handleArchitectureObjectSelect(event) {
        const name=event.currentTarget.dataset.name || '';
        this.architectureSelectedObject=name;
        this.architectureSection='map';
    }
    handleArchitectureFindingInspect(event) {
        const name=event.currentTarget.dataset.name || '';
        this.architectureSelectedObject=name;
        this.architectureSection='map';
    }
    handleArchitectureMapObject(event) {
        this.architectureSelectedObject=event.target.value || '';
        this.architectureSection='map';
    }
    handleArchitectureDrillClose() { this.architectureSelectedObject=''; this.architectureSection='overview'; }
    handleArchitectureSection(event){ this.architectureSection=event.currentTarget.dataset.section||'overview'; if(this.architectureSection==='fieldimpact') this.initialiseFieldImpact(); }
    get architectureHomeTiles(){
        return [
            {key:'overview',title:'Architecture Overview',question:'What does this model look like at a glance?',detail:'See model shape, relationship mix and the areas that deserve attention first.',action:'Open Overview'},
            {key:'paths',title:'Relationship Path Finder',question:'How are two objects connected?',detail:'Choose two objects and trace the shortest relationship route between them. Object impact remains inside Object Map.',action:'Open Path Finder'},
            {key:'fieldimpact',title:'Field Change Impact',question:'What could a field change affect in the current org?',detail:'Select an object and field from the latest Field Usage snapshot, then visualise the metadata and components that reference it.',action:'Open Field Change Impact'},
            {key:'usage',title:'Object Usage & Change Readiness',question:'What does this model tell me about changing an object?',detail:'Inspect modelled usage, dependency direction and change exposure without pretending the ER file contains live org usage data.',action:'Open Object Usage'},
            {key:'relationships',title:'Relationship Insights',question:'What relationship design deserves review?',detail:'See relationship patterns, why they matter and what an architect may want to inspect or improve.',action:'Open Relationship Insights'}
        ];
    }
    handleArchitectureHome(){this.architectureSection='home';this.architectureSelectedObject='';}
    handleArchitectureReset(){
        this.architectureSelectedObject='';
        this.architecturePathSource='';
        this.architecturePathTarget='';
        this.architectureDomainAssignments={};
        this.architectureSection='home';
        this.architectureError='';
        this._architectureSource='';
        this._architectureAnalysis=null;
        this.refreshArchitectureAnalysis(true);
        this.loadArchitectureOrgReferences();
    }
    handleArchitectureRefresh(){this.handleArchitectureReset();}
    get architecturePanelClass(){return 'arch-panel arch-view-'+(this.architectureSection||'home');}
    get architectureShowHome(){return this.architectureSection==='home';}
    get architectureShowFindings(){return this.architectureSection==='findings';}
    get architectureShowRelationships(){return this.architectureSection==='relationships';}
    get architectureShowOverview(){return this.architectureSection==='overview';}
    get architectureShowMap(){return this.architectureSection==='map';}
    get architectureShowPaths(){return this.architectureSection==='paths';}
    get architectureShowDomains(){return this.architectureSection==='domains';}
    get architectureShowUsage(){return this.architectureSection==='usage';}
    get architectureShowFieldImpact(){return this.architectureSection==='fieldimpact';}
    get architectureShowMetrics(){return this.architectureSection==='metrics';}
    get architectureShowObject(){return this.architectureSection==='object';}
    async handleMenuFieldUsage() {
        this.openMenu = null;
        this.fieldUsageOpen = true;
        await this.initialiseFieldUsage();
    }

    async initialiseFieldUsage() {
        this.fieldUsageLoading = true;
        this.fieldUsageEntryMessage = '';
        this.fieldUsageObjects = [];
        this.fieldUsageFields = [];
        this.fieldUsageObject = '';
        this.fieldUsageSelectedFields = [];
        this.fieldUsageEvidence = [];
        this._fieldUsageMapCache = { nodes: [], edges: [], width: 1320, height: 650 };

        try {
            const [snapshot, status] = await Promise.all([
                fieldImpactSnapshot(),
                fieldUsageGetStatus()
            ]);

            this.fieldUsageSnapshotAvailable = !!snapshot?.available;
            const statusName = status?.run?.Status__c || '';
            this.fieldUsageBatchRunning = ['Queued', 'Running'].includes(statusName);

            if (this.fieldUsageSnapshotAvailable) {
                this.fieldUsageObjects = await fieldImpactObjects();
                this.fieldUsageEntryMessage = this.fieldUsageBatchRunning
                    ? 'A newer scan is running. Showing the latest successful snapshot.'
                    : '';
            } else if (this.fieldUsageBatchRunning) {
                this.fieldUsageEntryMessage =
                    'Field Usage scan is currently running. The map will be available after the first successful snapshot is created.';
            } else {
                this.fieldUsageEntryMessage =
                    'Field Usage requires a successful scan before it can be loaded. Run a scan from the Scan Console first.';
            }
        } catch (error) {
            this.fieldUsageSnapshotAvailable = false;
            this.fieldUsageBatchRunning = false;
            this.fieldUsageEntryMessage =
                'Field Usage snapshot status could not be loaded: ' + this.reduceError(error);
        } finally {
            this.fieldUsageLoading = false;
        }
    }

    get fieldUsageReady() {
        return !this.fieldUsageLoading && this.fieldUsageSnapshotAvailable;
    }

    get fieldUsageNeedsScan() {
        return !this.fieldUsageLoading &&
            !this.fieldUsageSnapshotAvailable &&
            !this.fieldUsageBatchRunning;
    }

    get fieldUsageWaitingForBatch() {
        return !this.fieldUsageLoading &&
            !this.fieldUsageSnapshotAvailable &&
            this.fieldUsageBatchRunning;
    }

    get fieldUsageShowEntryMessage() {
        return !!this.fieldUsageEntryMessage;
    }

    get fieldUsageObjectOptions() {
        const q=(this.fieldUsageObjectSearch||'').trim().toLowerCase();
        return (this.fieldUsageObjects || []).filter(name=>!q||name.toLowerCase().includes(q)).map((name) => ({
            label: name, value: name, selected: name===this.fieldUsageObject,
            rowClass: 'fu-picker-row'+(name===this.fieldUsageObject?' fu-picker-row-active':'')
        }));
    }

    get fieldUsageFieldOptions() {
        const q=(this.fieldUsageFieldSearch||'').trim().toLowerCase();
        const selected=new Set(this.fieldUsageSelectedFields||[]);
        return (this.fieldUsageFields || []).filter(name=>!q||name.toLowerCase().includes(q)).map((name) => ({
            label: name, value: name, selected: selected.has(name),
            rowClass: 'fu-picker-row'+(selected.has(name)?' fu-picker-row-active':'')
        }));
    }
    get fieldUsageHasObject(){return !!this.fieldUsageObject;}
    get fieldUsageHasSelection(){return (this.fieldUsageSelectedFields||[]).length>0;}
    handleFieldUsageObjectSearch(event){this.fieldUsageObjectSearch=event.target.value||'';}
    handleFieldUsageFieldSearch(event){this.fieldUsageFieldSearch=event.target.value||'';}

    async handleFieldUsageObject(event) {
        this.fieldUsageObject = event.currentTarget?.dataset?.value || event.target.value || '';
        this.fieldUsageFieldSearch='';
        this.fieldUsageSelectedFields = [];
        this.fieldUsageEvidence = [];
        this._fieldUsageMapCache = { nodes: [], edges: [], width: 1320, height: 650 };
        this.fieldUsageFields = this.fieldUsageObject
            ? await fieldUsageGetFields({ objectApiName: this.fieldUsageObject })
            : [];
    }

    handleFieldUsageFields(event) {
        if(event.currentTarget?.dataset?.value){
            const value=event.currentTarget.dataset.value;
            const selected=new Set(this.fieldUsageSelectedFields||[]);
            if(selected.has(value)) selected.delete(value); else selected.add(value);
            this.fieldUsageSelectedFields=[...selected];
            return;
        }
        const selected = Array.from(event.target.options || []).filter((option) => option.selected).map((option) => option.value);
        this.fieldUsageSelectedFields = selected.length ? selected : (event.target.value ? [event.target.value] : []);
    }

    async handleFieldUsageAnalyse() {
        if (!this.fieldUsageReady || !this.fieldUsageObject || !this.fieldUsageSelectedFields.length) {
            return;
        }
        this.fieldUsageEvidence = await fieldUsageGetEvidenceSummary({
            objectApiName: this.fieldUsageObject,
            fieldApiNames: this.fieldUsageSelectedFields
        });
        this._fieldUsageMapCache=this.rebuildFieldUsageMap();
    }

    handleCloseFieldUsage() {
        this.fieldUsageOpen = false;
    }

    handleFieldUsageClear() {
        this.fieldUsageObject = '';
        this.fieldUsageFields = [];
        this.fieldUsageSelectedFields = [];
        this.fieldUsageEvidence = [];
        this.fieldUsageZoom = 1;
        this._fieldUsageMapCache = { nodes: [], edges: [], width: 1320, height: 650 };
    }

    async initialiseFieldImpact(){this.fieldImpactLoading=true;this.clearFieldImpact(false);try{const [info,status]=await Promise.all([fieldImpactSnapshot(),fieldUsageGetStatus()]);this.fieldImpactSnapshotInfo=info;this.fieldImpactAvailable=!!info?.available;this.fieldImpactBatchStatus=status?.run?.Status__c||'';this.fieldImpactBatchRunning=['Queued','Running'].includes(this.fieldImpactBatchStatus);if(this.fieldImpactAvailable){this.fieldImpactBatchRunning=false;this.fieldImpactObjects=await fieldImpactObjects();this.fieldImpactSourceTypes=await fieldUsageGetSourceTypes();}}catch(e){this.architectureError='Field Change Impact: '+this.reduceError(e);}finally{this.fieldImpactLoading=false;}}
    get fieldImpactEmpty(){return !this.fieldImpactLoading&&!this.fieldImpactAvailable&&!this.fieldImpactBatchRunning;}
    get fieldImpactWaitingForBatch(){return !this.fieldImpactLoading&&!this.fieldImpactAvailable&&this.fieldImpactBatchRunning;}
    get fieldImpactReady(){return !this.fieldImpactLoading&&this.fieldImpactAvailable;}
    get fieldImpactFilteredObjects(){const q=(this.fieldImpactObjectSearch||'').toLowerCase(),model=new Set((this._erBoxes||[]).map(x=>(x.name||'').toLowerCase()));return this.fieldImpactObjects.filter(x=>(!model.size||model.has(x.toLowerCase()))&&(!q||x.toLowerCase().includes(q))).map(x=>({label:x,value:x}));}
    get fieldImpactSourceOptions(){return [{label:'All indexed sources',value:''},...this.fieldImpactSourceTypes.map(x=>({label:x,value:x}))];}
    get fieldImpactHasSearchResults(){return this.fieldImpactSearchResults.length>0;}
    handleFieldImpactUsageSearch(e){this.fieldImpactUsageSearch=e.target.value||'';} handleFieldImpactSourceType(e){this.fieldImpactSourceType=e.target.value||'';}
    async handleFieldImpactUsageSearchRun(){this.fieldImpactSearchBusy=true;try{this.fieldImpactSearchResults=await fieldUsageSearchEvidence({searchText:this.fieldImpactUsageSearch,sourceType:this.fieldImpactSourceType,rowLimit:500});}catch(e){this.architectureError='Field usage search: '+this.reduceError(e);}finally{this.fieldImpactSearchBusy=false;}}
    handleFieldImpactSearchClear(){this.fieldImpactUsageSearch='';this.fieldImpactSourceType='';this.fieldImpactSearchResults=[];}
    get fieldImpactSearchRows(){return this.fieldImpactSearchResults.map((r,i)=>({key:(r.Id||r.Field_Key__c||'r')+'-'+i,field:r.Field_Key__c,source:r.Source_Type__c,component:r.Component_Name__c||'—',location:r.Location__c||r.Evidence_Type__c||'—',count:r.Occurrence_Count__c||1}));}
    get fieldImpactFilteredFields(){const q=(this.fieldImpactFieldSearch||'').toLowerCase();return this.fieldImpactFields.filter(x=>!q||x.toLowerCase().includes(q)).map(x=>({label:x,value:x}));}
    handleFieldImpactObjectSearch(e){this.fieldImpactObjectSearch=e.target.value||'';} handleFieldImpactFieldSearch(e){this.fieldImpactFieldSearch=e.target.value||'';}
    async handleFieldImpactObject(e){this.fieldImpactObject=e.target.value||'';this.fieldImpactField='';this.fieldImpactEvidence=[];this.fieldImpactFieldSearch='';this.fieldImpactFields=this.fieldImpactObject?await fieldUsageGetFields({objectApiName:this.fieldImpactObject}):[];}
    async handleFieldImpactField(e){this.fieldImpactField=e.target.value||'';this.fieldImpactEvidence=this.fieldImpactField?await fieldUsageGetEvidenceSummary({objectApiName:this.fieldImpactObject,fieldApiNames:[this.fieldImpactField]}):[];this._fieldImpactMapCache=this.rebuildFieldImpactMap();}
    clearFieldImpact(clearAvailability=true){this.fieldImpactObject='';this.fieldImpactField='';this.fieldImpactObjectSearch='';this.fieldImpactFieldSearch='';this.fieldImpactFields=[];this.fieldImpactEvidence=[];this._fieldImpactMapCache={nodes:[],edges:[],width:1160,height:600};this.fieldImpactZoom=1;this.fieldImpactUsageSearch='';this.fieldImpactSourceType='';this.fieldImpactSearchResults=[];if(clearAvailability){this.fieldImpactAvailable=false;this.fieldImpactObjects=[];this.fieldImpactSnapshotInfo=null;}}
    handleFieldImpactClear(){this.clearFieldImpact(false);}
    handleFieldImpactBack(){this.clearFieldImpact(false);this.architectureSection='home';}
    async handleFieldImpactRunBatch(){await this.handleOpenFieldUsageConsole();}
    handleFieldImpactZoomIn(){this.fieldImpactZoom=Math.min(1.6,this.fieldImpactZoom+.1);} handleFieldImpactZoomOut(){this.fieldImpactZoom=Math.max(.5,this.fieldImpactZoom-.1);} handleFieldImpactZoomReset(){this.fieldImpactZoom=1;}
    get fieldImpactHasMap(){return !!this.fieldImpactField;}
    get fieldImpactNoReferences(){return !!this.fieldImpactField&&!this.fieldImpactEvidence.length;}
    async handleFieldImpactNodeClick(e){
        const field=e.currentTarget.dataset.field,source=e.currentTarget.dataset.source;if(!field||!source)return;
        const existing=this.fieldImpactEvidence.filter(r=>r._detail&&r.Field_API_Name__c===field&&r.Source_Type__c===source),last=existing.length?existing[existing.length-1]:null;
        const page=await fieldUsageGetEvidenceDetail({objectApiName:this.fieldImpactObject,fieldApiName:field,sourceType:source,rowLimit:500,afterId:last?.Id||null});
        this.fieldImpactEvidence=[...this.fieldImpactEvidence.filter(r=>!(r._pageState&&r.Field_API_Name__c===field&&r.Source_Type__c===source)),...(page.rows||[]).map(r=>({...r,_detail:true})),{_pageState:true,Field_API_Name__c:field,Source_Type__c:source,hasMore:!!page.hasMore,nextCursor:page.nextCursor}];this._fieldImpactMapCache=this.rebuildFieldImpactMap();
    }
    rebuildFieldImpactMap(){
        const rows=this.fieldImpactEvidence||[],nodes=[],edges=[];const add=(key,label,sub,x,y,kind,extra={})=>nodes.push({key,label,sub,x,y,kind,...extra,style:'left:'+x+'px;top:'+y+'px;'});
        const connect=(a,b)=>{const A=nodes.find(n=>n.key===a),B=nodes.find(n=>n.key===b);if(A&&B)edges.push({key:a+'>'+b,x1:A.x+205,y1:A.y+38,x2:B.x,y2:B.y+38});};
        add('field',this.fieldImpactObject+'.'+this.fieldImpactField,'FIELD BEING CHANGED',35,160,'impactfield');
        const summaries=rows.filter(r=>!r._detail&&r.fieldApiName);if(!summaries.length){add('no-usage','No dependency detected','Current successful snapshot · 0 dependencies',335,160,'impactempty');connect('field','no-usage');return {nodes,edges,width:700,height:600};}
        let y=45;summaries.forEach(r=>{const key='summary:'+r.sourceType;const details=rows.filter(d=>d._detail&&d.Source_Type__c===r.sourceType),pageState=rows.find(d=>d._pageState&&d.Source_Type__c===r.sourceType);add(key,r.sourceType,(r.occurrences||r.evidenceRows||0)+' usages · '+(!details.length?'click to expand':pageState?.hasMore?'click to load more':details.length+' details loaded'),335,y,'impacttype',{field:this.fieldImpactField,source:r.sourceType,expandable:true});connect('field',key);if(details.length){const names=[...new Set(details.map(d=>d.Component_Name__c))];names.forEach((name,i)=>{const ck=key+':'+i;add(ck,name,details.filter(d=>d.Component_Name__c===name).reduce((n,d)=>n+(d.Occurrence_Count__c||1),0)+' usages',620,y+i*82,'impactcomponent');connect(key,ck);});y+=Math.max(100,names.length*82);}else y+=100;});
        return {nodes,edges,width:900,height:Math.max(600,y+60)};
    }
    get fieldImpactNodes(){return this._fieldImpactMapCache.nodes;} get fieldImpactEdges(){return this._fieldImpactMapCache.edges;}
    get fieldImpactCanvasStyle(){const m=this._fieldImpactMapCache;return 'width:'+m.width+'px;height:'+m.height+'px;transform:scale('+this.fieldImpactZoom+');transform-origin:0 0;';}
    get architecturePathVisual(){
        const r=this.architecturePathResult;if(!r?.found)return [];
        const relationships=this.architectureAnalysis?.relationships||[];
        return r.path.map((name,i)=>{
            if(i===r.path.length-1)return {key:name+'-'+i,name,step:i+1,hasArrow:false};
            const next=r.path[i+1];
            const rel=relationships.find(x=>(x.childEntity===name&&x.parentEntity===next)||(x.childEntity===next&&x.parentEntity===name));
            const raw=(rel?.kind||'Lookup').toLowerCase(),kind=raw.includes('master')?'Master Detail':raw.includes('poly')?'Polymorphic':'Lookup';
            return {key:name+'-'+i,name,step:i+1,hasArrow:true,next,kind,edgeClass:'arch-path-edge arch-path-edge-'+(kind==='Master Detail'?'master':kind==='Polymorphic'?'poly':'lookup'),fieldName:rel?.fieldName||rel?.field||''};
        });
    }
    handleArchitectureUsageObject(event){this.architectureSelectedObject=event.target.value||'';this.architectureSection='usage';}
    get architectureUsageDetail(){
        const d=this.architectureObjectDetail;if(!d)return null;
        const standard=!/__c$/i.test(d.name);
        const junction=(this.architectureJunctions||[]).find(x=>x.name.toLowerCase()===d.name.toLowerCase());
        const relationships=(this.architectureAnalysis?.relationships||[]).filter(r=>r.childEntity===d.name||r.parentEntity===d.name);
        const groupRelationships=(rows,prefix,nameSelector,direction)=>{
            const groups=new Map();
            rows.forEach((r,i)=>{
                const name=nameSelector(r);
                const key=(name||'').toLowerCase();
                if(!key)return;
                if(!groups.has(key))groups.set(key,{key:prefix+'-'+key,name,relationships:[],direction});
                groups.get(key).relationships.push({key:prefix+'-'+key+'-'+i,kind:r.kind||'Lookup',field:r.childField||r.fieldName||r.field||''});
            });
            return [...groups.values()].map(g=>({...g,relationshipCount:g.relationships.length,relationshipLabel:g.relationships.length===1?'1 relationship':g.relationships.length+' relationships'}));
        };
        const inbound=groupRelationships(relationships.filter(r=>r.parentEntity===d.name),'in',r=>r.childEntity,'depends on this object');
        const outbound=groupRelationships(relationships.filter(r=>r.childEntity===d.name),'out',r=>r.parentEntity,'this object depends on');
        let status,observation;
        if(standard){
            status=d.degree?'Standard object · modelled usage detected':'Standard object · no relationships represented';
            observation=d.degree?'This is a standard Salesforce object and is not a removal candidate. It participates in the current ER model, so use this analysis only to understand relationship and change impact around it.':'This is a standard Salesforce object and is not a removal candidate. No structural relationships are represented for it in the current ER model, but that does not mean it is unused in Salesforce.';
        } else if(d.degree===0){
            status='Structurally isolated in this model';
            observation='No relationship dependency is represented for this custom object in the current ER model. This is not evidence that the object has zero records or is safe to remove. Verify records, automation, code, integrations, reports and metadata outside this diagram before any retirement decision.';
        } else {
            status='Modelled dependencies detected';
            observation='This custom object is structurally in use in the current ER model. Changing, migrating or considering retirement requires review of the modelled dependencies below. Dependencies outside the supplied ER model remain unknown.';
        }
        // parseEr creates placeholder entities for relationship targets that are not
        // explicitly declared in the DSL. Preserve that distinction here: a target
        // such as Account can be modelled by a relationship while still being
        // outside the set of entity declarations supplied by the user.
        const declaredNames=new Set();
        (this._architectureSource||this.sourceText||'').split(/\r?\n/).forEach(line=>{
            const match=line.trim().match(/^entity\s+(\w+)\b/i);
            if(match)declaredNames.add(match[1].toLowerCase());
        });
        const externalRefs=[...inbound,...outbound].filter(x=>!declaredNames.has((x.name||'').toLowerCase()));
        const externalByName=new Map();
        externalRefs.forEach(x=>{
            const key=(x.name||'').toLowerCase();
            if(!key)return;
            if(!externalByName.has(key))externalByName.set(key,{...x,key:'external-'+key});
        });
        const outsideDiagram=[...externalByName.values()];
        return {name:d.name,standard,custom:!standard,type:standard?'Standard Salesforce object':'Custom object',status,degree:d.degree,incoming:d.incoming,outgoing:d.outgoing,fieldCount:d.fieldCount,reach:d.reachableWithin3,junction:!!junction,junctionText:junction?junction.pattern:'No junction pattern detected',inbound,outbound,hasInbound:inbound.length>0,hasOutbound:outbound.length>0,outsideDiagram,hasOutsideDiagram:outsideDiagram.length>0,observation};
    }
    get architectureHasUsageDetail(){return !!this.architectureUsageDetail;}
    get architectureUsageDependencyNodes(){
        const u=this.architectureUsageDetail;if(!u)return [];
        return [...u.inbound.map(x=>({...x,side:'Inbound'})),...u.outbound.map(x=>({...x,side:'Outbound'}))];
    }
    get architectureUsageOrgReferences(){
        const selected=(this.architectureSelectedObject||'').toLowerCase();
        if(!selected)return [];
        const diagramNames=new Set((this.architectureNodes||[]).map(n=>(n.name||'').toLowerCase()));
        return (this.architectureOrgReferences||[])
            .filter(r=>(r.sourceObject||'').toLowerCase()===selected||(r.targetObject||'').toLowerCase()===selected)
            .map((r,i)=>{
                const sourceInside=diagramNames.has((r.sourceObject||'').toLowerCase());
                const targetInside=diagramNames.has((r.targetObject||'').toLowerCase());
                return {...r,key:'org-ref-'+i,sourceInside,targetInside,outsideDiagram:!sourceInside||!targetInside,
                    path:(r.sourceObject||'')+'.'+(r.fieldApiName||'')+' → '+(r.targetObject||''),
                    scope:(!sourceInside||!targetInside)?'Outside current ER':'Also represented in current ER'};
            });
    }
    get architectureUsageOutsideOrgReferences(){return this.architectureUsageOrgReferences.filter(r=>r.outsideDiagram);}
    get architectureHasUsageOutsideOrgReferences(){return this.architectureUsageOutsideOrgReferences.length>0;}
    get architectureUsageOrgDiagram(){
        const selected=this.architectureSelectedObject||'';
        const selectedKey=selected.toLowerCase();
        const rows=this.architectureUsageOutsideOrgReferences||[];
        const auditFields=new Set(['createdbyid','lastmodifiedbyid','systemmodstamp']);
        const ownershipFields=new Set(['ownerid']);
        const groups=new Map();
        const add=(name,row,direction)=>{
            const key=(name||'').toLowerCase();
            if(!key)return;
            if(!groups.has(key))groups.set(key,{key:'org-node-'+key,name,relationships:[],businessCount:0,ownershipCount:0,auditCount:0});
            const g=groups.get(key);
            const field=(row.fieldApiName||'');
            const fieldKey=field.toLowerCase();
            const category=auditFields.has(fieldKey)?'System audit':ownershipFields.has(fieldKey)?'Ownership':'Schema relationship';
            g.relationships.push({key:g.key+'-'+g.relationships.length,field,kind:row.relationshipType,category,direction});
            if(category==='System audit')g.auditCount++;else if(category==='Ownership')g.ownershipCount++;else g.businessCount++;
        };
        rows.forEach(row=>{
            if((row.targetObject||'').toLowerCase()===selectedKey)add(row.sourceObject,row,'references selected object');
            if((row.sourceObject||'').toLowerCase()===selectedKey)add(row.targetObject,row,'referenced by selected object');
        });
        const dependencies=[...groups.values()].map(g=>({
            ...g,
            relationshipCount:g.relationships.length,
            relationshipLabel:g.relationships.length===1?'1 reference':g.relationships.length+' references'
        })).sort((a,b)=>a.name.localeCompare(b.name));
        return {selected,dependencies,hasDependencies:dependencies.length>0};
    }

    get architectureUsageEvidenceNote(){return 'Evidence scope: the current ER model plus Salesforce schema relationship metadata loaded when Architecture Intelligence opens. This finds reference fields on objects outside the diagram, but does not infer Apex, Flow, reports, integrations, record counts or runtime usage.';}
    get architectureObjectDetail() { return this.architectureSelectedObject ? analyseObject(this.architectureAnalysis,this.architectureSelectedObject) : null; }
    get architectureHasObjectDetail() { return !!this.architectureObjectDetail; }
    get architectureObjectGraphNodes(){
        const d=this.architectureObjectDetail;if(!d)return [];
        const out=[{key:'focus-'+d.name,name:d.name,role:'Selected object',kind:'focus'}];
        (d.parents||[]).forEach((x,i)=>out.push({key:'parent-'+i+'-'+x.name,name:x.name,role:(x.field?'via '+x.field:'Parent / target'),kind:'parent'}));
        (d.children||[]).forEach((x,i)=>out.push({key:'child-'+i+'-'+x.name,name:x.name,role:(x.field?'via '+x.field:'Child / dependant'),kind:'child'}));
        return out;
    }
    get architectureObjectParentGraphNodes(){return this.architectureObjectGraphNodes.filter(x=>x.kind==='parent');}
    get architectureObjectChildGraphNodes(){return this.architectureObjectGraphNodes.filter(x=>x.kind==='child');}
    get architectureObjectInsightText(){
        const d=this.architectureObjectDetail;if(!d)return '';
        const direction=d.incoming>d.outgoing?'more relationships point into it than out of it':d.outgoing>d.incoming?'it points to more objects than point into it':'incoming and outgoing relationships are balanced';
        return d.name+' has '+d.degree+' direct relationships and '+d.reachableWithin3+' other objects reachable within three hops. '+direction+'. Use this view to understand direct dependency direction before reviewing the wider blast radius.';
    }
    get architectureObjectParentsText() { const d=this.architectureObjectDetail; return d?.parents?.length ? d.parents.map(x=>x.name+(x.field?' via '+x.field:'')).join(', ') : 'None in current model'; }
    get architectureObjectChildrenText() { const d=this.architectureObjectDetail; return d?.children?.length ? d.children.map(x=>x.name+(x.field?' via '+x.field:'')).join(', ') : 'None in current model'; }
    get architectureObjectCyclesText() { const d=this.architectureObjectDetail; return d?.cycles?.length ? d.cycles.map(c=>c.join(' → ')).join(' | ') : 'No detected cycles involving this object.'; }
    get architectureObjectReach() { const d=this.architectureObjectDetail; return d ? [d.reach1,d.reach2,d.reach3] : []; }
    handleArchitecturePathSource(event) { this.architecturePathSource=event.target.value; }
    handleArchitecturePathTarget(event) { this.architecturePathTarget=event.target.value; }
    get architectureObjectOptions() { return [{label:'Select object',value:''},...this.architectureNodes.map(n=>({label:n.name,value:n.name}))]; }
    get architectureCustomObjectOptions() { return [{label:'Select custom object',value:''},...this.architectureNodes.filter(n=>/__c$/i.test(n.name)).map(n=>({label:n.name,value:n.name}))]; }
    get architectureObjectMapSummary() {
        const d=this.architectureObjectDetail;if(!d)return '';
        return d.name+' is classified as '+d.role.toLowerCase()+'. It has '+d.incoming+' incoming and '+d.outgoing+' outgoing relationships, '+d.fieldCount+' fields, and '+d.reachableWithin3+' other objects reachable within three relationship hops.';
    }
    get architectureObjectMapDomain() {
        if(!this.architectureSelectedObject)return 'Unassigned';
        const raw=this.architectureDomainAssignments[this.architectureSelectedObject]||this.architectureDomainAssignments[this.architectureSelectedObject.toLowerCase()]||'';
        return raw||'Unassigned';
    }
    get architectureObjectMapObservation() {
        const d=this.architectureObjectDetail;if(!d)return '';
        if(d.degree===0)return 'This object is isolated in the current ER model. No structural relationship dependency is represented around it.';
        if(d.parents.length>=2&&/__c$/i.test(d.name))return 'This custom object references multiple parent objects. Review whether it acts as an association or junction in the business model.';
        if(d.incoming>d.outgoing*2)return 'This object is predominantly referenced by other objects, so it behaves as a structural target or shared reference point in this model.';
        if(d.outgoing>d.incoming*2)return 'This object predominantly references other objects, so its local architecture is dependency-heavy in the outbound direction.';
        return 'Incoming and outgoing relationships are comparatively balanced. Use the parent and child groups below to inspect its immediate architectural neighbourhood.';
    }
    get architecturePathResult() { return this.architecturePathSource&&this.architecturePathTarget ? findArchitecturePath(this.architectureAnalysis,this.architecturePathSource,this.architecturePathTarget) : null; }
    get architecturePathReady() { return !!this.architecturePathResult; }
    get architecturePathFound() { return !!this.architecturePathResult?.found; }
    get architecturePathText() { const r=this.architecturePathResult; return r?.found ? r.path.join(' → ') : 'No structural relationship path exists between the selected objects in the current model.'; }
    get architectureBlastRadius() { return this.architectureSelectedObject ? analyseBlastRadius(this.architectureAnalysis,this.architectureSelectedObject,3) : null; }
    get architectureBlastLevels() { return (this.architectureBlastRadius?.levels||[]).map(level=>({...level,key:'impact-'+level.depth,objectText:level.objects.length?level.objects.join(', '):'No additional objects at this distance',meaning:level.depth===1?'Direct dependencies. These objects have an immediate structural relationship with the selected object and are the first regression and design review scope.':level.depth===2?'Secondary dependencies. These are not directly related to the selected object, but a change can reach them through one intermediate object.':'Wider model reach. These objects sit further away and are useful for understanding broader regression, integration and ownership scope.'})); }
    get architectureHasImpactSelection(){return !!this.architectureSelectedObject;}
    get architectureImpactSummary(){
        const b=this.architectureBlastRadius;if(!b)return '';
        return b.source+' can reach '+b.total+' other object'+(b.total===1?'':'s')+' within '+b.maxDepth+' relationship hops. This is structural impact evidence, not a claim that every reachable object will functionally break. Use the direct level as the immediate review scope, then widen testing and ownership review where the relationship semantics justify it.';
    }
    get architectureJunctions() { return detectJunctionObjects(this.architectureAnalysis).slice(0,12); }
    get architectureRelationshipGraph(){
        const a=this.architectureAnalysis;if(!a)return {nodes:[],edges:[],style:''};
        // Relationship Insights intentionally omits self relationships. They add visual
        // noise here and are not a dependency between two different objects.
        const relationships=(a.relationships||[]).filter(r=>(r.childEntity||'').toLowerCase()!==(r.parentEntity||'').toLowerCase());
        const source=(a.nodes||[]).filter(n=>relationships.some(r=>r.childEntity===n.name||r.parentEntity===n.name));
        if(!source.length)return {nodes:[],edges:[],style:'width:900px;height:430px'};

        // Build a deterministic layered layout. Objects referenced by many others sit
        // higher; dependent objects sit lower. This reduces the centre-crossing caused
        // by the old degree-sorted square grid.
        const names=new Set(source.map(n=>n.name));
        const incoming=new Map(),outgoing=new Map();
        source.forEach(n=>{incoming.set(n.name,0);outgoing.set(n.name,0);});
        relationships.forEach(r=>{if(names.has(r.childEntity)&&names.has(r.parentEntity)){outgoing.set(r.childEntity,(outgoing.get(r.childEntity)||0)+1);incoming.set(r.parentEntity,(incoming.get(r.parentEntity)||0)+1);}});
        const rank=new Map();
        source.forEach(n=>rank.set(n.name,0));
        for(let pass=0;pass<source.length;pass++){
            let changed=false;
            relationships.forEach(r=>{
                if(!names.has(r.childEntity)||!names.has(r.parentEntity))return;
                const next=Math.min(source.length-1,(rank.get(r.parentEntity)||0)+1);
                if(next>(rank.get(r.childEntity)||0)){rank.set(r.childEntity,next);changed=true;}
            });
            if(!changed)break;
        }
        // Cycles can push ranks indefinitely during relaxation; compress ranks into
        // stable ordered bands using dependency tendency as a tie-breaker.
        const ordered=[...source].sort((x,y)=>{
            const rx=rank.get(x.name)||0,ry=rank.get(y.name)||0;
            if(rx!==ry)return rx-ry;
            const sx=(incoming.get(x.name)||0)-(outgoing.get(x.name)||0),sy=(incoming.get(y.name)||0)-(outgoing.get(y.name)||0);
            return sy-sx||x.name.localeCompare(y.name);
        });
        const maxPerRow=Math.max(3,Math.ceil(Math.sqrt(source.length*1.4)));
        const layers=[];
        ordered.forEach(n=>{
            const desired=Math.min(rank.get(n.name)||0,Math.max(0,Math.ceil(source.length/maxPerRow)-1));
            while(layers.length<=desired)layers.push([]);
            layers[desired].push(n);
        });
        // Avoid one overloaded band while preserving rank ordering.
        const balanced=[];
        layers.forEach(layer=>{
            layer.sort((x,y)=>((incoming.get(y.name)||0)+(outgoing.get(y.name)||0))-((incoming.get(x.name)||0)+(outgoing.get(x.name)||0))||x.name.localeCompare(y.name));
            for(let i=0;i<layer.length;i+=maxPerRow)balanced.push(layer.slice(i,i+maxPerRow));
        });
        const cellW=230,cellH=155,padX=80,padY=65,nodeW=170,nodeH=58;
        const widest=Math.max(...balanced.map(x=>x.length),1);
        const width=Math.max(900,padX*2+(widest-1)*cellW+nodeW);
        const nodes=[];
        balanced.forEach((layer,row)=>{
            const rowWidth=(layer.length-1)*cellW+nodeW;
            const startX=Math.max(padX,(width-rowWidth)/2);
            layer.forEach((n,col)=>{
                const x=startX+col*cellW,y=padY+row*cellH;
                nodes.push({...n,key:'rn-'+n.name,x,y,style:'left:'+x+'px;top:'+y+'px'});
            });
        });
        const pos=new Map(nodes.map(n=>[n.name.toLowerCase(),n])),edges=[];
        relationships.forEach((rel,i)=>{
            const child=pos.get((rel.childEntity||'').toLowerCase()),parent=pos.get((rel.parentEntity||'').toLowerCase());
            if(!child||!parent||child===parent)return;
            const raw=(rel.kind||'Lookup').toLowerCase(),kind=raw.includes('master')?'Master Detail':raw.includes('poly')?'Polymorphic':'Lookup';
            // Anchor vertically between layers where possible, falling back to side
            // anchors for same-row relationships.
            let sx,sy,tx,ty;
            if(Math.abs(child.y-parent.y)>20){
                const childBelow=child.y>parent.y;
                sx=child.x+nodeW/2;sy=childBelow?child.y:child.y+nodeH;
                tx=parent.x+nodeW/2;ty=childBelow?parent.y+nodeH:parent.y;
            }else{
                const childRight=child.x>parent.x;
                sx=childRight?child.x:child.x+nodeW;sy=child.y+nodeH/2;
                tx=childRight?parent.x+nodeW:parent.x;ty=parent.y+nodeH/2;
            }
            const dx=tx-sx,dy=ty-sy,len=Math.max(24,Math.sqrt(dx*dx+dy*dy)),angle=Math.atan2(dy,dx)*180/Math.PI;
            edges.push({key:'re-'+i,kind,className:'arch-rel-graph-edge arch-rel-graph-'+(kind==='Master Detail'?'master':kind==='Polymorphic'?'poly':'lookup'),style:'left:'+sx+'px;top:'+sy+'px;width:'+len+'px;transform:rotate('+angle+'deg)',title:child.name+' → '+parent.name+' · '+kind});
        });
        const height=Math.max(430,padY*2+(balanced.length-1)*cellH+nodeH);
        return {nodes,edges,style:'width:'+width+'px;height:'+height+'px'};
    }
    get architectureRelationshipGraphNodes(){return this.architectureRelationshipGraph.nodes;}
    get architectureRelationshipGraphEdges(){return this.architectureRelationshipGraph.edges;}
    get architectureRelationshipGraphStyle(){return this.architectureRelationshipGraph.style;}
    get architectureRelationshipExplanation(){
        const a=this.architectureAnalysis;if(!a)return '';
        const visible=(a.relationships||[]).filter(r=>(r.childEntity||'').toLowerCase()!==(r.parentEntity||'').toLowerCase()).length;
        return 'This view shows '+visible+' relationship'+(visible===1?'':'s')+' between different objects. Self relationships are intentionally omitted from Relationship Insights to keep this dependency view readable. Arrows run from the child object to the referenced parent. Lookup represents a loose reference, Master Detail represents stronger parent ownership semantics, and Polymorphic means the relationship can reference more than one supported object type.';
    }

    get architectureRelationshipSummaryRows(){
        const a=this.architectureAnalysis;if(!a)return [];
        const declaredNames=new Set();
        (this._architectureSource||this.sourceText||'').split(/\r?\n/).forEach(line=>{const m=line.trim().match(/^entity\s+(\w+)\b/i);if(m)declaredNames.add(m[1].toLowerCase());});
        return (a.relationships||[]).filter(r=>(r.childEntity||'').toLowerCase()!==(r.parentEntity||'').toLowerCase()).map((r,i)=>{
            const raw=(r.kind||'lookup').toLowerCase(),kind=raw.includes('master')?'Master Detail':raw.includes('poly')?'Polymorphic':'Lookup';
            const field=r.fieldName||r.childField||r.field||'';
            const parentExternal=!declaredNames.has((r.parentEntity||'').toLowerCase());
            const childCustom=/__c$/i.test(r.childEntity||''),parentCustom=/__c$/i.test(r.parentEntity||'');
            const isSelf=(r.childEntity||'').toLowerCase()===(r.parentEntity||'').toLowerCase();
            let recordImpact,changeImpact;
            if(isSelf){
                recordImpact='Self relationship: records of '+r.childEntity+' can reference other records of the same object. The ER model shows the recursive reference but cannot determine which records are populated, hierarchy depth, delete handling, automation or whether removing one record affects other records. Verify the field configuration and org behaviour before drawing record-level conclusions.';
                changeImpact='Treat this as an intra-object dependency, not a dependency between two different objects. Changing or removing the relationship field can affect hierarchy or recursive business logic within '+r.childEntity+', but the ER model alone cannot determine the runtime impact.';
            }else if(kind==='Master Detail'){
                recordImpact='Strong lifecycle dependency. In Salesforce, deleting a master record normally deletes its detail records through cascade delete; confirm org configuration and business rules before destructive changes.';
                changeImpact='Changing this relationship can affect ownership, sharing, required parent association, roll-up behaviour and record lifecycle. Treat both objects as one change scope.';
            }else if(kind==='Polymorphic'){
                recordImpact='The child field can reference more than one supported target type. Removing one target record affects only references to that target; the ER model does not prove runtime automation or data behaviour.';
                changeImpact='Review every represented target for this polymorphic field because code, automation and reporting may branch by target type.';
            }else{
                recordImpact='Lookup is a reference dependency. Deleting a referenced record does not imply cascade deletion from this ER model; actual delete behaviour and automation must be verified in Salesforce.';
                changeImpact='Changes to the parent or lookup field can affect joins, filters, automation, reporting and integrations that use the reference.';
            }
            return {key:'rel-summary-'+i,child:r.childEntity,parent:r.parentEntity,field,kind,isSelf,dependencyText:isSelf?r.childEntity+' has a self relationship through '+field:r.childEntity+' depends on '+r.parentEntity,parentExternal,parentScope:parentExternal?'Referenced outside declared diagram':'Declared in diagram',childType:childCustom?'Custom':'Standard',parentType:parentCustom?'Custom':'Standard',recordImpact,changeImpact};
        });
    }
    get architectureObjectDependencySummaries(){
        const a=this.architectureAnalysis;if(!a)return [];
        const declaredNames=new Set();
        (this._architectureSource||this.sourceText||'').split(/\r?\n/).forEach(line=>{const m=line.trim().match(/^entity\s+(\w+)\b/i);if(m)declaredNames.add(m[1].toLowerCase());});
        return (a.nodes||[]).filter(n=>declaredNames.has((n.name||'').toLowerCase())).map(n=>{
            const nonSelf=(a.relationships||[]).filter(r=>(r.childEntity||'').toLowerCase()!==(r.parentEntity||'').toLowerCase());
            const outgoing=nonSelf.filter(r=>r.childEntity===n.name);
            const incoming=nonSelf.filter(r=>r.parentEntity===n.name);
            const fmt=r=>(r.parentEntity||'')+' via '+(r.fieldName||r.childField||r.field||'relationship')+' ('+((r.kind||'lookup').toLowerCase().includes('master')?'Master Detail':(r.kind||'lookup').toLowerCase().includes('poly')?'Polymorphic':'Lookup')+')';
            const depBy= r=>(r.childEntity||'')+' via '+(r.fieldName||r.childField||r.field||'relationship')+' ('+((r.kind||'lookup').toLowerCase().includes('master')?'Master Detail':(r.kind||'lookup').toLowerCase().includes('poly')?'Polymorphic':'Lookup')+')';
            const external=outgoing.filter(r=>!declaredNames.has((r.parentEntity||'').toLowerCase())).map(r=>r.parentEntity);
            return {key:'obj-dep-'+n.name,name:n.name,outgoingCount:outgoing.length,incomingCount:incoming.length,dependsOn:outgoing.length?outgoing.map(fmt).join(' · '):'No outbound dependencies represented',dependedOnBy:incoming.length?incoming.map(depBy).join(' · '):'No inbound dependencies represented',externalText:external.length?[...new Set(external)].join(', '):'None explicitly referenced',isStandard:!/__c$/i.test(n.name)};
        });
    }
    get architectureJunctionExplanation(){return 'Junction Intelligence reviews customer controlled relationship metadata only. Salesforce standard relationships are treated as platform context and are not redesign suggestions. A custom object with two Master Detail relationships to different parents is shown as a strong structural junction pattern, not as a guaranteed business conclusion.';}
    get architectureJunctionInsights(){return this.architectureJunctions.map(j=>({...j,reviewLabel:j.pattern,meaning:j.pattern==='Strong junction pattern'?'This custom object has at least two custom Master Detail relationships to different parent objects. That is structurally consistent with the classic Salesforce junction pattern, but business intent still needs confirmation.':'This custom object has multiple customer controlled parent relationships. It may represent an association pattern, but the metadata alone is not enough to call it a junction object.',suggestion:j.pattern==='Strong junction pattern'?'Confirm that the object exists to associate the parent records and that Master Detail ownership, sharing and delete behaviour are intentional.':'Review the custom relationships and confirm they represent one coherent association responsibility. No redesign is implied merely because multiple parents exist.'}));}
    get architectureHasJunctions() { return this.architectureJunctions.length>0; }
    handleArchitectureDomainChange(event) { const name=event.currentTarget.dataset.name,value=event.target.value||''; this.architectureDomainAssignments={...this.architectureDomainAssignments,[name]:value}; }
    get architectureDomainRows() { return this.architectureNodes.map(n=>({name:n.name,domain:this.architectureDomainAssignments[n.name]||''})); }
    get architectureDomainAnalysis() { return analyseDomains(this.architectureAnalysis,this.architectureDomainAssignments); }
    get architectureDomains() { return this.architectureDomainAnalysis.domains; }
    get architectureDomainCouplings() { return this.architectureDomainAnalysis.couplings; }
    get architectureDomainVisuals() {
        const rows=this.architectureDomainRows;
        return this.architectureDomains.map((d,i)=>({
            ...d,key:d.name,
            objects:rows.filter(r=>(r.domain||'').trim().toLowerCase()===d.name.toLowerCase()).map(r=>({key:d.name+'-'+r.name,name:r.name})),
            accentClass:'arch-domain-card arch-domain-tone-'+(i%4)
        }));
    }
    get architectureCrossDomainRelationships() {
        return (this.architectureDomainAnalysis.crossRelationships||[]).map((r,i)=>{
            const raw=(r.kind||'Lookup').toLowerCase(),kind=raw.includes('master')?'Master Detail':raw.includes('poly')?'Polymorphic':'Lookup';
            return {...r,key:'cross-'+i,kind,kindClass:'arch-domain-rel arch-domain-rel-'+(kind==='Master Detail'?'master':kind==='Polymorphic'?'poly':'lookup'),
                explanation:r.childEntity+' in '+r.childDomain+' references '+r.parentEntity+' in '+r.parentDomain+' using '+kind+(r.fieldName?' through '+r.fieldName:'')+'.'};
        });
    }
    get architectureHasCrossDomainRelationships(){return this.architectureCrossDomainRelationships.length>0;}
    get architectureDomainSummaryText(){
        const ds=this.architectureDomains,cross=this.architectureCrossDomainRelationships;
        if(!ds.length)return 'Assign at least one object to a domain to begin domain analysis.';
        if(!cross.length)return ds.length+' domain'+(ds.length===1?' is':'s are')+' defined and no cross-domain relationships are currently detected among assigned objects.';
        return ds.length+' domains are defined. '+cross.length+' relationship'+(cross.length===1?' crosses':'s cross')+' a domain boundary. These are useful review points because one business capability depends structurally on another.';
    }
    get architectureDomainHealthCards() {
        const domains=this.architectureDomains||[], rows=this.architectureDomainRows||[], analysis=this.architectureAnalysis;
        if(!domains.length||!analysis)return [];
        const assigned=new Set(rows.filter(r=>(r.domain||'').trim()).map(r=>r.name.toLowerCase()));
        return domains.map(d=>{
            const members=rows.filter(r=>(r.domain||'').trim().toLowerCase()===d.name.toLowerCase()).map(r=>r.name);
            const memberSet=new Set(members.map(x=>x.toLowerCase()));
            const memberNodes=(analysis.nodes||[]).filter(n=>memberSet.has(n.name.toLowerCase()));
            const customCount=memberNodes.filter(n=>/__c$/i.test(n.name)).length;
            const standardCount=memberNodes.length-customCount;
            const totalLinks=(d.internalRelationships||0)+(d.crossDomainRelationships||0);
            const boundaryPct=totalLinks?Math.round((d.crossDomainRelationships||0)*100/totalLinks):0;
            const cohesionPct=totalLinks?100-boundaryPct:100;
            const isolated=memberNodes.filter(n=>(n.degree||0)===0).map(n=>n.name);
            const junctions=(this.architectureJunctions||[]).filter(x=>memberSet.has(x.name.toLowerCase())).map(x=>x.name);
            let posture='Self contained';
            if(boundaryPct>=50)posture='Boundary heavy';
            else if(boundaryPct>=25)posture='Externally coupled';
            else if(d.crossDomainRelationships>0)posture='Mostly cohesive';
            const review=d.crossDomainRelationships===0
                ? (domains.length===1?'Only one domain is defined, so boundary quality cannot yet be evaluated. Split objects into meaningful business capabilities if the model genuinely contains more than one.':'No relationship crosses this domain boundary in the current model.')
                : boundaryPct>=50?'A large share of this domain’s relationships cross its boundary. Confirm the grouping represents a real business capability rather than a convenient label.'
                : 'Most relationships remain inside the domain. Review the boundary contracts below to confirm the external dependencies are intentional.';
            return {key:'health-'+d.name,name:d.name,posture,cohesionPct,boundaryPct,customCount,standardCount,junctionCount:junctions.length,junctionText:junctions.length?junctions.join(', '):'None detected',isolatedCount:isolated.length,isolatedText:isolated.length?isolated.join(', '):'None',review};
        });
    }
    get architectureDomainBoundaryContracts() {
        const cross=this.architectureCrossDomainRelationships||[];
        const grouped=new Map();
        cross.forEach(r=>{
            const key=[r.childDomain,r.parentDomain].sort().join('|');
            if(!grouped.has(key))grouped.set(key,{key:'contract-'+key,domainA:[r.childDomain,r.parentDomain].sort()[0],domainB:[r.childDomain,r.parentDomain].sort()[1],relationships:[],lookup:0,master:0,poly:0});
            const g=grouped.get(key);g.relationships.push(r);
            if(r.kind==='Master Detail')g.master++;else if(r.kind==='Polymorphic')g.poly++;else g.lookup++;
        });
        return [...grouped.values()].map(g=>({...g,count:g.relationships.length,objects:[...new Set(g.relationships.flatMap(r=>[r.childEntity,r.parentEntity]))].join(', '),semantics:[g.lookup?g.lookup+' Lookup':'',g.master?g.master+' Master Detail':'',g.poly?g.poly+' Polymorphic':''].filter(Boolean).join(' · '),review:g.master?'Master Detail crosses this business boundary. Confirm lifecycle ownership across domains is intentional.':g.poly?'A polymorphic relationship crosses this boundary. Confirm the supported targets and ownership contract are explicit.':'Lookup references cross this boundary. Treat these as explicit dependency contracts between the two capabilities.'}));
    }
    get architectureHasDomainBoundaryContracts(){return this.architectureDomainBoundaryContracts.length>0;}
    get architectureDomainCoverage() {
        const total=(this.architectureNodes||[]).length, unassigned=(this.architectureDomainAnalysis.unassigned||[]).length, assigned=total-unassigned;
        return {total,assigned,unassigned,pct:total?Math.round(assigned*100/total):0};
    }
    get architectureDomainCoverageText(){const c=this.architectureDomainCoverage;return c.assigned+' of '+c.total+' objects assigned ('+c.pct+'%).';}
    get architectureDomainArchitectureSummary(){
        const domains=this.architectureDomains||[], contracts=this.architectureDomainBoundaryContracts||[], coverage=this.architectureDomainCoverage;
        if(!domains.length)return 'No architecture domains are defined yet.';
        if(domains.length===1)return 'The current grouping contains one domain only. This is useful as a membership label, but it cannot reveal business boundary quality until at least two meaningful capabilities are defined.';
        return domains.length+' business domains cover '+coverage.assigned+' modelled objects. '+contracts.length+' domain-to-domain boundary contract'+(contracts.length===1?' is':'s are')+' visible in the current ER structure.';
    }
    get architectureHasDomains() { return this.architectureDomains.length>0; }
    get architectureHasDomainCouplings() { return this.architectureDomainCouplings.length>0; }
    get architectureUnassignedText() { const u=this.architectureDomainAnalysis.unassigned; return u.length ? u.length+' unassigned: '+u.join(', ') : 'All objects in the current model have a domain assignment.'; }
    async loadArchitectureOrgReferences(force=false) {
        const names=(this.architectureNodes||[]).map(n=>n.name).filter(Boolean).sort();
        if(!names.length){this.architectureOrgReferences=[];this._architectureOrgReferenceKey='';return;}
        const key=names.map(n=>n.toLowerCase()).join('|');
        if(!force && this._architectureOrgReferenceKey===key && this.architectureOrgReferences.length)return;
        this.architectureOrgReferencesLoading=true;
        this.architectureOrgReferencesError='';
        try {
            const rows=await getSchemaReferences({diagramObjectApiNames:names});
            // Ignore a stale response if the user changed diagrams while the describe scan was running.
            const currentKey=(this.architectureNodes||[]).map(n=>n.name).filter(Boolean).sort().map(n=>n.toLowerCase()).join('|');
            if(currentKey!==key)return;
            this.architectureOrgReferences=Array.isArray(rows)?rows:[];
            this._architectureOrgReferenceKey=key;
        } catch(e) {
            this.architectureOrgReferences=[];
            this.architectureOrgReferencesError='Org schema references could not be loaded. Diagram-only analysis remains available.';
        } finally {
            this.architectureOrgReferencesLoading=false;
        }
    }
    refreshArchitectureAnalysis(force=false) {
        const source=this.sourceText || '';
        this.architectureError='';
        if(!source.trim()){ this._architectureSource=''; this._architectureAnalysis=null; return; }
        if(!force && this._architectureSource===source && this._architectureAnalysis) return;
        try {
            const parsed=parseEr(source);
            this._architectureAnalysis=analyseArchitecture(parsed);
            this._architectureSource=source;
        } catch (e) {
            this._architectureAnalysis=null;
            this._architectureSource=source;
            const message=e && e.message ? e.message : 'Unknown analysis error.';
            this.architectureError='Architecture Intelligence could not analyse this diagram. '+message;
        }
    }
    handleRetryArchitecture() { this._architectureSource=''; this.refreshArchitectureAnalysis(true); }
    get architectureHasError() { return !!this.architectureError; }
    get architectureShowEmpty() { return !this.architectureHasModel && !this.architectureHasError; }
    get architectureAnalysis() {
        return this._architectureAnalysis || null;
    }
    get architectureHasModel() { return !!this.architectureAnalysis; }
    get architectureSummary() {
        const a=this.architectureAnalysis; if(!a) return [];
        return [
            {label:'Objects',value:a.entityCount},{label:'Fields',value:a.fieldCount},{label:'Relationships',value:a.relationshipCount},
            {label:'Lookup',value:a.lookupCount},{label:'Master-Detail',value:a.masterDetailCount},{label:'Polymorphic',value:a.polymorphicCount},
            {label:'Custom Objects',value:a.customObjectCount},{label:'Components',value:a.componentCount},{label:'Max Depth',value:a.maxRelationshipDepth}
        ];
    }
    architectureFontScale = 1;
    get architecturePanelStyle(){ return '--arch-font-scale:'+this.architectureFontScale; }
    get architectureFontPercent(){ return Math.round(this.architectureFontScale*100)+'%'; }
    get architectureCanIncreaseFont(){ return this.architectureFontScale < 1.6; }
    get architectureCanDecreaseFont(){ return this.architectureFontScale > 0.8; }
    get architectureCannotIncreaseFont(){ return !this.architectureCanIncreaseFont; }
    get architectureCannotDecreaseFont(){ return !this.architectureCanDecreaseFont; }
    handleArchitectureFontIncrease(){ this.architectureFontScale=Math.min(1.6,Math.round((this.architectureFontScale+0.1)*10)/10); }
    handleArchitectureFontDecrease(){ this.architectureFontScale=Math.max(0.8,Math.round((this.architectureFontScale-0.1)*10)/10); }
    handleArchitectureFontReset(){ this.architectureFontScale=1; }
    get architectureNodes() { return this.architectureAnalysis?.nodes || []; }
    get architectureInsightMap() {
        const a=this.architectureAnalysis; if(!a) return {nodes:[],edges:[],canvasStyle:''};
        const source=a.nodes||[], count=source.length, cols=Math.max(3,Math.ceil(Math.sqrt(Math.max(1,count)*1.6))), rows=Math.ceil(count/cols);
        const cellW=270, cellH=190, padX=150, padY=110, width=Math.max(1200,padX*2+(cols-1)*cellW), height=Math.max(760,padY*2+(rows-1)*cellH);
        const gravity=new Set(this.architectureGravity.map(x=>x.name)), bridges=new Set(this.architectureBridges.map(x=>x.name));
        const ordered=[...source].sort((x,y)=>y.degree-x.degree||x.name.localeCompare(y.name));
        const nodes=ordered.map((n,i)=>{const col=i%cols,row=Math.floor(i/cols),x=padX+col*cellW,y=padY+row*cellH;
            return {...n,x,y,style:'left:'+x+'px;top:'+y+'px',role:gravity.has(n.name)?'Gravity centre':bridges.has(n.name)?'Bridge object':n.degree===0?'Isolated object':'Model object',className:'arch-map-node '+(gravity.has(n.name)?'arch-map-gravity':bridges.has(n.name)?'arch-map-bridge':n.degree===0?'arch-map-island':'')};
        });
        const pos=new Map(nodes.map(n=>[n.name.toLowerCase(),n])), pairSeen=new Set(), edges=[];
        (a.relationships||[]).forEach((rel,i)=>{
            const childKey=(rel.childEntity||'').toLowerCase(),parentKey=(rel.parentEntity||'').toLowerCase();
            if(!childKey||!parentKey||childKey===parentKey)return;
            const pair=[childKey,parentKey].sort().join('|');if(pairSeen.has(pair))return;pairSeen.add(pair);
            const s=pos.get(childKey),t=pos.get(parentKey);if(!s||!t)return;
            const dx=t.x-s.x,dy=t.y-s.y,len=Math.sqrt(dx*dx+dy*dy),angle=Math.atan2(dy,dx)*180/Math.PI;
            const raw=(rel.kind||'Lookup').toLowerCase(),kind=raw.includes('master')?'Master Detail':raw.includes('poly')?'Polymorphic':'Lookup';
            const kindClass=kind==='Master Detail'?'arch-map-edge-master':kind==='Polymorphic'?'arch-map-edge-poly':'arch-map-edge-lookup';
            edges.push({key:i+'-'+s.name+'-'+t.name,child:s.name,parent:t.name,style:'left:'+s.x+'px;top:'+s.y+'px;width:'+len+'px;transform:rotate('+angle+'deg)',kind,kindClass:'arch-map-edge '+kindClass,title:s.name+' → '+t.name+' · '+kind});
        });
        return {nodes,edges,canvasStyle:'width:'+width+'px;height:'+height+'px'};
    }
    get architectureInsightMapNodes(){ return this.architectureInsightMap.nodes; }
    get architectureInsightMapEdges(){ return this.architectureInsightMap.edges; }
    get architectureInsightMapCanvasStyle(){ return this.architectureInsightMap.canvasStyle; }
    get architectureTopologySummary() {
        const a=this.architectureAnalysis; if(!a) return [];
        return [
            {label:'Avg. relationships / object',value:a.averageDegree},
            {label:'Unique-pair density',value:a.relationshipDensity},
            {label:'Avg. fields / object',value:a.averageFieldsPerObject},
            {label:'Disconnected components',value:a.componentCount},
            {label:'Maximum relationship reach',value:a.maxRelationshipDepth+' hops'},
            {label:'Detected cycles',value:a.cycles.length}
        ];
    }
    get architectureExecutiveSummary() {
        const a=this.architectureAnalysis; if(!a) return '';
        const lead=a.mostConnected?.[0];
        const connectivity=a.componentCount===1 ? 'The model is fully connected' : 'The model is split across '+a.componentCount+' disconnected components';
        const depth=a.maxRelationshipDepth<=2 ? 'shallow' : a.maxRelationshipDepth<=4 ? 'moderate' : 'deep';
        const cycleText=a.cycles.length ? a.cycles.length+' structural cycle'+(a.cycles.length===1?' was':'s were')+' detected' : 'No structural cycles were detected';
        const leadText=lead&&lead.degree ? lead.name+' is the most connected object with '+lead.degree+' relationship'+(lead.degree===1?'':'s')+'. ' : '';
        return 'This diagram contains '+a.entityCount+' objects, '+a.fieldCount+' fields and '+a.relationshipCount+' relationships. '+leadText+connectivity+', with '+depth+' relationship reach of '+a.maxRelationshipDepth+' hop'+(a.maxRelationshipDepth===1?'':'s')+'. '+cycleText+'.';
    }
    get architectureReviewLead() {
        const a=this.architectureAnalysis, lead=a?.mostConnected?.[0]; if(!a||!lead) return null;
        const reach=analyseBlastRadius(a,lead.name,3);
        return {
            name:lead.name,
            role:(a.hubs||[]).some(h=>h.name===lead.name)?'Structural hub':'Most connected object',
            evidence:lead.degree+' relationships · '+lead.fieldCount+' fields · '+lead.incoming+' incoming · '+lead.outgoing+' outgoing',
            reason:lead.degree ? 'Changes around this object may have the widest structural reach in the current model. Review its direct relationships and dependants first.' : 'The current model has no relationships, so no structural hotspot is present.',
            reach:reach ? reach.total+' objects reachable within 3 hops' : ''
        };
    }
    get architectureFindings() {
        const a=this.architectureAnalysis; if(!a) return [];
        const findings=[], total=Math.max(1,a.relationshipCount||0);
        const add=(x)=>findings.push({...x,signalPct:Math.min(100,Math.max(8,x.signalPct||0)),signalStyle:'width:'+Math.min(100,Math.max(8,x.signalPct||0))+'%'});
        const lead=a.mostConnected?.[0];
        if(lead&&lead.degree) add({key:'connectivity',kind:'CHANGE IMPACT',title:'Start change analysis around '+lead.name,plain:'This object is connected to more of this ER model than any other object.',evidence:lead.degree+' relationships touch '+lead.name+' ('+lead.incoming+' point into it and '+lead.outgoing+' point out).',salesforce:'In Salesforce terms, work involving '+lead.name+' is more likely to intersect lookup or Master Detail fields, automation assumptions, integrations, reporting joins and test scenarios that also involve neighbouring objects.',opportunity:'Treat '+lead.name+' as an anchor for design reviews and regression planning. Its relationships give you a practical starting point for understanding the surrounding data model.',challenge:'A change that looks local can have a wider review surface because several objects depend on, or are depended on by, '+lead.name+'. This is a prompt to inspect dependencies, not a claim that the design is bad.',action:'Open '+lead.name+', inspect incoming and outgoing relationships, then run Blast Radius before changing relationship fields or object responsibilities.',objectName:lead.name,hasObject:true,signalPct:Math.round((lead.degree/total)*100)});
        if(a.largestObjects?.length){const x=a.largestObjects[0];if(x.fieldCount>=25)add({key:'size',kind:'OBJECT COMPLEXITY',title:x.name+' carries a broad field definition',plain:'The ER model contains many fields on this object, so understanding its responsibility may take more effort.',evidence:x.fieldCount+' fields are represented for '+x.name+' in the current diagram.',salesforce:'For a Salesforce architect this is where you ask whether the object has accumulated several business concerns, integration attributes, status fields or legacy fields. Field count alone does not prove over design.',opportunity:'A broad object can be a useful consolidated business record when the fields genuinely belong to one lifecycle and ownership model.',challenge:'Large field breadth can make discovery, security review, integration contracts, reporting and future change harder when unrelated concerns accumulate on one object.',action:'Use Object Intelligence to group the fields by purpose and relationships. Confirm the object still represents a coherent business responsibility.',objectName:x.name,hasObject:true,signalPct:Math.min(100,Math.round(x.fieldCount/1.2))});}
        if(a.componentCount>1)add({key:'components',kind:'MODEL COVERAGE',title:'The model contains '+a.componentCount+' disconnected areas',plain:'Some objects cannot be reached from others through the relationships currently modelled.',evidence:a.componentCount+' separate relationship groups exist in this ER diagram.',salesforce:'This may simply mean the diagram contains several unrelated Salesforce capabilities, or it may mean an expected lookup or junction relationship is missing from the model.',opportunity:'Disconnected areas can represent clean business boundaries that can be reviewed and owned independently.',challenge:'If the separation is accidental, impact analysis based on this ER model will be incomplete.',action:'Review each disconnected group and decide whether it is intentionally independent or missing a relationship.',objectName:'',hasObject:false,signalPct:100});
        else add({key:'components',kind:'MODEL COVERAGE',title:'Every modelled object is structurally connected',plain:'Starting from any object, the relationship graph can eventually reach every other object in this diagram.',evidence:'All '+a.objectCount+' objects participate in one connected relationship area.',salesforce:'This does not mean every object directly depends on every other object. It means there is at least one chain of Salesforce relationships connecting the complete model.',opportunity:'Path Finder can now explain how two apparently distant Salesforce objects are connected.',challenge:'A fully connected model can span several business capabilities. Domain mapping helps determine whether those cross capability connections are intentional.',action:'Use Domains to group objects by business capability, then review the relationships that cross those boundaries.',objectName:'',hasObject:false,signalPct:100});
        if(a.cycles.length)add({key:'cycles',kind:'DEPENDENCY LOOP',title:'A relationship path loops back to where it started',plain:'Following relationships through the model can return to an object already visited.',evidence:a.cycles.length+' bounded relationship cycle'+(a.cycles.length===1?' is':'s are')+' visible in the current graph.',salesforce:'A Salesforce relationship cycle is not automatically an error. Parent lookups, self relationships and business models can legitimately create loops. The value is knowing the loop exists before reasoning about ownership or change flow as if it were a simple tree.',opportunity:'Explicitly documenting the cycle prevents designers and developers from making incorrect one direction assumptions.',challenge:'Loops can make impact analysis, data loading order, integration mapping and automation reasoning less intuitive.',action:'Inspect each cycle path and document why the loop exists and which relationship represents each business meaning.',objectName:'',hasObject:false,signalPct:Math.min(100,a.cycles.length*30)});
        if(a.parallelRelationshipCount>0)add({key:'parallel',kind:'MULTIPLE LINKS',title:'Some object pairs are connected in more than one way',plain:'The same two objects have multiple relationship fields between them.',evidence:a.parallelRelationshipCount+' additional relationship'+(a.parallelRelationshipCount===1?' exists':'s exist')+' between object pairs that are already connected.',salesforce:'Think of two Salesforce objects linked by different lookup fields for different roles, such as owner, parent, billing contact or another business meaning. The issue is not the count itself; it is whether developers and designers can tell those meanings apart.',opportunity:'Multiple explicit relationships can model distinct business roles cleanly when fields are well named and documented.',challenge:'Ambiguous or overlapping relationship meanings can cause incorrect joins, automation assumptions, reporting confusion and integration mapping mistakes.',action:'Inspect the repeated object pairs and confirm every relationship field has a distinct, documented purpose.',objectName:'',hasObject:false,signalPct:Math.min(100,Math.round((a.parallelRelationshipCount/total)*100))});
        return findings.slice(0,8);
    }
    get architectureDeepIntelligence(){ return deriveArchitectureIntelligence(this.architectureAnalysis,this.architectureDomains); }
    get architectureGravity(){ return this.architectureDeepIntelligence.gravity||[]; }
    get architectureBridges(){ return this.architectureDeepIntelligence.bridges||[]; }
    get architectureCorridors(){ return this.architectureDeepIntelligence.corridors||[]; }
    get architectureAsymmetry(){ return this.architectureDeepIntelligence.asymmetry||[]; }
    get architectureComplexityClusters(){ return this.architectureDeepIntelligence.clusters||[]; }
    get architectureBoundaryLeakage(){ return this.architectureDeepIntelligence.boundaryLeakage||[]; }
    get architectureHasGravity(){ return this.architectureGravity.length>0; }
    get architectureHasBridges(){ return this.architectureBridges.length>0; }
    get architectureHasCorridors(){ return this.architectureCorridors.length>0; }
    get architectureHasAsymmetry(){ return this.architectureAsymmetry.length>0; }
    get architectureHasComplexityClusters(){ return this.architectureComplexityClusters.length>0; }
    get architectureHasBoundaryLeakage(){ return this.architectureBoundaryLeakage.length>0; }
    get architectureDashboardObjects(){
        const nodes=this.architectureNodes||[], maxDegree=Math.max(1,...nodes.map(n=>n.degree||0)), maxFields=Math.max(1,...nodes.map(n=>n.fieldCount||0));
        return [...nodes].sort((a,b)=>(b.degree||0)-(a.degree||0)||(b.fieldCount||0)-(a.fieldCount||0)).map(n=>{
            const relationshipPct=Math.round(((n.degree||0)/maxDegree)*100), fieldPct=Math.round(((n.fieldCount||0)/maxFields)*100);
            return {...n,relationshipPct,fieldPct,relationshipStyle:'width:'+relationshipPct+'%',fieldStyle:'width:'+fieldPct+'%'};
        });
    }
    get architectureRelationshipMix(){
        const a=this.architectureAnalysis;if(!a)return [];
        const total=Math.max(1,a.relationshipCount||0);
        return [
            {key:'lookup',label:'Lookup',value:a.lookupCount||0,pct:Math.round(((a.lookupCount||0)/total)*100)},
            {key:'master',label:'Master Detail',value:a.masterDetailCount||0,pct:Math.round(((a.masterDetailCount||0)/total)*100)},
            {key:'poly',label:'Polymorphic',value:a.polymorphicCount||0,pct:Math.round(((a.polymorphicCount||0)/total)*100)}
        ].map(x=>({...x,style:'width:'+x.pct+'%'}));
    }
    get architectureOverviewExplanations(){
        const a=this.architectureAnalysis;if(!a)return [];
        const lead=a.mostConnected?.[0];
        return [
            {key:'connectivity',title:'Connectivity',value:this.architectureConnectivityLabel,meaning:a.componentCount===1?'Every object belongs to one connected structural model. A relationship route exists between any two objects, although it may pass through intermediate objects.':'The model contains '+a.componentCount+' disconnected structural groups. Changes in one group have no relationship path to objects in another group in this ER model.',review:'Use this to understand whether the file represents one cohesive capability or several independent areas.'},
            {key:'reach',title:'Maximum relationship reach',value:a.maxRelationshipDepth+' hops',meaning:'The longest shortest route detected between connected objects is '+a.maxRelationshipDepth+' relationship hops. This describes structural distance, not processing time or runtime dependency.',review:'A larger reach means some impacts are indirect. Use Change Impact & Paths before changing objects near the centre of the model.'},
            {key:'centre',title:'Structural concentration',value:lead?lead.name+' · '+lead.degree+' relationships':'No dominant object',meaning:lead?lead.name+' has the highest direct relationship count in this model. That makes it a useful starting point for impact review, but does not by itself mean the design is problematic.':'No object has emerged as a structural centre.',review:'Review highly connected objects when planning schema changes because more relationship contracts meet there.'},
            {key:'cycles',title:'Relationship cycles',value:this.architectureCycleLabel,meaning:(a.cycles||[]).length?'At least one route can return to an earlier object through relationships. Cycles can be legitimate, but dependency reasoning is less linear.':'No structural relationship cycle was detected in the current model.',review:'Where cycles exist, confirm lifecycle, automation and integration assumptions rather than treating the cycle itself as an error.'},
            {key:'isolated',title:'Isolated objects',value:this.architectureIslandLabel,meaning:(a.isolatedObjects||[]).length?'These objects have no relationship edge to another object represented in this file.':'Every object shown participates in at least one relationship in this model.',review:'An isolated object may be intentional, omitted context, or a modelling gap. The ER structure alone cannot decide which.'},
            {key:'mix',title:'Relationship semantics',value:this.architectureRelationshipSemantics,meaning:'Lookup represents reference dependency, Master Detail represents tighter parent lifecycle semantics, and polymorphic relationships can resolve to more than one supported target type.',review:'Use the mix to identify where ownership semantics or broader polymorphic dependencies deserve closer review.'}
        ];
    }
    get architectureDesignerBrief(){
        const a=this.architectureAnalysis;if(!a)return [];
        const deep=this.architectureDeepIntelligence||{}, out=[];
        const lead=a.mostConnected?.[0];
        if(lead)out.push({key:'focus',label:'START HERE',title:lead.name+' carries the most structural attention',detail:lead.degree+' relationships touch this object. Use its drill down before approving changes around this area.'});
        if(deep.bridges?.length)out.push({key:'bridge',label:'CROSS AREA DEPENDENCY',title:deep.bridges[0].name+' joins otherwise separated areas',detail:'This object is structurally important beyond its direct relationship count. Review both sides of the bridge together.'});
        if((a.cycles||[]).length)out.push({key:'cycle',label:'REVIEW COMPLEXITY',title:a.cycles.length+' relationship cycle'+(a.cycles.length===1?'':'s')+' detected',detail:'Cycles are not automatically wrong, but they make dependency reasoning less linear. Confirm each cycle is intentional.'});
        if((a.parallelRelationshipCount||0)>0)out.push({key:'parallel',label:'SEMANTIC COUPLING',title:a.parallelRelationshipCount+' repeated object pair relationship'+(a.parallelRelationshipCount===1?'':'s'),detail:'The same object pairs carry multiple relationship meanings. Check that each field has a distinct business purpose.'});
        if(!out.length)out.push({key:'clear',label:'MODEL SHAPE',title:'No dominant structural review signal detected',detail:'Use object drill down and domain mapping to explore the model in business context.'});
        return out;
    }
    get architectureInsightGuide(){
        const deep=this.architectureDeepIntelligence||{};
        const list=(items, formatter, empty)=>items?.length ? items.slice(0,6).map(formatter).join(' · ') : empty;
        return [
            {key:'gravity',title:'Structural Gravity',finding:list(deep.gravity,x=>x.name+' ('+x.degree+' rel., '+x.fieldCount+' fields, '+x.reachPct+'% reach)','No structural gravity objects detected in the current model.'),what:'Shows objects where relationship count, field breadth and structural reach converge.',value:'Use it to identify where a seemingly local change may require the broadest architectural review.',opportunity:'A deliberate gravity centre can provide a clear business anchor and simplify discovery of related data.',challenge:'If responsibilities accumulated accidentally, the object can become a coupling and change concentration point.',action:'Review ownership, field breadth, incoming and outgoing dependencies, then use Change Impact before significant change.'},
            {key:'bridge',title:'Bridge Objects',finding:list(deep.bridges,x=>x.name+' ('+x.separatedNeighborCount+' separated branches)','No bridge objects detected in the current model.'),what:'Shows objects that connect structural areas which become less connected when that object is excluded.',value:'Highlights integration and change boundaries that raw relationship counts can miss.',opportunity:'A deliberate bridge can make cross-area responsibility explicit and provide a natural contract boundary.',challenge:'Unexpected bridges can create hidden cross-area dependency and increase coordination required for change.',action:'Open Object Map for the bridge and inspect both sides of the dependency.'},
            {key:'corridor',title:'Change Corridors',finding:list(deep.corridors,x=>x.path+' ('+x.hops+' hops)','No long change corridors detected in the current model.'),what:'Shows longer relationship paths between connected parts of the model.',value:'Makes indirect dependency routes visible when impact is not obvious from immediate neighbours.',opportunity:'Useful for planning regression scope, integration review and ownership discussions across several objects.',challenge:'Long corridors can make change reasoning less local and can expose chains of semantic dependency.',action:'Walk the reported path object by object and document where business responsibility changes.'},
            {key:'asymmetry',title:'Relationship Asymmetry',finding:list(deep.asymmetry,x=>x.name+' ('+x.direction+' '+x.ratio+')','No strong relationship asymmetry detected in the current model.'),what:'Compares incoming and outgoing relationship concentration for an object.',value:'Reveals whether an object is predominantly referenced by others or predominantly depends on others.',opportunity:'A clear directional pattern can help identify stable reference or aggregation roles.',challenge:'Extreme concentration may indicate dependency pressure around one object and deserves contextual review.',action:'Review the dominant direction and confirm it matches the intended ownership and lifecycle model.'},
            {key:'cluster',title:'Complexity Clusters',finding:list(deep.clusters,x=>x.objects.join(', ')+' ('+x.objectCount+' objects)','No highly connected complexity clusters detected in the current model.'),what:'Finds groups of highly connected objects located together in the relationship graph.',value:'Shows where complexity is collective rather than attributable to one object alone.',opportunity:'A coherent cluster may represent a natural business capability or bounded area.',challenge:'Dense clusters can increase coordinated change and testing effort when responsibilities are poorly separated.',action:'Review the cluster as a unit and decide whether its cohesion reflects a deliberate business capability.'},
            {key:'domain',title:'Architecture Domains',finding:list(deep.boundaryLeakage,x=>x.name+' ('+x.crossDomainRelationships+' cross-domain, '+x.crossPct+'%)','No cross-domain coupling is currently detected. Assign domains first if none have been defined.'),what:'Lets the architect assign business boundaries such as Customer, Claim, Provider or Payment to modelled objects.',value:'Once assigned, the tool can distinguish relationships inside a domain from relationships crossing domain boundaries.',opportunity:'Domains turn a technical object graph into a business architecture view and make intentional interfaces visible.',challenge:'High cross-domain coupling can signal unclear boundaries or legitimate dependencies that require explicit ownership.',action:'Name domains using business capabilities, assign each object, then review every cross-domain relationship for purpose and ownership.'}
        ];
    }
    get architectureAdvice() {
        const a=this.architectureAnalysis; if(!a) return [];
        const advice=[], lead=a.mostConnected?.[0], largest=a.largestObjects?.[0], deep=this.architectureDeepIntelligence;
        if(deep.gravity?.length){const g=deep.gravity[0];advice.push({key:'gravity',kind:'INSIGHT',title:g.name+' acts as a structural gravity centre',evidence:g.degree+' relationships, '+g.fieldCount+' fields and '+g.reachPct+'% of other modelled objects structurally reachable.',reason:'Multiple independent signals converge on the same object rather than it ranking highly on only one measure.',next:'Confirm whether this concentration reflects an intentional central business responsibility or accumulated responsibilities.'});}
        if(deep.bridges?.length){const b=deep.bridges[0];advice.push({key:'bridge',kind:'INSIGHT',title:b.name+' is a structural bridge',evidence:b.detail,reason:'Bridge objects connect areas that otherwise do not remain mutually reachable when that node is excluded from traversal.',next:'Treat structural changes around this object as a cross-area review point and inspect both sides of the bridge.'});}
        if(deep.boundaryLeakage?.length){const d=deep.boundaryLeakage[0];advice.push({key:'boundary',kind:'DOMAIN',title:d.name+' has visible cross-domain coupling',evidence:d.crossDomainRelationships+' cross-domain relationships, '+d.crossPct+'% of relationships touching the domain boundary.',reason:'Architect-defined boundaries are most useful when their coupling is explicit and intentional.',next:'Review the cross-domain relationships and confirm each represents an intentional business dependency.'});}
        if(lead&&lead.degree) advice.push({key:'hub',kind:'REVIEW',title:'Review '+lead.name+' as a change concentration point',evidence:lead.degree+' relationships, '+lead.incoming+' incoming and '+lead.outgoing+' outgoing.',reason:'It has the widest direct structural connectivity in the current model.',next:'Start impact discussions here when a change touches this area, then inspect its blast radius.'});
        if(a.cycles?.length) advice.push({key:'cycles',kind:'VALIDATE',title:'Validate the detected relationship cycles',evidence:a.cycles.length+' bounded structural cycle'+(a.cycles.length===1?' is':'s are')+' present.',reason:'Cycles may be intentional, but they make dependency reasoning less linear.',next:'Review each reported cycle path and confirm that the relationships represent intentional business structure.'});
        else advice.push({key:'cycles-clear',kind:'GOOD SIGNAL',title:'No structural cycles detected',evidence:'The bounded cycle analysis found no relationship cycles.',reason:'Relationship paths are easier to reason about when circular structures are absent.',next:'No cycle-specific investigation is suggested for the current model.'});
        if(a.componentCount>1) advice.push({key:'components',kind:'VALIDATE',title:'Confirm disconnected model areas are intentional',evidence:a.componentCount+' connected components were detected.',reason:'Disconnected areas can represent valid boundaries or an incomplete diagram.',next:'Check whether each component is intentionally independent or whether relationships are missing from the model.'});
        else advice.push({key:'connected',kind:'GOOD SIGNAL',title:'The current model forms one connected structure',evidence:'All '+a.entityCount+' modelled objects belong to one connected component.',reason:'No structural islands are hidden behind disconnected components.',next:'Use Path Finder when you need evidence for how two specific objects connect.'});
        if(a.parallelRelationshipCount>0) advice.push({key:'parallel',kind:'CONSIDER',title:'Review repeated relationships between object pairs',evidence:a.parallelRelationshipCount+' additional relationship'+(a.parallelRelationshipCount===1?' exists':'s exist')+' between already connected object pairs.',reason:'Repeated links can be valid but may encode different business meanings that deserve explicit documentation.',next:'Confirm each repeated relationship has a distinct and understandable purpose.'});
        if(largest&&largest.fieldCount>=25) advice.push({key:'breadth',kind:'CONSIDER',title:'Review the breadth of '+largest.name,evidence:largest.fieldCount+' fields are represented on this object in the current diagram.',reason:'Field breadth is not a defect, but large definitions can accumulate multiple responsibilities over time.',next:'Check whether the field groups still represent a cohesive object responsibility.'});
        return advice.slice(0,6);
    }
    async handlePrintArchitectureReport() {
        try {
            const a=this.architectureAnalysis, map=this.architectureInsightMap, deep=this.architectureDeepIntelligence;
            if(!a) return;
            const report={
                fileName:this.fileName||'Current ER model',summary:this.architectureExecutiveSummary,signals:this.architectureSummary,
                reviewLead:this.architectureReviewLead,findings:this.architectureFindings,advice:this.architectureAdvice,metrics:this.architectureTopologySummary,
                domains:this.architectureDomains,relationships:a.relationships||[],
                map:{nodes:map.nodes,edges:map.edges,width:parseInt((map.canvasStyle.match(/width:(\\d+)/)||[])[1]||1100,10),height:parseInt((map.canvasStyle.match(/height:(\\d+)/)||[])[1]||700,10)},
                gravity:(deep.gravity||[]).map(x=>({...x,pdfText:x.name+': '+x.degree+' relationships, '+x.fieldCount+' fields, '+x.reachPct+'% structural reach.'})),
                bridges:(deep.bridges||[]).map(x=>({...x,pdfText:x.name+': '+x.detail})),
                corridors:(deep.corridors||[]).map(x=>({...x,pdfText:x.hops+' hops: '+x.path})),
                asymmetry:(deep.asymmetry||[]).map(x=>({...x,pdfText:x.name+': '+x.direction+' concentration, '+x.ratio+'.'})),
                clusters:(deep.clusters||[]).map(x=>({...x,pdfText:x.objectCount+' objects: '+x.detail})),
                boundaryLeakage:(deep.boundaryLeakage||[]).map(x=>({...x,pdfText:x.name+': '+x.crossDomainRelationships+' cross domain relationships, '+x.crossPct+'% boundary share.'}))
            };
            const base64=await exportArchitectureReportAsPdf(report), anchor=document.createElement('a');
            anchor.href='data:application/pdf;base64,'+base64;
            anchor.download=(this.fileName||'architecture').replace(/[^a-z0-9._-]+/gi,'-')+'-architecture-intelligence.pdf';
            anchor.style.display='none';document.body.appendChild(anchor);anchor.click();document.body.removeChild(anchor);
        } catch(e) { this.architectureError='PDF export failed. '+(e?.message||'Unable to generate the architecture report.'); }
    }
    get architectureConnectivityLabel() { const a=this.architectureAnalysis; return !a?'':a.componentCount===1?'Fully connected':a.componentCount+' components'; }
    get architectureCycleLabel() { const a=this.architectureAnalysis; return !a?'':a.cycles.length ? a.cycles.length+' detected' : 'None detected'; }
    get architectureIslandLabel() { const a=this.architectureAnalysis; return !a?'':a.islands.length ? a.islands.length+' isolated' : 'None'; }
    get architectureJunctionLabel() { const j=this.architectureJunctions; const strong=j.filter(x=>x.confidence==='Strong').length; return strong ? strong+' strong candidate'+(strong===1?'':'s') : 'No strong candidates'; }
    get architectureRelationshipSemantics() {
        const a=this.architectureAnalysis; if(!a) return '';
        return a.lookupCount+' lookup · '+a.masterDetailCount+' Master-Detail · '+a.polymorphicCount+' polymorphic';
    }
    get architectureDensityHelp() { return 'Unique object-pair density. Parallel relationships are counted separately as relationship semantics, so density remains between 0 and 1.'; }
    get architectureObservations() { return this.architectureAnalysis?.observations || []; }
    get architectureMostConnected() { return this.architectureAnalysis?.mostConnected || []; }
    get architectureLargestObjects() { return this.architectureAnalysis?.largestObjects || []; }
    get architectureHubsText() { const a=this.architectureAnalysis; return a?.hubs?.length ? a.hubs.map(x=>x.name+' ('+x.degree+')').join(', ') : 'No structural hubs detected in this diagram.'; }
    get architectureIslandsText() { const a=this.architectureAnalysis; return a?.islands?.length ? a.islands.map(x=>x.name).join(', ') : 'No isolated objects.'; }
    get architectureCyclesText() { const a=this.architectureAnalysis; return a?.cycles?.length ? a.cycles.map(c=>c.join(' → ')).join(' | ') : 'No relationship cycles detected.'; }

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
        const myToken = ++this._fileLoadToken;
        try {
            const rec = await getFile({ fileId: id });
            if (myToken !== this._fileLoadToken || this._isDisconnected) return;
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
            if (myToken === this._fileLoadToken && !this._isDisconnected) this.errorMessage = this.reduceError(e);
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
        // A relationship field with no friendlyType at all only happens
        // when it's being shown as a PLAIN field rather than a relationship
        // line — see the "orphaned relationship field" comment below.
        // Falls back to its relationship kind (Lookup/Master-Detail/
        // Polymorphic Lookup) so it still carries a meaningful label
        // rather than showing as a bare, unannotated name.
        else if (f.isRelationship && f.relationshipType) markers.push(f.relationshipType);
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
                // A REAL BUG this fixes, not a design choice: a relationship
                // field whose target object isn't (yet) on the canvas used
                // to be dropped from the DSL entirely — excluded from the
                // plain field list because it IS a relationship, and
                // excluded from the relationship-line section below because
                // its target isn't present to draw a line to. The field
                // itself never appeared anywhere, silently, even though it
                // genuinely exists on the object — reported directly
                // against dropping a single object (e.g. Contact) without
                // its related object (e.g. Account) also on the canvas.
                // Fixed by showing it as a plain field, with its
                // relationship kind as the type label (via
                // buildFieldMarkerSuffix's fallback above), instead of
                // omitting it. Known, accepted follow-on limitation, not
                // silently different from how the rest of this function
                // already behaves: if the missing target object gets added
                // to the canvas later, this field is NOT automatically
                // promoted into a real relationship line — the same
                // "never rewrite an existing entity's already-typed field
                // list" rule addEntityByDrop already follows elsewhere
                // applies here too. The user can convert it by hand.
                .filter((f) => !f.isRelationship || !presentNames.has(f.relatesTo))
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
            // Export the complete logical ER canvas, never the scroll viewport.
            // LWC may visually scale/scroll the live SVG, but export always uses its full geometry.
            // Reserve a dedicated footer band for the export legend so it can
            // never cover an entity card or relationship in the PNG.
            const legendBandHeight = 126;
            const exportWidth = this.svgWidth;
            const exportHeight = this.svgHeight + legendBandHeight;
            exportSvg.setAttribute('width', String(exportWidth));
            exportSvg.setAttribute('height', String(exportHeight));
            exportSvg.setAttribute('viewBox', '0 0 '+exportWidth+' '+exportHeight);
            exportSvg.style.transform='none';
            exportSvg.style.width=exportWidth+'px';
            exportSvg.style.height=exportHeight+'px';
            exportSvg.appendChild(buildLegendGroup(exportWidth, exportHeight));

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

    get legendStyle() {
        return this.legendX === null || this.legendY === null ? '' : 'left:'+this.legendX+'px;top:'+this.legendY+'px;right:auto;bottom:auto;';
    }
    handleLegendPointerDown(event) {
        event.preventDefault(); event.stopPropagation();
        const legend=event.currentTarget.closest('.legend-overlay');
        const host=this.template.querySelector('.canvas-panel') || legend.parentElement;
        if(!legend||!host)return;
        const lr=legend.getBoundingClientRect(),hr=host.getBoundingClientRect();
        this.legendDragging=true;this.legendPointerId=event.pointerId;
        this.legendDragOffsetX=event.clientX-lr.left;this.legendDragOffsetY=event.clientY-lr.top;
        if(this.legendX===null){this.legendX=lr.left-hr.left;this.legendY=lr.top-hr.top;}
        try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
    }
    handleLegendPointerMove(event) {
        if(!this.legendDragging||event.pointerId!==this.legendPointerId)return;
        const legend=this.template.querySelector('.legend-overlay');
        const host=this.template.querySelector('.canvas-panel') || legend?.parentElement;
        if(!legend||!host)return;
        const hr=host.getBoundingClientRect(),lr=legend.getBoundingClientRect();
        this.legendX=Math.max(0,Math.min(hr.width-lr.width,event.clientX-hr.left-this.legendDragOffsetX));
        this.legendY=Math.max(0,Math.min(hr.height-lr.height,event.clientY-hr.top-this.legendDragOffsetY));
    }
    handleLegendPointerUp(event) {
        if(event.pointerId!==this.legendPointerId)return;
        this.legendDragging=false;this.legendPointerId=null;
        try{event.currentTarget.releasePointerCapture(event.pointerId);}catch(_){}
    }
    handleLegendReset(event) {
        event.stopPropagation();this.legendX=null;this.legendY=null;
    }

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

    // Real UX problem this fixes, not a hidden bug: a box with many fields
    // (e.g. Account with 70+) needs a genuinely huge drag distance to
    // manually resize tall enough to show everything -- 70 fields at
    // ROW_HEIGHT (22px) plus the header is 1,500+ pixels, well beyond what
    // a single mouse drag can comfortably cover on most screens, since the
    // drag is bounded by the user's actual, physical cursor position
    // (event.clientY), not the logical canvas size. Reported directly:
    // stretching and shrinking a box still left many fields hidden,
    // because the drag was hitting that real ceiling, not a code limit.
    // Removing the height override entirely restores the box to its
    // natural height, which buildErGeometry already computes to fit every
    // field with no cap at all -- this is the same state a fresh drop or
    // import starts in, just reachable again after a manual resize without
    // needing to out-drag the monitor. Bound to two places: a double-click
    // on the (invisible) resize handle, matching the Excel/Sheets
    // auto-fit-column convention, and a single click directly on the
    // "+N more" text itself, which is actually visible and far more
    // discoverable than a hidden handle.
    handleShowAllFields(event) {
        event.stopPropagation();
        const name = event.currentTarget.dataset.name;
        if (!name) return;
        delete this.boxHeightOverrides[name];
        this.rerenderGeometry();
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
        if (this.sharingViewOn && this.currentModelIsMimic) {
            this.sharingModels = {}; this.sharingSignals = {};
            this.errorMessage = 'Sharing View is not available for a Mimic New ER model because its custom objects do not exist in this Salesforce org.';
            return;
        }
        if (this.sharingViewOn) this.scheduleSharingFetch();
    }

    scheduleSharingFetch() {
        clearTimeout(this._sharingFetchTimer);
        this._sharingFetchTimer = setTimeout(() => this.fetchSharingModels(), 300);
    }

    async fetchSharingModels() {
        if (this.currentModelIsMimic || !this.sharingViewOn || !this._erBoxes || !this._erBoxes.length) return;
        const myToken = ++this._sharingRequestToken;
        const names = this._erBoxes.map((b) => b.name);
        const modelKey = names.map((n)=>n.toLowerCase()).sort().join('|');
        try {
            // OWD/sharing models are cheap metadata and are needed for every
            // box badge. Detailed Share-table signals are intentionally NOT
            // fetched here: doing one Apex round trip per canvas object made
            // Sharing View slow on larger diagrams. Those details are loaded
            // lazily only when the architect hovers an object.
            const fresh = await getSharingModels({ objectApiNames: names });
            const currentKey = (this._erBoxes || []).map((b)=>b.name.toLowerCase()).sort().join('|');
            if (myToken !== this._sharingRequestToken || !this.sharingViewOn || modelKey !== currentKey || this._isDisconnected) return;
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

    async fetchSharingSignalForObject(name) {
        const key = name.toLowerCase();
        if (!this.sharingViewOn || this.sharingSignals[key] || this._isDisconnected) return;
        this._sharingSignalPending = this._sharingSignalPending || {};
        if (this._sharingSignalPending[key]) return;
        this._sharingSignalPending[key] = true;
        try {
            const value = await getSharingSignal({ objectApiName: name });
            if (!value || !this.sharingViewOn || this._isDisconnected) return;
            this.sharingSignals = { ...this.sharingSignals, [key]: value };
            if (this.hoverCard && this.hoverCard.name === name) {
                this.hoverCard = {
                    ...this.hoverCard,
                    hasSharingSignalData: !!value.shareTableAvailable,
                    sharingRuleText: value.hasSharingRule ? 'Yes' : 'No',
                    apexSharingText: value.isCustomObject
                        ? (value.hasApexSharing ? 'Yes' : 'No')
                        : 'Not determinable on standard objects'
                };
            }
        } catch (e) {
            // The sharing model itself remains useful even when an object's
            // Share table is unavailable/inaccessible, so do not turn a
            // hover-only detail failure into a canvas-wide error.
        } finally {
            delete this._sharingSignalPending[key];
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
        if (this.heatmapOn && this.currentModelIsMimic) {
            this.recordCounts = {};
            this.errorMessage = 'Heatmap is not available for a Mimic New ER model because its custom objects do not exist in this Salesforce org and therefore have no record data.';
            return;
        }
        if (this.heatmapOn) this.scheduleHeatmapFetch();
    }

    scheduleHeatmapFetch() {
        clearTimeout(this._heatmapFetchTimer);
        this._heatmapFetchTimer = setTimeout(() => this.fetchRecordCounts(), 300);
    }

    async fetchRecordCounts() {
        if (this.currentModelIsMimic || !this.heatmapOn || !this._erBoxes || !this._erBoxes.length) return;
        const myToken = ++this._heatmapRequestToken;
        const names = this._erBoxes.map((b) => b.name);
        const modelKey = names.map((n)=>n.toLowerCase()).sort().join('|');
        try {
            // Keep record counts for objects already fetched during this
            // component session. Heatmap is an architectural signal, not a
            // live reporting dashboard, so repeatedly querying unchanged
            // canvas objects only adds latency and server load.
            const next = { ...(this.recordCounts || {}) };
            const pendingNames = names.filter((name) => next[name.toLowerCase()] == null);
            const concurrency = 4;
            let cursor = 0;

            const worker = async () => {
                while (cursor < pendingNames.length) {
                    const name = pendingNames[cursor++];
                    const value = await getRecordCount({ objectApiName: name });
                    const currentKey = (this._erBoxes || []).map((b)=>b.name.toLowerCase()).sort().join('|');
                    if (myToken !== this._heatmapRequestToken || !this.heatmapOn || modelKey !== currentKey || this._isDisconnected) return;

                    if (value) {
                        next[name.toLowerCase()] = value;
                        // Progressive render: colour/badge each object as soon
                        // as its count arrives instead of waiting for the
                        // slowest object on the canvas.
                        this.recordCounts = { ...next };
                    }
                }
            };

            await Promise.all(
                Array.from({ length: Math.min(concurrency, pendingNames.length) }, () => worker())
            );

            const currentKey = (this._erBoxes || []).map((b)=>b.name.toLowerCase()).sort().join('|');
            if (myToken !== this._heatmapRequestToken || !this.heatmapOn || modelKey !== currentKey || this._isDisconnected) return;
            this.recordCounts = { ...next };
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
    // Three distinct states, not the old binary "any records or not":
    //   - empty (0 records) — unchanged from before, its own orange
    //   - stale (records exist, but none touched in over a year) — new,
    //     a genuinely different signal from "empty" worth its own color,
    //     since an object with 50,000 untouched records from 3 years ago
    //     is not the same situation as one with zero records at all
    //   - active (records exist and at least one was touched within the
    //     last year) — unchanged, the original blue
    isStaleRecordInfo(rc) {
        if (!rc || !rc.count || !rc.lastModifiedDate) return false; // 0 records is "empty", a separate case — not "stale"
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return new Date(rc.lastModifiedDate) < oneYearAgo;
    }

    staleBadgeText(rc) {
        if (!rc || !rc.lastModifiedDate) return '';
        const dateText = new Date(rc.lastModifiedDate).toLocaleDateString();
        return this.isStaleRecordInfo(rc) ? `stale, last touched ${dateText}` : `last touched ${dateText}`;
    }

    heatColorFor(rc) {
        if (!rc || !rc.count) return '#fde3cc';           // empty — unchanged
        if (this.isStaleRecordInfo(rc)) return '#fef3c7'; // stale — new, distinct amber
        return '#cfe8fb';                                  // active — unchanged
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
        const signals     = this.sharingSignals[key];
        if (this.sharingViewOn && !signals) this.fetchSharingSignalForObject(name);

        this.hoverCard = {
            name,
            style: `left:${clientX + 16}px;top:${clientY + 12}px`,
            // box.fields is only the currently VISIBLE rows (whatever fits
            // in the box's current height) — a real, separate bug from the
            // one just fixed in buildErSource: if a box has ever been
            // resized shorter than its natural height, box.fields.length
            // alone undercounts, silently reporting fewer fields than the
            // entity actually has. box.hiddenCount (the rows that don't
            // currently fit) has to be added back in for the true total.
            fieldCount: box.fields.length + (box.hiddenCount || 0),
            objectTypeText: name.endsWith('__c') ? 'Custom Object' : 'Standard Object',

            hasRecordData: this.heatmapOn && recordCount != null,
            recordCountText: recordCount != null ? recordCount.count.toLocaleString() : '',
            // Shown alongside the count, not instead of it, so the hover
            // card gives the same "is this actually being used" signal
            // the heatmap's own color already does, in words rather than
            // just a color: when there are records but none touched
            // recently, that's a meaningfully different situation from
            // simply having no records at all, worth saying explicitly
            // rather than leaving the person to infer it from a color alone.
            recordFreshnessText: recordCount && recordCount.lastModifiedDate
                ? (this.isStaleRecordInfo(recordCount) ? 'Stale — ' : '') + 'Last touched ' + new Date(recordCount.lastModifiedDate).toLocaleDateString()
                : '',

            hasSharingData: this.sharingViewOn && !!sharing,
            internalSharingText: sharing && sharing.internal ? this.sharingBadgeFor(sharing.internal).label : 'Unknown',
            externalSharingText: sharing && sharing.external ? this.sharingBadgeFor(sharing.external).label : 'None configured',

            // Reliable for any object: RowCause = 'Rule' on the object's
            // own __Share table is the one value Salesforce documents as
            // meaning a sharing rule has fired. Apex Managed Sharing is a
            // different story — it can only be reliably told apart from
            // plain manual sharing on a CUSTOM object, since standard
            // objects can't define their own Apex Sharing Reason at all
            // and both use the exact same RowCause ('Manual') there — so
            // this is stated as genuinely "not determinable" for a
            // standard object, not guessed at, since showing a definite
            // answer there would be actively misleading rather than
            // merely incomplete.
            hasSharingSignalData: this.sharingViewOn && !!signals && signals.shareTableAvailable,
            sharingRuleText: signals && signals.hasSharingRule ? 'Yes' : 'No',
            apexSharingText: signals && signals.isCustomObject
                ? (signals.hasApexSharing ? 'Yes' : 'No')
                : 'Not determinable on standard objects'
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
        this.dictionaryFieldSearch=''; this.dictionaryFieldFilter='all'; this.dictionarySelectedField='';
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
        const myToken = this._dictionaryRequestToken;
        const objectName = this.dictionaryRow.apiName;
        this.dictionaryUsagePending = true;
        try {
            const fieldNames = this.dictionaryRow.fields.filter((f) => !f.isPrimaryKey).map((f) => f.apiName);
            const batchSize = 15;
            const batches = [];
            for (let i = 0; i < fieldNames.length; i += batchSize) batches.push(fieldNames.slice(i, i + batchSize));

            // Each batch is a separate Apex transaction. That keeps SOQL out
            // of Apex loops while avoiding Salesforce's aggregate-expression
            // limits on wide standard objects such as Account.
            const responses = await Promise.all(
                batches.map((fieldApiNames) => getFieldUsageStats({ objectApiName: objectName, fieldApiNames }))
            );
            if (myToken !== this._dictionaryRequestToken || !this.dictionaryRow || this.dictionaryRow.apiName !== objectName || this._isDisconnected) return;
            const pct = {};
            let usageError = null;
            (responses || []).forEach((stats) => {
                Object.assign(pct, (stats && stats.percentages) || {});
                if (!usageError && stats && stats.error) usageError = stats.error;
            });
            this.dictionaryRow = {
                ...this.dictionaryRow,
                fields: this.dictionaryRow.fields.map((f) => ({
                    ...f,
                    percentUsed: f.isPrimaryKey ? 100 : (pct[f.apiName] != null ? pct[f.apiName] : null)
                }))
            };
            this.dictionaryUsageComputed = true;
            if (usageError) this.errorMessage = usageError;
        } catch (e) {
            if (myToken === this._dictionaryRequestToken && !this._isDisconnected) this.errorMessage = this.reduceError(e);
        } finally {
            if (myToken === this._dictionaryRequestToken && !this._isDisconnected) this.dictionaryUsagePending = false;
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
        return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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

    // Single-object export mirrors the visible field table: current search, dropdown filter and sort.
    // Bulk Export All remains a complete dictionary export in natural order.
    getDictionaryRowForExport() {
        return { ...this.dictionaryRow, fields: this.dictionaryFilteredSortedFields };
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
        // Presentation-only layout reset: the DSL source and parser/compiler are untouched.
        this.erPositions={}; this.boxHeightOverrides={}; this.boxWidthOverrides={};
        this.renderDiagram();
        // Reflow to the current viewport after rebuilding the normal model geometry.
        requestAnimationFrame(()=>this.handleFitModel());
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

    handleDslScroll(event) {
        this.dslSuggestOpen = false;
        this.dslScrollTop = event?.target?.scrollTop || 0;
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
            this._pendingCaretPos = start + 2;
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

        // Re-apply the selection once LWC's own render cycle has run —
        // see the _pendingCaretPos field comment and renderedCallback()
        // for why this is handled there now, not via Promise.resolve().
        this._pendingCaretPos = caretPos;

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
     * Pixel position for the suggestions dropdown. With wrapping disabled the
     * editor is a simple monospace grid. With wrapping enabled, source lines
     * can occupy several visual rows, so account for the usable textarea
     * width while preserving source-line semantics and IntelliSense filtering.
     */
    computeDslSuggestStyle(textareaEl, caret) {
        const cs = getComputedStyle(textareaEl);
        const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const charWidth = this.measureCharWidth(font);
        const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;
        const padTop = parseFloat(cs.paddingTop) || 0;

        const before = textareaEl.value.substring(0, caret);
        const sourceLines = before.split('\n');
        const currentLine = sourceLines[sourceLines.length - 1] || '';
        let visualRow = sourceLines.length - 1;
        let visualCol = currentLine.length;

        if (this.dslWordWrap) {
            const usableWidth = Math.max(
                charWidth,
                textareaEl.clientWidth - padLeft - padRight
            );
            const columnsPerRow = Math.max(1, Math.floor(usableWidth / charWidth));

            visualRow = 0;
            for (let index = 0; index < sourceLines.length - 1; index++) {
                visualRow += Math.max(1, Math.ceil(sourceLines[index].length / columnsPerRow));
            }
            visualRow += Math.floor(currentLine.length / columnsPerRow);
            visualCol = currentLine.length % columnsPerRow;
        }

        const rawX =
            textareaEl.offsetLeft + padLeft + visualCol * charWidth -
            (this.dslWordWrap ? 0 : textareaEl.scrollLeft);
        const rawY =
            textareaEl.offsetTop + padTop + (visualRow + 1) * lineHeight -
            textareaEl.scrollTop;

        const editorWidth = textareaEl.clientWidth || this.dslPanelWidth;
        const maxLeft = Math.max(
            4,
            textareaEl.offsetLeft + editorWidth - this.DSL_SUGGEST_WIDTH - 10
        );
        const x = Math.min(Math.max(textareaEl.offsetLeft + 4, rawX), maxLeft);
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

        // 3) entity Name : field1[Type], field2, <partial field>
        //
        // Real bug fixed here: the previous version of this regex assumed
        // every already-typed field was plain [A-Za-z0-9_]+ with no
        // bracket suffix at all, which was true right up until picking a
        // field from this exact suggestion list started inserting
        // "FieldName[Type]" automatically. The moment one bracketed field
        // existed earlier on the same line, the regex could no longer
        // match the line at all, and intellisense silently stopped
        // working for every field typed after it — reported directly:
        // typing "AccountNumber" then a type-bearing suggestion, then
        // trying to autocomplete "Status" right after, did nothing until
        // the "[Text]" was deleted by hand.
        //
        // Fixed by using the exact same bracket-aware splitting the
        // parser itself uses (splitFieldList, imported from
        // erDiagramLogic.js) instead of a single monolithic regex, so a
        // comma inside an earlier field's own brackets (rollup/Required/
        // a type label) is never mistaken for a field boundary here
        // either — the same class of bug already fixed once in the
        // parser, now fixed the same way in its second occurrence.
        m = linePrefix.match(/^entity\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/i);
        if (m) {
            const entityName = m[1];
            const rawFieldsPortion = m[2];
            const endsWithComma = /,\s*$/.test(rawFieldsPortion);
            const parts = splitFieldList(rawFieldsPortion).map((s) => s.trim()).filter(Boolean);
            const completeParts = endsWithComma ? parts : parts.slice(0, -1);
            const partial = endsWithComma ? '' : (parts.length > 0 ? parts[parts.length - 1] : '');

            // Only offer suggestions while genuinely mid-typing a plain,
            // bracket-free field name — e.g. not while still inside an
            // unclosed "[" for the field being typed right now, where
            // "what field name is this" is already unambiguous and a
            // suggestion would either be wrong or redundant.
            if (!/^[A-Za-z0-9_]*$/.test(partial)) return null;

            const start = lineStart + linePrefix.length - partial.length;

            // A REAL, SEPARATE bug this fixes, not the one just above:
            // "already typed" was computed only from completeParts, which
            // is everything BEFORE the caret on this line — a field
            // already sitting AFTER wherever the caret happens to be (the
            // common case when inserting a new field in the middle of an
            // existing list, or just not typing strictly left-to-right)
            // was never excluded at all. Reported directly: a field
            // already on the entity's line kept showing up in the
            // dropdown as if it weren't there yet, which is actively
            // misleading, not just a missed convenience. Fixed by also
            // reading whatever comes after the caret on the SAME line
            // (from fullText, not just linePrefix, which by definition
            // only ever holds text up to the caret) and folding those
            // fields into the same exclusion set.
            const caret = lineStart + linePrefix.length;
            const restOfLineMatch = fullText.slice(caret).match(/^[^\n]*/);
            const afterCaretText = restOfLineMatch ? restOfLineMatch[0] : '';
            const afterCaretParts = splitFieldList(afterCaretText).map((s) => s.trim()).filter(Boolean);

            const already = new Set(
                completeParts.concat(afterCaretParts).map((s) => s.replace(/\[.*$/, '').toLowerCase())
            );
            const cached = this.objectFieldsCache[entityName.toLowerCase()];
            this.ensureFieldsCached(entityName);
            const items = (cached || [])
                .filter((f) => f.apiName.toLowerCase().startsWith(partial.toLowerCase()) && !already.has(f.apiName.toLowerCase()))
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
                        // Same marker text buildErSource()/the autocomplete
                        // would generate for this exact field — computed
                        // here, upfront, while the full field object (with
                        // friendlyType/isRollupSummary/required) is still in
                        // scope, since addFieldToEntity() only ever gets a
                        // plain string and has no way to look this back up
                        // once the field is reduced to just its name below.
                        // A real bug this exact gap caused: fields added via
                        // Compare with Org landed with no bracket at all,
                        // out of sync with every other way a field gets
                        // added to the DSL in this app.
                        newFields: newFields.map((f) => ({
                            id: ent.name + '-new-' + f.apiName,
                            name: f.apiName,
                            markerSuffix: this.buildFieldMarkerSuffix(f)
                        })),
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
        const result = this.driftResults.find((r) => r.entityName === entityName);
        const field = result ? result.newFields.find((f) => f.name === fieldName) : null;
        this.addFieldToEntity(entityName, fieldName, false, field ? field.markerSuffix : '');
        this.removeDriftEntry(entityName, 'newFields', fieldName);
    }

    handleAddAllDriftFields(event) {
        const entityName = event.currentTarget.dataset.entity;
        const result = this.driftResults.find((r) => r.entityName === entityName);
        if (!result) return;
        result.newFields.forEach((f) => this.addFieldToEntity(entityName, f.name, /* skipRender */ true, f.markerSuffix));
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

    addFieldToEntity(entityName, fieldName, skipRender, markerSuffix) {
        const fieldText = fieldName + (markerSuffix || '');
        const lines = this.sourceText.split('\n');
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^(\s*entity\s+)([A-Za-z0-9_]+)(\s*:\s*)?(.*)$/i);
            if (m && m[2].toLowerCase() === entityName.toLowerCase()) {
                found = true;
                const existing = (m[4] || '').trim();
                lines[i] = `${m[1]}${m[2]} : ${existing ? existing + ', ' : ''}${fieldText}`;
                break;
            }
        }
        if (!found) lines.push(`entity ${entityName} : ${fieldText}`);
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
    async handleFieldUsageNodeClick(e){
        const field=e.currentTarget.dataset.field,source=e.currentTarget.dataset.source;if(!field||!source)return;
        const existing=this.fieldUsageEvidence.filter(r=>r._detail&&r.Field_API_Name__c===field&&r.Source_Type__c===source),last=existing.length?existing[existing.length-1]:null;
        const page=await fieldUsageGetEvidenceDetail({objectApiName:this.fieldUsageObject,fieldApiName:field,sourceType:source,rowLimit:500,afterId:last?.Id||null});
        this.fieldUsageEvidence=[...this.fieldUsageEvidence.filter(r=>!(r._pageState&&r.Field_API_Name__c===field&&r.Source_Type__c===source)),...(page.rows||[]).map(r=>({...r,_detail:true})),{_pageState:true,Field_API_Name__c:field,Source_Type__c:source,hasMore:!!page.hasMore,nextCursor:page.nextCursor}];this._fieldUsageMapCache=this.rebuildFieldUsageMap();
    }
    rebuildFieldUsageMap(){
        const rows=this.fieldUsageEvidence||[],nodes=[],edges=[];const add=(key,label,sub,x,y,kind,extra={})=>nodes.push({key,label,sub,x,y,kind,...extra,style:'left:'+x+'px;top:'+y+'px;'});
        const connect=(a,b)=>{const A=nodes.find(n=>n.key===a),B=nodes.find(n=>n.key===b);if(A&&B)edges.push({key:a+'>'+b,x1:A.x+190,y1:A.y+34,x2:B.x,y2:B.y+34});};
        const fields=this.fieldUsageSelectedFields||[];let y=40;const centres=[];
        fields.forEach(field=>{const summaries=rows.filter(r=>!r._detail&&r.fieldApiName===field),fy=y,fk='f:'+field;add(fk,field,summaries.reduce((n,r)=>n+(r.occurrences||r.evidenceRows||0),0)+' usages',280,fy,'field');if(!summaries.length){const nk=fk+':none';add(nk,'No dependency detected','Current successful snapshot · 0 dependencies',540,y,'empty');connect(fk,nk);y+=90;}else{summaries.forEach(r=>{const tk=fk+':'+r.sourceType,details=rows.filter(d=>d._detail&&d.Field_API_Name__c===field&&d.Source_Type__c===r.sourceType),pageState=rows.find(d=>d._pageState&&d.Field_API_Name__c===field&&d.Source_Type__c===r.sourceType);add(tk,r.sourceType,(r.occurrences||r.evidenceRows||0)+' usages · '+(!details.length?'click to expand':pageState?.hasMore?'click to load more':details.length+' details loaded'),540,y,'type',{field,source:r.sourceType,expandable:true});connect(fk,tk);if(details.length){[...new Set(details.map(d=>d.Component_Name__c))].forEach((name,i)=>{const ck=tk+':'+i;add(ck,name,details.filter(d=>d.Component_Name__c===name).reduce((n,d)=>n+(d.Occurrence_Count__c||1),0)+' usages',800,y+i*76,'component');connect(tk,ck);});y+=Math.max(90,[...new Set(details.map(d=>d.Component_Name__c))].length*76);}else y+=90;});}centres.push(fy);y+=24;});
        const oy=centres.length?centres.reduce((a,b)=>a+b,0)/centres.length:40;add('object',this.fieldUsageObject||'Object','Selected object',30,oy,'object');fields.forEach(field=>connect('object','f:'+field));return {nodes,edges,width:1080,height:Math.max(650,y+80)};
    }
    get fieldUsageNodes(){return this._fieldUsageMapCache.nodes;}
    get fieldUsageEdges(){return this._fieldUsageMapCache.edges;}
    get fieldUsageCanvasStyle(){const m=this._fieldUsageMapCache;return 'width:'+m.width+'px;height:'+m.height+'px;transform:scale('+this.fieldUsageZoom+');transform-origin:0 0;';}



}