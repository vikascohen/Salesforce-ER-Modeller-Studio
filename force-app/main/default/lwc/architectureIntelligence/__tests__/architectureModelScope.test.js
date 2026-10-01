import { buildArchitectureModelScope } from '../architectureModelScope';

describe('architecture model scope', () => {
    it('makes selected-model provenance explicit', () => {
        const scope = buildArchitectureModelScope('Customer Service Model', { entityCount: 42, relationshipCount: 96, fieldCount: 300 }, 'saved');
        expect(scope.label).toBe('Customer Service Model');
        expect(scope.scopeText).toBe('42 objects · 96 relationships');
        expect(scope.provenance).toContain('selected ER model');
        expect(scope.implementationProvenance).toContain('Field Usage Intelligence');
    });
});
