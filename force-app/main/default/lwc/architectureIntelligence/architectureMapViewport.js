export const MAP_ZOOM_MIN = 0.35;
export const MAP_ZOOM_MAX = 2.5;
export const MAP_ZOOM_STEP = 0.1;
export const MAP_OUTER_PADDING = 48;

export function clampArchitectureZoom(value) {
    return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, Math.round(Number(value || 1) * 100) / 100));
}

export function zoomArchitecture(current, direction) {
    const delta = direction === 'out' ? -MAP_ZOOM_STEP : MAP_ZOOM_STEP;
    return clampArchitectureZoom(Number(current || 1) + delta);
}

export function fitArchitectureMap(contentWidth, contentHeight, viewportWidth, viewportHeight, padding = MAP_OUTER_PADDING) {
    const availableWidth = Math.max(1, Number(viewportWidth || 0) - padding * 2);
    const availableHeight = Math.max(1, Number(viewportHeight || 0) - padding * 2);
    const width = Math.max(1, Number(contentWidth || 0));
    const height = Math.max(1, Number(contentHeight || 0));
    return clampArchitectureZoom(Math.min(1, availableWidth / width, availableHeight / height));
}

export function architectureViewportStyle(width, height, zoom) {
    const safeZoom = clampArchitectureZoom(zoom);
    return {
        stageStyle: `width:${Math.max(1, width)}px;height:${Math.max(1, height)}px;transform:scale(${safeZoom});transform-origin:0 0;`,
        scrollWidth: Math.ceil(Math.max(1, width) * safeZoom + MAP_OUTER_PADDING * 2),
        scrollHeight: Math.ceil(Math.max(1, height) * safeZoom + MAP_OUTER_PADDING * 2)
    };
}
