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
always the right file — see
[docs/dsl-compiler-architecture.md](docs/dsl-compiler-architecture.md)
for a full walkthrough of what that file actually does, stage by stage,
plus a "where to make a change" map at the end.

## Scope: what this tool deliberately won't show

A rule that's come up twice now, worth writing down so it doesn't need
re-litigating every time it comes up again: if a feature describes what
an object *is* — its own fields, its own sharing setting, whether it has
data — it fits here. If it describes what *acts on* an object from the
outside — automation firing against it, code that references it — it
doesn't, even where it would be technically interesting to build.

Two features were evaluated against this rule and set aside:

- **Automation view** (active Flow count per object, badged on the
  canvas) — shipped, then removed. It worked technically (a real,
  verified standard object, `FlowDefinitionView`, not a guess), but the
  feature itself was the wrong fit for a tool about data *structure*
  once the "acts on it from outside" distinction was made explicit. It
  also turned out to under-deliver in practice — the toggle would turn
  on with no visible confirmation, most likely because the flows in a
  real org didn't cleanly match the record-triggered/active filter this
  used, something that only shows up against live data.
- **Object usage across Apex classes and Flows** ("this object is
  referenced by 10 classes and 8 flows") — considered, not built. Two
  independent reasons: it fails the same scope rule as Automation above,
  and the only Salesforce API that could answer it,
  `MetadataComponentDependency`, is Tooling API only — a Beta feature
  with no guaranteed availability, reachable from Apex only via an HTTP
  callout authenticated with `UserInfo.getSessionId()`, which is
  frequently unavailable specifically when Apex is invoked from
  Lightning/LWC context (the architecture this whole app uses). Even
  setting the scope question aside, this would be built on materially
  less reliable ground than everything else here.

If either of these gets proposed again, this is why they didn't happen —
considered and set aside for cause, not overlooked.

**Search for Field Usage** is a third case worth naming explicitly,
because it looks like it should have been rejected by the same rule
above and wasn't — worth being honest about that tension rather than
quietly building past it. It genuinely does describe what acts on a
field from the outside (Flows, OmniScripts referencing it), which is
exactly what the rule above says doesn't fit. The distinction that
actually holds: the rule was written about the *canvas* — keeping the
core diagramming view about structure, not automation. This feature is
a separate, opt-in screen a user deliberately navigates to (same
category as Data Dictionary, which already shows record-derived data
like % Used), not something integrated into the diagram itself. If a
canvas badge for "used by N flows" gets proposed again, that's the
Automation view above, already rejected — a dedicated search screen is
a different thing.

It also has a real, deliberate scope limit of its own, independent of
the canvas question: it covers Flow (object-level only — which flows
run on an object, not which specific element inside one reads a given
field) and OmniStudio (field-level, via a plain-text search against
`OmniProcess`/`OmniProcessElement`, not Tooling API). It does **not**
cover Apex classes, Apex triggers, or Page Layouts — reading Apex
source or a layout's definition requires Tooling API, which requires a
Named Credential, which requires a Connected App, all deliberately
declined for this tool to keep it a plain "deploy and go" installation
with nothing calling out or in. `FieldUsageController.cls` carries this
same reasoning in its own header comment. A field showing no results
in this screen has not been confirmed unused — only that it wasn't
found in the two sources this tool can actually see — and the results
screen says so directly, not just this file.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) before touching anything
related to schema visibility or `Diagram_File__c` access — in
particular, the deliberate decision that object/field metadata is shown
to every user of the tool regardless of their own FLS/object permissions
elsewhere in the org. If you're adding a new describe-based feature,
match that existing behavior (no `isAccessible()`-style filtering on
schema metadata) rather than introducing per-user filtering
inconsistently with the rest of the app.

## Before opening a PR

- **JS syntax** — every `.js` file in this repo happens to parse cleanly
  with plain Node (`node --check path/to/file.js`), which catches typos
  and syntax errors fast without needing a full LWC build. Run it against
  any file you touch.
- **LWC tests (Jest)** — there's a real `@salesforce/sfdx-lwc-jest` setup
  (`npm install && npm test`), 49 tests across all four LWC bundles. If
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
