# Salesforce ER Modeller Studio V5

**By Crius Consulting · Maintainer: Vikas Cohen**

Build Salesforce ER diagrams with a visual canvas and DSL editor. Generate app-scoped models from scan evidence, inspect dependencies, and reuse model definitions across saved files.

## Install V5

**Version 5.0.0.1 · 2GP unlocked package · Beta · 91% packaging Apex coverage**

| Test environment | Installer |
| --- | --- |
| Salesforce sandbox | [Install V5](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000pMsvAAE) |
| Developer Edition | [Install V5](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000pMsvAAE) |

The beta cannot be installed in production until promoted. V5 is a separate package from V4; installing alongside an older package or migrating existing data needs a tested plan. See [setup and package details](docs/SETUP.md).

## Get started

1. Install in a clean test org, initially for admins only.
2. Assign **Diagram Studio User** to your user and open the **ER Modeller** tab.
3. Create a diagram in the DSL editor or drag objects onto the canvas. Save and reopen it to check access.
4. For org scanning, configure the target org's **Salesforce_Tooling_API** Named/External Credential and principal access, then run **Settings → Diagnostics**. Authentication must be configured in each target org; the installer does not transfer credentials.
5. Run **Org Scan** and wait for a successful snapshot. Choose **File → Generate ER Model from App** to select a Salesforce app or standalone Lightning component.

The DSL editor and canvas work without an org scan. App-based generation requires readable scoped object/field evidence. Small Developer Edition storage limits can constrain scan size and history.

### Health Check and Apply Fix

We recommend that only Salesforce administrators test **Apply Fix**, in a sandbox. Avoid using it in production. Reviewing scan gaps is read-only. Applying a fix adds supported object and field Read grants to **Diagram Studio User**, which can expose field values on records available to anyone assigned that permission set. You can leave gaps unresolved: the scan continues, but field usage and relationships that depend on skipped metadata may be missing from the model.

**Run Scan Now** automatically reviews recorded Read gaps when a permission administrator runs it in a supported Industry Cloud sandbox, Developer Edition, or active trial. The background job adds eligible Read grants to Diagram Studio User and starts one verification scan if it added grants and completed without a repair error. The verification pass ends the workflow. Scheduled scans and manual Health Check are independent. Health Check lists remaining skips as coverage limits and reports actual scan, connection, or repair failures separately.


## What is included in V5?

The branch also contains an app-page field discovery enhancement tested in Crius. It requires a newer package build; installer 5.0.0.1 remains unchanged.

See the **[V5 release notes](docs/V5_RELEASE_NOTES.md)** for the full list of V5 features, fixes, compatibility and coverage limits: app-used fields, named component/access cards, reusable DSL modules, IntelliSense, canvas improvements and optional OmniStudio discovery.

## Documentation

- **[Compiler.md](Compiler.md)** — current DSL syntax, imports, modules, inheritance, cards and IntelliSense.
- [V5 release notes](docs/V5_RELEASE_NOTES.md) — features and improvements.
- [Setup](docs/SETUP.md) — installation, Tooling API, app generation and optional MCP.
- [V5 architecture](docs/ARCHITECTURE.md) — current components, data flows, storage and diagrams.
- [Security](docs/SECURITY.md) — permissions and credential boundaries.
- [Validation](docs/VALIDATION.md) — current build, tests, coverage and acceptance results.

## Older versions

To install an older version, visit the corresponding [version branch](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/branches) and follow its README. [V4 installation instructions](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-4-stable) remain available there.

## Licence

See [LICENSE](LICENSE).
