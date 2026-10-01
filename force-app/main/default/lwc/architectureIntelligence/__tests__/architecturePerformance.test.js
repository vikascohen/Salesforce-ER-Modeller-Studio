import { analyseArchitecture } from 'c/architectureIntelligence';
import { architectureRenderPlan, clearArchitectureAnalysisCache, fingerprintArchitectureModel, getCachedArchitectureAnalysis } from '../architecturePerformance';

function model(size, relationshipCount) {
    const entities = Array.from({ length: size }, (_, i) => ({ name: 'Object' + i + '__c', fields: [] }));
    const relationships = Array.from({ length: relationshipCount }, (_, i) => ({
        childEntity: entities[i % size].name,
        parentEntity: entities[(i + 1) % size].name,
        childField: 'Parent' + i + '__c',
        kind: 'lookup'
    }));
    return { entities, relationships };
}

describe('architecture performance helpers', () => {
    beforeEach(() => clearArchitectureAnalysisCache());

    it('returns the same fingerprint for equivalent model ordering', () => {
        const a = model(4, 3);
        const b = { entities: [...a.entities].reverse(), relationships: [...a.relationships].reverse() };
        expect(fingerprintArchitectureModel(a)).toBe(fingerprintArchitectureModel(b));
    });

    it('reuses deterministic analysis for an unchanged model', () => {
        const source = model(25, 24);
        const first = getCachedArchitectureAnalysis(source, analyseArchitecture);
        const second = getCachedArchitectureAnalysis(source, analyseArchitecture);
        expect(first.cacheHit).toBe(false);
        expect(second.cacheHit).toBe(true);
        expect(second.analysis).toBe(first.analysis);
    });

    it('protects the UI from rendering an enterprise graph all at once', () => {
        expect(architectureRenderPlan(analyseArchitecture(model(50, 49))).mode).toBe('full');
        expect(architectureRenderPlan(analyseArchitecture(model(250, 600))).mode).toBe('progressive');
        expect(architectureRenderPlan(analyseArchitecture(model(1000, 3000))).mode).toBe('clustered');
    });
});
