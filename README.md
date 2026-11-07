# Salesforce ER Modeller Studio


**V5 source preview:** work on [`v5-app-er-model`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/v5-app-er-model) includes app-scoped ER generation, reusable DSL modules/imports, named access cards and canvas improvements. Start with the [V5 release notes](docs/V5_RELEASE_NOTES.md), [DSL reference](docs/DSL.md) and [V5 app modelling guide](docs/V5_APP_MODELLING.md). **V5 beta 5.0.0.1 is now available:** [installation and packaging details](docs/V5_PACKAGE_RELEASE.md), 91% packaging Apex coverage. Clean-org installation acceptance remains pending; the beta is not promoted for production. The V4 links below install the released V4 package.

**Salesforce data architecture intelligence, ER modelling and field-dependency analysis.**

**Latest released source:** V4 on [`main`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/main) and [`V4-latest`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/V4-latest)
**Package version:** `4.0.0.4` (2GP unlocked)
**Maintainer:** Vikas Cohen
**Release status:** V4.0.0.4 package build passed (88% Apex coverage); clean-sandbox and end-to-end MCP acceptance pending.

> **Before installing:** V4 contains the V1–V3 feature families plus V4 additions, but it is a **separate package**, not a verified in-place upgrade from V3. Do not assume both packages can be installed together. Validate in a disposable sandbox before considering production.

## Install V4

| Environment | Installation |
| --- | --- |
| **Salesforce sandbox** | [Install V4 in sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lHgXAAU) |
| **Salesforce production** | [Install V4 in production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lHgXAAU) |

Both URLs use the **same** subscriber package version ID: `04taj000000lHgXAAU`. The login domain determines the target environment, not the package contents. **The production URL does not imply production readiness.**

The V4 package build passed with **88% Apex coverage**, a passed coverage gate and **238 packaged metadata files**. See [release notes](docs/V4_RELEASE_NOTES.md) for identifiers and verification details.

## Capabilities by version

V4 includes the functionality developed across the earlier releases:

| Version | Feature families |
| --- | --- |
| **V1** | Interactive ER canvas, DSL import/export, data dictionary, schema drift, diagrams and sharing/field visibility insights. |
| **V2** | Architecture metrics, hotspots, object map and impact analysis, path finding, junction intelligence and change readiness. |
| **V3** | Field Usage Intelligence across Apex, Flows and UI components; dependency evidence, snapshots and field-change impact. |
| **V4** | Salesforce Hosted MCP actions, configurable Studio diagnostics and logging, scanner exclusions, settings improvements and diagram export refinements. |
| **V5 preview** | App-used field models, app component/access cards, capability-gated OmniStudio scan, modular DSL, typed canvas sections and clearer connectors. |

These are **feature families**, not a guarantee that every feature has passed clean-org acceptance testing.

## What's new in the V5 source preview

- **File → Generate ER Model from App** offers Salesforce app or standalone Lightning tab/component sources. Select **Lightning tab / component (LWC or Aura) → ER Modeller Studio (diagramStudio — LWC)** to model Studio itself without creating another Salesforce app. It resolves the selected root and reached component evidence. It generates only evidenced fields; Id is structural. It does not expand an object to all fields when evidence is missing.
- Optional cards display actual Apex/Flow names and named permission sets/licences. Access cards describe readable access configuration, not mandatory assignments; generic security/licensing tables remain outside the generated data model.
- `export module` stays off the canvas until `use` activates it. Import saved files with `import customer.dsl`, use named imports, and compose modules with additive `extends`. Plain DSL continues to work.
- Current DSL validation appears beside the editor and clears when corrected. Pauses while typing `use Customer` do not create persistent error-log notifications; real operation errors remain in history.
- IntelliSense covers keywords, exported modules, filenames, inheritance, entities/fields, component types, readable names and JSON-escaped display labels. Saved access declarations remain completion candidates after reopening.
- Fit Model separates objects, platform events, custom metadata, Apex/Flow and access cards. Arrow tips clear card shadows; badges and labels are separated from connector lines.
- Standard OmniStudio objects are scanned only when present/readable. Data Cloud DMO/DLO discovery and comprehensive dynamic/managed-source resolution are not implemented.

See [named access cards](docs/APP-ACCESS-CARDS.md), [DSL modules](docs/DSL-MODULES.md), [architecture](docs/ARCHITECTURE.md#23-v5-composition-app-models-and-named-access) and [validation history](docs/V5_VALIDATION.md). Tests and developer-org deployments do not establish a released V5 package or universal org compatibility.

## What's new in V4

V4 exposes **persisted Field Usage Intelligence** to authorised external systems and AI agents through **Salesforce Hosted Model Context Protocol (MCP)**. The four Apex actions are:

| MCP action | Purpose |
| --- | --- |
| **Get Snapshot Status** | Read the latest successful snapshot and current scan status. |
| **Get Field Usage** | Retrieve stored object/field dependency evidence with bounded, snapshot-aware pagination. |
| **Get Changed Fields** | Compare dependency evidence across completed snapshots. |
| **Run Scan** | Request an asynchronous scan, subject to permissions, active-run checks and cooldown. |

The package also provides MCP settings, configurable diagnostic persistence to an existing Salesforce object, session error visibility and Field Usage scanner exclusions. **Salesforce hosts the MCP server:** server registration, activation, external-client OAuth and scanner Tooling API credentials require separate configuration in the target org. No standalone MCP server is bundled.

**Security and scope:** Access to MCP administration and scan initiation is governed by the `Diagram_Studio_User` permission set and server-side checks. Dependency findings are evidence for impact assessment, **not a guarantee that a change is safe**. Logging is best-effort and is not a tamper-proof audit trail.

## Verification and limitations

| Check | Latest documented result |
| --- | --- |
| V4 2GP package creation | **Passed** — version `4.0.0.4` |
| Packaging Apex coverage | **88% — passed** |
| Development-org `RunLocalTests` | **1,444 / 1,444 passed** |
| Developer-org Hosted MCP server | Active with four registered tools (screenshots) |
| Clean-sandbox package installation | **Not yet verified** |
| Authenticated external MCP client calls | **Not yet accepted end to end** |
| Production deployment readiness | **Not established** |

The development-org test run and package build are distinct verification events. An earlier Metadata API deployment validation was blocked by a pending batch job; this does not invalidate the successful 2GP package build. See [package verification](docs/V4_PACKAGE_RELEASE.md) for details.

## Documentation

- [V5 release notes](docs/V5_RELEASE_NOTES.md) — current source-preview features, compatibility and limits.
- [V5 app modelling](docs/V5_APP_MODELLING.md) — scan requirements and strict field scope.
- [DSL reference](docs/DSL.md) and [module guide](docs/DSL-MODULES.md) — executable examples, imports, labels and completion.
- [Named permission sets and licences](docs/APP-ACCESS-CARDS.md) — evidence sources and access boundaries.

- [V4 release notes](docs/V4_RELEASE_NOTES.md) — release details, fixes, installation and known limitations.
- [Package verification and release checklist](docs/V4_PACKAGE_RELEASE.md) — 2GP build, metadata archive and outstanding acceptance.
- [MCP administrator guide](docs/V4_MCP_ADMIN_GUIDE.md) — Hosted MCP registration, permissions, OAuth and troubleshooting.
- [MCP technical setup](docs/V4_MCP_SETUP.md) — implementation and configuration details.
- [V4 requirements and progress](docs/V4_REQUIREMENTS.md) — detailed scope, completion estimates and acceptance gaps.
- [Diagnostics coverage](docs/DIAGNOSTIC_COVERAGE.md) — logging behaviour and limitations.
- [Architecture](docs/ARCHITECTURE.md) — system architecture and components.

## Versioning and migration

`main` and `V4-latest` contain the V4 source. **Earlier V1, V2 and V3 functionality remains part of V4**, but the V4 2GP unlocked package has a separate package ID from the V3 package. A V3 installation is **not automatically upgraded** by installing V4. Review metadata ownership, component overlap, permissions and data preservation before migration; do not uninstall an existing package without a tested plan.

V4 development and validation continue. Future MCP-driven DSL modelling, proposed-design assessment and design-review evidence retrieval are **proposals**, not features included in package `4.0.0.4`; see the [requirements tracker](docs/V4_REQUIREMENTS.md).

## Licence

See [LICENSE](LICENSE).
