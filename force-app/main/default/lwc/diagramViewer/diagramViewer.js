import { LightningElement, api, wire } from 'lwc';
import getFile from '@salesforce/apex/DiagramFileController.getFile';
import { exportSvgAsPng } from 'c/diagramExportUtils';
import { parseEr, buildErGeometry } from 'c/erDiagramLogic';

/**
 * Drop this on a Lightning Record Page, App Page, or Home Page and set
 * "Diagram Id" in the component properties (App Builder) to permanently
 * pin a saved Diagram Studio diagram there, read only. There is no runtime
 * "save to page" action in Salesforce; page composition always happens
 * through App Builder, this component is what you point at a saved record.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

function injectSvgDefs(svg) {
    if (!svg || svg.querySelector('defs')) {
        return;
    }
    const defs = document.createElementNS(SVG_NS, 'defs');
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
        defs.appendChild(m);
    });
    svg.insertBefore(defs, svg.firstChild);
}

export default class DiagramViewer extends LightningElement {
    @api diagramId;
    @api title;

    record;
    errorMessage = '';

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
        injectSvgDefs(this.template.querySelector('svg[data-role="viewer-svg"]'));
    }

    handleExport() {
        const svg = this.template.querySelector('svg[data-role="viewer-svg"]');
        exportSvgAsPng(svg, (this.displayTitle || 'diagram').replace(/\s+/g, '-')).catch((e) => {
            this.errorMessage = 'Could not export image: ' + e.message;
        });
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
