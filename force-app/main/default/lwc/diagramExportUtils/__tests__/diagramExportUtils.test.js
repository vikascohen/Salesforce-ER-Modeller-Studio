import { exportSvgAsPng, PAGE_SIZES } from 'c/diagramExportUtils';

// jsdom implements <canvas> as an element but not a real 2D rendering
// backend, and doesn't actually load images set via img.src. Both are
// mocked here so the success path can be verified without a real browser.
function mockCanvasAndImage() {
    const ctxStub = {
        scale: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        drawImage: jest.fn(),
        fillStyle: null,
        strokeStyle: null,
        lineWidth: null
    };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ZmFrZS1wbmc=');

    class FakeImage {
        set src(_value) {
            // Real browsers decode async; a microtask here is enough for the
            // Promise-based code under test and keeps the test itself sync-ish.
            Promise.resolve().then(() => {
                if (this.onload) this.onload();
            });
        }
    }
    global.Image = FakeImage;

    return ctxStub;
}

describe('PAGE_SIZES', () => {
    it('exposes PNG as a null (native-size) entry and real dimensions for A4/A3', () => {
        expect(PAGE_SIZES.PNG).toBeNull();
        expect(PAGE_SIZES.A4.w).toBeGreaterThan(0);
        expect(PAGE_SIZES.A4.h).toBeGreaterThan(0);
        expect(PAGE_SIZES.A3.w).toBeGreaterThan(PAGE_SIZES.A4.w); // A3 is larger than A4
    });
});

describe('exportSvgAsPng', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rejects immediately with a clear message when no SVG element is given', async () => {
        await expect(exportSvgAsPng(null, 'PNG')).rejects.toThrow(/No SVG element/);
    });

    it('resolves with base64 PNG data (no data-URI prefix) for a native-size export', async () => {
        mockCanvasAndImage();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 400 300');
        document.body.appendChild(svg);

        const result = await exportSvgAsPng(svg, 'PNG');
        expect(result).toBe('ZmFrZS1wbmc=');
        expect(result).not.toMatch(/^data:/); // caller (NavigationMixin flow) expects the prefix already stripped
    });

    it('draws a page border for A4/A3 exports but not for native PNG size', async () => {
        const ctxA4 = mockCanvasAndImage();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 400 300');
        await exportSvgAsPng(svg, 'A4');
        expect(ctxA4.strokeRect).toHaveBeenCalled();

        jest.restoreAllMocks();
        const ctxNative = mockCanvasAndImage();
        await exportSvgAsPng(svg, 'PNG');
        expect(ctxNative.strokeRect).not.toHaveBeenCalled();
    });

    it('rejects with a helpful message when the image fails to decode', async () => {
        class FailingImage {
            set src(_value) {
                Promise.resolve().then(() => {
                    if (this.onerror) this.onerror();
                });
            }
        }
        global.Image = FailingImage;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 400 300');
        await expect(exportSvgAsPng(svg, 'PNG')).rejects.toThrow(/Failed to render SVG/);
    });
});
