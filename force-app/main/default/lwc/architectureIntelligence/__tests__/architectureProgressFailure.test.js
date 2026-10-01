import { buildProcessingState } from '../architectureExperience';

describe('architecture processing failure visibility', () => {
    it('keeps completed work visible when a later stage has not completed', () => {
        const state = buildProcessingState('guidance', ['prepare', 'relationships', 'patterns'], 'Evaluating architecture guidance');
        expect(state.stages.find(stage => stage.key === 'prepare').status).toBe('complete');
        expect(state.stages.find(stage => stage.key === 'guidance').status).toBe('active');
        expect(state.stages.find(stage => stage.key === 'recommendations').status).toBe('pending');
    });
});
