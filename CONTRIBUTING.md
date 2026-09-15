# Contributing

Thanks for considering a contribution. This is a small, single-package
Salesforce DX project, so the workflow is intentionally lightweight.

## Getting set up

```bash
git clone https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git
cd Salesforce-ER-Modeller-Studio
sf org login web --alias er-modeller-dev --set-default   # or use an existing scratch/sandbox org
sf project deploy start --source-dir force-app
sf org assign permset --name Diagram_Studio_User
npm install   # for the Jest test suite -- see "Before opening a PR" below
```

## Project layout

See the [Architecture diagram](README.md#architecture) and
[Components table](README.md#components) in the README for how the pieces
fit together. The short version: `diagramStudio` and `diagramViewer` are
thin UI shells — almost all of the interesting logic (DSL parsing, layout,
the export legend) lives in `erDiagramLogic.js`, which has zero LWC/Apex
dependencies. If you're fixing a rendering or parsing bug, that's almost
always the right file.

## Before opening a PR

- **JS syntax** — every `.js` file in this repo happens to parse cleanly
  with plain Node (`node --check path/to/file.js`), which catches typos
  and syntax errors fast without needing a full LWC build. Run it against
  any file you touch.
- **LWC tests (Jest)** — there's a real `@salesforce/sfdx-lwc-jest` setup
  (`npm install && npm test`), 43 tests across all four LWC bundles. If
  you're touching `erDiagramLogic.js` specifically, that file is pure,
  dependency-free JS (it only reaches for the DOM in `buildLegendGroup`,
  for the export legend), so its tests run as plain function calls with
  no component mounting needed — by far the fastest feedback loop in this
  repo, and the right place to add coverage for a parsing or layout fix.
  `diagramStudio`'s suite covers representative core flows, not every
  feature — Sharing View, Heatmap, Data Dictionary, and Compare with Org
  don't have dedicated tests yet, which is a good first contribution if
  you're looking for one.
- **Apex tests** — `DiagramFileControllerTest`, `SchemaMetadataControllerTest`,
  and `DiagramPreferenceControllerTest` cover the CRUD, describe/dictionary,
  and preference paths. Run `sf apex run test --code-coverage --synchronous`
  in your org before opening a PR that touches Apex.
- **Manual check** — deploy to a real org and click through the flow your
  change touches (type DSL, drag-drop from the palette, import from org,
  export a PNG, etc.) — there's no CI here to catch a broken template
  binding for you.

## Code style

- Match what's already there: 4-space indentation, `@author` JSDoc tags on
  new files, comment banners (`// ── section ──`) separating logical
  sections of a component's JS.
- Keep `erDiagramLogic.js` dependency-free (no LWC imports) so it stays
  independently testable.
- Prefer small, focused PRs — one bug fix or one feature at a time makes
  review (and reverting, if needed) much easier.

## Reporting a bug

Open a GitHub issue with the DSL snippet (if relevant) that reproduces it,
what you expected, and what actually happened. For rendering bugs, a
screenshot or exported PNG helps a lot.

## License

By contributing, you agree your contribution is licensed under this
repo's [MIT License](LICENSE).
