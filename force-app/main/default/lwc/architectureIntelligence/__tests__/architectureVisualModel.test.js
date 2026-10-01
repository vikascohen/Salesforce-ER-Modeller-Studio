import { analyseArchitecture } from 'c/architectureIntelligence';
import { buildArchitectureVisualModel } from '../architectureVisualModel';

describe('architecture visual model', () => {
    it('builds a map that can focus an object without changing analysis', () => {
        const analysis = analyseArchitecture({
            entities: ['Account', 'Contact', 'Case'].map(name => ({ name, fields: [] })),
            relationships: [
                { childEntity: 'Contact', parentEntity: 'Account', kind: 'lookup' },
                { childEntity: 'Case', parentEntity: 'Account', kind: 'lookup' }
            ]
        });
        const map = buildArchitectureVisualModel(analysis, { focusObject: 'Account' });
        expect(map.nodes).toHaveLength(3);
        expect(map.nodes.find(node => node.name === 'Account').focused).toBe(true);
        expect(map.edges).toHaveLength(2);
        expect(map.width).toBeGreaterThan(0);
        expect(map.height).toBeGreaterThan(0);
    });
});
