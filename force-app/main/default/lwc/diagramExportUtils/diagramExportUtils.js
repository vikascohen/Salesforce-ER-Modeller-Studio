/**
 * SVG → PNG export utilities — LWS-safe.
 * Renders SVG to a canvas and returns base64 PNG. No download attempted here.
 * Download is handled by the caller via Salesforce Files + NavigationMixin.
 */

export const PAGE_SIZES = {
    PNG: null,
    A4:  { w: 1123, h: 794,  label: 'A4 Landscape' },
    A3:  { w: 1587, h: 1123, label: 'A3 Landscape' }
};

/**
 * Render an SVG element to a PNG.
 * @param {SVGElement} svgElement
 * @param {string}     pageSize   'PNG' | 'A4' | 'A3'
 * @param {string}     [bgColor]  default #ffffff
 * @returns {Promise<string>}     base64 PNG (no data-URI prefix)
 */
export function exportSvgAsPng(svgElement, pageSize, bgColor) {
    if (!svgElement) return Promise.reject(new Error('No SVG element found — make sure a diagram is open.'));

    const bg   = bgColor || '#ffffff';
    const size = PAGE_SIZES[pageSize] || null;

    const vb   = svgElement.viewBox && svgElement.viewBox.baseVal;
    const srcW = (vb && vb.width)  || svgElement.getBoundingClientRect().width  || 800;
    const srcH = (vb && vb.height) || svgElement.getBoundingClientRect().height || 600;

    const scale = 2;
    let canvasW, canvasH, drawX, drawY, drawW, drawH;

    if (size) {
        const margin = 20;
        const fitW   = size.w - margin * 2;
        const fitH   = size.h - margin * 2;
        const ratio  = Math.min(fitW / srcW, fitH / srcH);
        drawW = srcW * ratio; drawH = srcH * ratio;
        drawX = margin + (fitW - drawW) / 2;
        drawY = margin + (fitH - drawH) / 2;
        canvasW = size.w; canvasH = size.h;
    } else {
        drawX = 0; drawY = 0; drawW = srcW; drawH = srcH;
        canvasW = srcW; canvasH = srcH;
    }

    // Serialize SVG → base64 data URI (no Blob, no createObjectURL)
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('width',  srcW);
    clone.setAttribute('height', srcH);
    clone.setAttribute('xmlns',  'http://www.w3.org/2000/svg');
    clone.removeAttribute('data-role');
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgUri    = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas  = document.createElement('canvas');
                canvas.width  = Math.round(canvasW * scale);
                canvas.height = Math.round(canvasH * scale);
                const ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, canvasW, canvasH);
                if (size) {
                    ctx.strokeStyle = '#cccccc';
                    ctx.lineWidth   = 0.5;
                    ctx.strokeRect(1, 1, canvasW - 2, canvasH - 2);
                }
                ctx.drawImage(img, drawX, drawY, drawW, drawH);

                let pngDataUri;
                try {
                    pngDataUri = canvas.toDataURL('image/png');
                } catch (e) {
                    reject(new Error('Canvas security error: ' + e.message));
                    return;
                }

                resolve(pngDataUri.split(',')[1]);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error('Failed to render SVG. The diagram may contain unsupported elements.'));
        img.src = svgUri;
    });
}
