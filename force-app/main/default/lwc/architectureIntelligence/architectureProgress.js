import { analyseArchitecture } from 'c/architectureIntelligence';
import { buildArchitectureRecommendations } from './architectureRecommendations';
import { buildArchitectureOverview, buildProcessingState } from './architectureExperience';
import { getCachedArchitectureAnalysis } from './architecturePerformance';

const yieldToUi = () => Promise.resolve();

/**
 * Runs architecture analysis as visible stages. onProgress is optional and is
 * invoked between stages so the host can render honest status rather than an
 * unexplained spinner. No fabricated percentage is emitted.
 */
export async function runArchitectureAnalysis(model, modelLabel, onProgress) {
    const completed = [];
    const report = async (stage, detail) => {
        if (onProgress) onProgress(buildProcessingState(stage, completed, detail));
        await yieldToUi();
    };

    await report('prepare', `Preparing ${modelLabel || 'ER model'}`);
    completed.push('prepare');

    await report('relationships', 'Mapping objects and relationships');
    const cached = getCachedArchitectureAnalysis(model, analyseArchitecture);
    completed.push('relationships');

    await report('patterns', cached.cacheHit ? 'Using cached structural analysis' : 'Analysing architecture patterns');
    completed.push('patterns');

    await report('guidance', 'Evaluating applicable architecture guidance');
    completed.push('guidance');

    await report('recommendations', 'Building evidence-backed recommendations');
    const recommendations = buildArchitectureRecommendations(cached.analysis);
    completed.push('recommendations');

    await report('visuals', 'Preparing architecture visualisations');
    const overview = buildArchitectureOverview(cached.analysis, modelLabel);
    completed.push('visuals');

    if (onProgress) onProgress({ complete: true, detail: 'Architecture analysis complete', stages: buildProcessingState('', completed).stages });
    return { analysis: cached.analysis, recommendations, overview, cacheHit: cached.cacheHit, fingerprint: cached.fingerprint };
}
