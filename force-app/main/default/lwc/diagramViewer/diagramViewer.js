import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getFile from '@salesforce/apex/DiagramFileController.getFile';
import saveDiagramAsFile from '@salesforce/apex/DiagramFileController.saveDiagramAsFile';
import { exportSvgAsPng } from 'c/diagramExportUtils';
import { parseEr, buildErGeometry, buildLegendGroup } from 'c/erDiagramLogic';

/**
 * Drop this on a Lightning Record Page, App Page, or Home Page and set
 * "Diagram Id" in the component properties (App Builder) to permanently
 * pin a saved Diagram Studio diagram there, read only. There is no runtime
 * "save to page" action in Salesforce; page composition always happens
 * through App Builder, this component is what you point at a saved record.
 *
 * @author Vikas Cohen
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

// LWC's template compiler doesn't recognize <marker> (or its refX/markerWidth
// attributes) as valid static markup, so these are still built via the DOM
// API rather than declared in the template. The template marks the <defs>
// container itself with lwc:dom="manual" so this appendChild is supported
// LWC — scoped to just that empty placeholder, not the whole <svg>, which
// stays fully reactive for the template-driven boxes/connectors inside it.
function injectSvgDefs(defsEl) {
    if (!defsEl || defsEl.childElementCount > 0) {
        return;
    }
    const markers = [
        { id: 'er-arrow',        w: 10, h: 10, rx: 8, ry: 3, d: 'M0,0 L8,3 L0,6',   fill: 'none', stroke: '#0070d2' },
        { id: 'er-diamond',      w: 12, h: 10, rx: 10, ry: 3, d: 'M0,3 L6,0 L12,3 L6,6 Z', fill: '#5c2d91', stroke: null },
        { id: 'er-diamond-open', w: 12, h: 10, rx: 10, ry: 3, d: 'M0,3 L6,0 L12,3 L6,6 Z', fill: 'none', stroke: '#ea4335' }
    ];
    markers.forEach(({ id, w, h, rx, ry, d, fill, stroke }) => {
        const m = document.createElementNS(SVG_NS, 'marker');
        m.setAttribute('id', id);
        m.setAttribute('markerWidth', w);
        m.setAttribute('markerHeight', h);
        m.setAttribute('refX', rx);
        m.setAttribute('refY', ry);
        m.setAttribute('orient', 'auto');
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', fill);
        if (stroke) {
            path.setAttribute('stroke', stroke);
        }
        m.appendChild(path);
        defsEl.appendChild(m);
    });
}

export default class DiagramViewer extends NavigationMixin(LightningElement) {
    @api diagramId;
    @api title;

    record;
    errorMessage = '';
    exportBusy = false;

    erBoxes = [];
    erConnectors = [];
    svgWidth = 800;
    svgHeight = 500;

    @wire(getFile, { fileId: '$diagramId' })
    wiredFile({ data, error }) {
        if (data) {
            this.record = data;
            this.errorMessage = '';
            this.renderDiagram();
        } else if (error) {
            this.errorMessage = this.reduceError(error);
        }
    }

    get hasDiagramId() {
        return !!this.diagramId;
    }
    get isReady() {
        return !!this.record;
    }
    get displayTitle() {
        return this.title || (this.record ? this.record.Name : 'Diagram');
    }
    get isEr() {
        return !!this.record && this.record.Diagram_Type__c === 'ER';
    }
    get svgViewBox() {
        return `0 0 ${this.svgWidth} ${this.svgHeight}`;
    }

    renderDiagram() {
        if (!this.record) {
            return;
        }
        try {
            const model = parseEr(this.record.Source_Code__c);
            const geo = buildErGeometry(model, {});
            this.erBoxes = geo.boxes;
            this.erConnectors = geo.connectors;
            this.svgWidth = geo.svgWidth;
            this.svgHeight = geo.svgHeight;
            this.errorMessage = '';
        } catch (e) {
            this.errorMessage = e.message;
        }
    }

    renderedCallback() {
        injectSvgDefs(this.template.querySelector('svg[data-role="viewer-svg"] defs'));
    }

    async handleExport() {
        this.exportBusy = true;
        try {
            const liveSvg  = this.template.querySelector('svg[data-role="viewer-svg"]');
            const safeName = (this.displayTitle || 'diagram').replace(/\s+/g, '-');

            // Clone so the legend can be baked into the export without altering
            // what's on screen.
            const exportSvg = liveSvg.cloneNode(true);
            exportSvg.appendChild(buildLegendGroup(this.svgWidth, this.svgHeight));

            const base64 = await exportSvgAsPng(exportSvg, 'PNG');
            const cvId = await saveDiagramAsFile({
                diagramFileId: this.diagramId || null,
                fileName:      safeName,
                pngBase64:     base64,
                pageSize:      'PNG'
            });

            this.errorMessage = '';
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: '/sfc/servlet.shepherd/version/download/' + cvId
                }
            });
        } catch (e) {
            this.errorMessage = 'Could not export image: ' + (e.message || JSON.stringify(e));
        } finally {
            this.exportBusy = false;
        }
    }

    reduceError(error) {
        if (Array.isArray(error.body)) {
            return error.body.map((e) => e.message).join(', ');
        } else if (error.body && typeof error.body.message === 'string') {
            return error.body.message;
        }
        return error.message ? error.message : JSON.stringify(error);
    }
}
