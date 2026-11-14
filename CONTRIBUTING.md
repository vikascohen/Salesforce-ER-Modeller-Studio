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

See the [V5 architecture](docs/ARCHITECTURE.md) for the scanner, model-generation and persistence components. The [compiler reference](Compiler.md) identifies the parser and module-resolution entry points.

## Security

Follow the [security guide](docs/SECURITY.md) when changing schema discovery, field access, credentials or saved diagrams. Check the permission requirements for the feature you change.

## Before opening a PR

- Run the JavaScript suite with `npm test`.
- For Apex changes, run the relevant Apex tests in a development org and review the results and coverage.
- Exercise the changed workflow in the Studio. Include the steps and results in the pull request.

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
