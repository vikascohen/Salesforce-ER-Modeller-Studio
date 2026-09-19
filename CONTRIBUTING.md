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



## Security

See [docs/SECURITY.md](docs/SECURITY.md) before touching anything
related to schema visibility or `Diagram_File__c` access — in
particular, the deliberate decision that object/field metadata is shown
to every user of the tool regardless of their own FLS/object permissions
elsewhere in the org. If you're adding a new describe-based feature,
match that existing behavior (no `isAccessible()`-style filtering on
schema metadata) rather than introducing per-user filtering
inconsistently with the rest of the app.

**Apex/Trigger dependency tracking (via Tooling API) was investigated
and declined — considered for cause, not overlooked.** Any feature that
needs to know which Apex class or trigger references a given field
(genuine field-usage/impact analysis, "where is this used") requires
`MetadataComponentDependency`, which is Tooling API only. Reaching
Tooling API from Apex needs a real, non-Lightning-session credential —
a Named Credential backed by an External Client App's Client Credentials
Flow — which needs real, per-org admin setup: an External Client App,
a dedicated integration user, an External Credential, and a Named
Credential, none of which this app otherwise requires for anything.
Packaging doesn't reduce that cost: confirmed directly against
Salesforce's own Named Credentials packaging documentation, the
sensitive parts — the Consumer Key/Secret and the External Credential's
populated Principal — are explicitly excluded from what a package can
carry ("External credential certificates and access tokens aren't
packageable"), for the stated reason that moving a secret between orgs
in cleartext via the Metadata API isn't workable from a security
standpoint. That means even a package built with the Named
Credential/External Credential *shells* included still leaves every
installing org needing to create their own External Client App,
generate their own secret, and populate it by hand — the exact same
admin burden as if nothing were packaged at all. Given that, this stays
out: the cost is real and doesn't shrink with better packaging, and it
would be the first thing in this app that isn't "deploy and go." If
this gets proposed again, this is why it didn't happen.

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
