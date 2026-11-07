# Salesforce ER Modeller Studio V5

**By Crius Consulting · Maintainer: Vikas Cohen**

Build Salesforce ER diagrams with a visual canvas and DSL editor. Generate app-scoped models from scan evidence, inspect dependencies, and reuse model definitions across saved files.

## Install V5

**Version 5.0.0.1 · 2GP unlocked package · Beta · 91% packaging Apex coverage**

| Test environment | Installer |
| --- | --- |
| Salesforce sandbox | [Install V5](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000pMsvAAE) |
| Developer Edition | [Install V5](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000pMsvAAE) |

The beta cannot be installed in production until promoted. V5 is a separate package from V4; installing alongside an older package or migrating existing data needs a tested plan. See [package details](docs/V5_PACKAGE_RELEASE.md).

## Get started

1. Install in a clean test org, initially for admins only.
2. Assign **Diagram Studio User** to your user and open the **ER Modeller** tab.
3. Create a diagram in the DSL editor or drag objects onto the canvas. Save and reopen it to check access.
4. For org scanning, configure the target org's **Salesforce_Tooling_API** Named/External Credential and principal access, then run **Settings → Diagnostics**. Authentication must be configured in each target org; the installer does not transfer credentials.
5. Run **Org Scan** and wait for a successful snapshot. Choose **File → Generate ER Model from App** to select a Salesforce app or standalone Lightning component.

The DSL editor and canvas work without an org scan. App-based generation requires readable scoped object/field evidence. Small Developer Edition storage limits can constrain scan size and history.

## What is included in V5?

See the **[V5 release notes](docs/V5_RELEASE_NOTES.md)** for the full list of V5 features, fixes, compatibility and coverage limits: app-used fields, named component/access cards, reusable DSL modules, IntelliSense, canvas improvements and optional OmniStudio discovery.

## Documentation

- **For compiler documentation, visit [Compiler.md](Compiler.md)** — syntax, imports, exported modules, `use`, inheritance, component labels, validation and IntelliSense.
- [App modelling guide](docs/V5_APP_MODELLING.md) — generation options, scan evidence and setup requirements.
- [Named permission sets and licences](docs/APP-ACCESS-CARDS.md) — what access cards represent.
- [Architecture](docs/ARCHITECTURE.md) — implementation and system design.
- [Validation record](docs/V5_VALIDATION.md) — build results and remaining acceptance checks.
- [MCP administrator guide](docs/V4_MCP_ADMIN_GUIDE.md) — optional Hosted MCP configuration retained in V5.

## Older versions

To install an older version, visit the corresponding [version branch](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/branches) and follow its README. [V4 installation instructions](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/V4-latest) remain available there.

## Licence

See [LICENSE](LICENSE).
