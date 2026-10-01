import { architectureViewportStyle, clampArchitectureZoom, fitArchitectureMap, zoomArchitecture } from '../architectureMapViewport';

describe('shared architecture map viewport', () => {
    it('clamps zoom so maps cannot disappear or grow without bound', () => {
        expect(clampArchitectureZoom(0.01)).toBe(0.35);
        expect(clampArchitectureZoom(99)).toBe(2.5);
    });

    it('fits the complete map inside the viewport with outer padding', () => {
        const zoom = fitArchitectureMap(2000, 1000, 1000, 600);
        expect(zoom).toBeGreaterThanOrEqual(0.35);
        expect(zoom).toBeLessThan(1);
    });

    it('provides scaled scroll dimensions so map edges remain reachable', () => {
        const view = architectureViewportStyle(1600, 900, 0.75);
        expect(view.stageStyle).toContain('transform:scale(0.75)');
        expect(view.scrollWidth).toBeGreaterThan(1200);
        expect(view.scrollHeight).toBeGreaterThan(675);
    });

    it('supports predictable zoom in and out', () => {
        expect(zoomArchitecture(1, 'in')).toBe(1.1);
        expect(zoomArchitecture(1, 'out')).toBe(0.9);
    });
});
