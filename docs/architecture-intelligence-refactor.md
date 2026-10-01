# Architecture Intelligence Refactor

Architecture Intelligence analyses the current or selected ER model. It is decision support, not an automatic compliance scanner.

## Primary experiences

1. **Architecture Overview** — What does this model look like and what deserves attention?
2. **Impact Explorer** — If an object or field changes, what should be investigated?
3. **Relationship Finder** — How are two objects connected?

Architecture Findings are part of Overview rather than a duplicate workspace.

## Finding contract

Every actionable finding must provide: what was found, why it matters, evidence, recommendation, modelling actions, trade-offs and limitations. Structural observations must not be presented as guaranteed business/runtime impact.

## Performance contract

The selected ER model is normalised/analyzed once and deterministic results may be cached by model fingerprint. Large graphs use progressive or clustered rendering rather than creating the full graph DOM at once. Expensive field-usage evidence remains on-demand.

## Processing UX

When analysis is not effectively immediate, expose real stages: Preparing model; Mapping relationships; Analysing architecture patterns; Evaluating architecture guidance; Building recommendations; Preparing visualisations. Do not display fabricated percentages.

## Visual UX

Maps are primary evidence. Shared interaction behaviour should include fit, zoom, pan, scroll, maximise/restore, resize, collapse/expand, outer padding and complete export without clipping. Text explains the visual; technical graph terminology is progressive disclosure.
