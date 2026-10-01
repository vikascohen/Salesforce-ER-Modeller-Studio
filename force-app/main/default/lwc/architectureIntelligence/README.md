# Architecture Intelligence modules

`architectureIntelligence.js` remains the compatibility calculation facade used by Diagram Studio.

New modules deliberately separate responsibilities:

- `architectureExperience.js` — executive Overview and object-impact presentation models.
- `architectureRecommendations.js` — evidence-backed recommendations and ER-modelling actions.
- `architectureFramework.js` — versioned guidance registry.
- `architectureFindingContract.js` — stable finding/recommendation contract.
- `architecturePerformance.js` — model fingerprint cache and large-model render planning.
- `architectureProgress.js` — transparent named processing stages.
- `architectureMapViewport.js` — shared zoom/fit/scroll sizing behaviour.
- `architectureVisualModel.js` — reusable graph presentation model.
- `impactExplorer.js` — object and field impact presentation models.
- `relationshipFinderExperience.js` — plain-language A-to-B relationship results.

The design intentionally keeps Field Usage scanning separate from ER graph analysis. The UX can compose the evidence, but architecture analysis must not create Tooling API traffic merely to open Overview.
