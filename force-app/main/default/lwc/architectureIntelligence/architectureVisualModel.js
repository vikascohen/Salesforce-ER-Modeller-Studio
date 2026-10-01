import { architectureRenderPlan } from './architecturePerformance';

/** Builds a reusable, presentation-neutral graph for Overview and Impact maps. */
export function buildArchitectureVisualModel(analysis, options = {}) {
    if (!analysis) return { nodes: [], edges: [], width: 900, height: 520, renderPlan: { mode: 'full', nodeLimit: 0 } };
    const renderPlan = architectureRenderPlan(analysis);
    const focus = options.focusObject || '';
    const source = [...(analysis.nodes || [])].sort((a, b) => {
        if (a.name === focus) return -1;
        if (b.name === focus) return 1;
        return b.degree - a.degree || a.name.localeCompare(b.name);
    });
    const visible = source.slice(0, renderPlan.nodeLimit || source.length);
    const visibleNames = new Set(visible.map(node => node.name));
    const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, visible.length) * 1.6)));
    const cellWidth = 230;
    const cellHeight = 145;
    const padding = 72;
    const nodeWidth = 174;
    const nodeHeight = 64;
    const width = Math.max(900, padding * 2 + Math.max(0, columns - 1) * cellWidth + nodeWidth);
    const rows = Math.ceil(visible.length / columns);
    const height = Math.max(520, padding * 2 + Math.max(0, rows - 1) * cellHeight + nodeHeight);
    const nodes = visible.map((node, index) => {
        const x = padding + (index % columns) * cellWidth;
        const y = padding + Math.floor(index / columns) * cellHeight;
        return {
            ...node,
            key: `architecture-node-${node.name}`,
            x,
            y,
            width: nodeWidth,
            height: nodeHeight,
            focused: node.name === focus,
            role: node.degree === 0 ? 'Standalone object' : node.name === focus ? 'Selected object' : 'Model object'
        };
    });
    const positions = new Map(nodes.map(node => [node.name, node]));
    const edges = (analysis.relationships || [])
        .filter(rel => visibleNames.has(rel.childEntity) && visibleNames.has(rel.parentEntity) && rel.childEntity !== rel.parentEntity)
        .map((rel, index) => ({
            key: `architecture-edge-${index}-${rel.childEntity}-${rel.parentEntity}`,
            child: rel.childEntity,
            parent: rel.parentEntity,
            kind: rel.kind || 'Lookup',
            field: rel.childField || rel.fieldName || rel.field || '',
            from: positions.get(rel.childEntity),
            to: positions.get(rel.parentEntity)
        }));
    return { nodes, edges, width, height, renderPlan, hiddenNodeCount: Math.max(0, source.length - visible.length) };
}
