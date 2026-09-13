# Contributing

Thanks for considering a contribution. This is a small, single-package
Salesforce DX project, so the workflow is intentionally lightweight.

## Getting set up

```bash
git clone https://github.com/vikascohen/SalesforceERModeller.git
cd SalesforceERModeller
sf org login web --alias er-modeller-dev --set-default   # or use an existing scratch/sandbox org
sf project deploy start --source-dir force-app
sf org assign permset --name Diagram_Studio_User
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
- **Parser/layout changes** — `erDiagramLogic.js` is pure, dependency-free
  JS (it only reaches for the DOM in `buildLegendGroup`, for the export
  legend). That means you can sanity-check parser or geometry changes with
  a plain Node script — call `parseEr()`/`buildErGeometry()` on some sample
  DSL and assert on the output — before ever touching a real org. There's
  no committed test harness for this yet, so if you're fixing a parsing
  edge case, consider including the quick script you used to verify it in
  your PR description.
- **Apex tests** — there currently are none in this repo (`DiagramFileController`
  and `SchemaMetadataController` have zero test coverage). This is a known
  gap — a `DiagramFileControllerTest` / `SchemaMetadataControllerTest` pair
  covering the CRUD paths and describe/FLS logic would be a genuinely
  useful contribution on its own.
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
