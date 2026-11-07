# V5 release notes — beta 5.0.0.1

**Updated: 8 November 2026. Maintainer: Vikas Cohen.**

V5 is the current development source on [`v5-Beta`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/v5-Beta), reviewed in [PR #3](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/pull/3). Developer-org deployments have succeeded. **V5 beta 5.0.0.1 has built successfully with 91% Apex coverage.** See [V5 package installation](V5_PACKAGE_RELEASE.md) for the beta links and test-permission configuration. It has not been promoted. The maintainer reports installation in a second Developer Edition org and Tooling API configuration; its scan and full runtime acceptance are still in progress. Existing V4 links continue to install V4; this branch does not merge or replace the released package.

## V5 feature inventory

| Area | Included in V5 |
| --- | --- |
| App selection and discovery | Custom/standard/all app filters, refresh, app-navigation traversal, LWC/Aura standalone roots, source switching safeguards and coverage guidance. |
| Model generation | Evidenced fields only, optional app-page configuration plus scoped Apex/Flow/LWC/Aura evidence, optional object-triggered automation, progress, validated generated DSL and preservation of existing work on failure. |
| Named cards | Apex/Flow identities, permission sets and actual licence/package bindings, optional JSON display labels, separate access section and platform-table exclusions. |
| Compiler | Unique saved filenames, plain/named imports, inert exported modules, explicit use, additive inheritance, stable rename bindings, bounded resolution, conflicts and source-origin diagnostics. |
| Editor | Expanded IntelliSense, label escaping, context-aware token replacement, current inline validation and separate persisted operation history. |
| Canvas | Grouped fit layout, compact isolated rows, visible arrow tips, spaced labels/cardinalities, routed Relationship Insights edges, and loading feedback. |
| Events and metadata | Drag-to-canvas filters, custom-type colours, dedicated sections, declared cross-section relationships and appropriate sharing/heatmap N/A behaviour. |
| Scanner | Optional capability-gated standard OmniStudio discovery, explicit UI/Flow references, per-bundle UI transactions and large-source matching safeguards. |

The detailed sections below define each feature's scope and limits. Existing ER modelling, data dictionary, architecture analysis, field-usage and optional Hosted MCP feature families remain available. For compiler documentation, visit [Compiler.md](../Compiler.md).

## App page field discovery — source enhancement after beta 5.0.0.1

Salesforce app generation now offers **Include fields configured on app pages**, enabled by default in app mode. It adds explicit field items from readable app-assigned Lightning record pages and Dynamic Forms. Where applicable it reads navigation objects' View/Large page layouts for the Tooling API principal and default record type. These layouts can be shared by apps; fields are configuration evidence, not runtime observations. Provenance records the live read separately from the scan timestamp.

Turn the option off for scoped component field references alone. Standalone LWC/Aura mode is unchanged. No object-info field collection or full-schema fallback is used. Unreadable assignment metadata does not trigger assumed default layouts; unsupported layouts are warnings. A successful existing V5 scan remains required, but this UI configuration is fetched on demand rather than persisted by a new scan.

This source enhancement is deployed for testing in Crius. It is **not included in installer 5.0.0.1**; another package version is required for installed orgs.

## App-scoped ER generation

- Generate from a custom or standard Salesforce app through **File → Generate ER Model from App**. Filters distinguish custom, standard and unclassified apps.
- Resolve navigation, custom component tabs and reached static Flow, LWC, Aura and Apex evidence from the successful V5 snapshot. Object-triggered automation is optional.
- Include **only fields evidenced in reached app components**. Id remains the structural key; Name, audit and relationship fields are not added automatically. Failure does not silently expand to every field or reuse a previous app’s model.
- Validate generated DSL before replacing editor/canvas state. Preserve existing work on failed discovery and display progress/recovery guidance. No data-object metadata or business records are deployed by generation.

## Standalone Lightning sources and current validation

The generator now has a **Model source** selector for Salesforce apps or **Lightning tab / component (LWC or Aura)**. Select **ER Modeller Studio (diagramStudio — LWC)** to start directly from the existing Studio bundle, without creating a separate app. The same successful V5 snapshot and strict app-used field rules apply. Catalogue identities are verified, source switching is race-safe, and ambiguous namespace names fail without mixing scope. Custom/Standard filters and named app-access discovery remain specific to Salesforce app mode.

Current DSL syntax validation now appears beside the editor and clears after correction. Typing `use` or `use cus` before completing `use Customer` no longer creates persistent unread error notifications. The last valid canvas stays visible during an incomplete edit. Genuine operation diagnostics and previously stored history are retained; the toolbar badge identifies unread recorded events.

## Named access cards replace generic licensing tables

**Show permission set and licence names as access cards** replaces the old technical-object checkbox. Known platform/security/licensing tables stay outside app-generated data models.

- Show actual permission-set labels/API names from explicit app visibility or reached Apex access grants; profile-owned sets are excluded.
- Follow the discovered permission set’s actual LicenseId to the named PermissionSetLicense or UserLicense record.
- For a namespaced app with a PackageLicense record, show its installed package name when readable; otherwise identify its namespace explicitly.
- Persist the names as typed component declarations with optional JSON-string display labels. Put them in a separate fitted **Permission Sets & Licences** section.
- Explain missing/inaccessible bindings. Do not infer licence requirements, assignments or all possible access routes, and do not substitute an org-wide licence list.

Live app-visibility checks resolved **Warden Studio User**, **Nebula Logger: Admin** and **Nebula Logger: Log Viewer**. Those sets had no explicit licence binding. Licence and package-name branches also have HTTP-fixture tests. Initial access coverage excludes profiles, permission set groups, Flow-specific grants, indirect feature licences and user-assignment evaluation. See [APP-ACCESS-CARDS.md](APP-ACCESS-CARDS.md).

## Modular DSL and IntelliSense

- `export module` definitions remain off the canvas until `use` activates them. Top-level declarations continue to render and merge with active modules.
- Import saved files with `import customer.dsl` or `import Customer from customer.dsl`; no `./` or directory syntax. Only exported modules are eligible for use/inheritance.
- `extends` performs additive model composition. Detect cycles, ambiguous symbols, conflicting field/relationship definitions and conflicting component labels with source-origin errors.
- Enforce canonical saved-filename uniqueness on new saves/renames/direct writes. Persist record-ID import bindings so existing saved imports survive file rename. Import sources remain live saved content, with Refresh imports; they are not version-pinned.
- Support ApexClass, Flow, PermissionSet, PermissionSetLicense, UserLicense and PackageLicense cards with optional JSON-string `label`. Labels survive files, modules and exports without changing card identity.
- IntelliSense covers keywords, `from`, `extends`, exported symbols, filenames, entities/fields, all card types, local/imported saved access identities, resolved app cards and escaped display labels. Keyboard acceptance preserves surrounding source and places the caret inside the label quotes.
- Keep the completion index tolerant of unfinished/invalid source. Validate active DSL before rendering; reject malformed/conflicting labels. Composition is bounded to 32 files including the root, 16 import levels and 1,048,576 characters.

See the [DSL reference](DSL.md) and [module guide](DSL-MODULES.md). Canvas schema deletion/field reconciliation is guarded for modular files; edit shared definitions in the DSL. Ordinary flat models and their editing behaviour remain supported.

## Canvas and object coverage

- Fit Model separates objects, platform events, custom metadata, Apex/Flow and named access cards. It packs isolated objects into rows and keeps related groups together.
- Make connector tips visible outside parent card borders/shadows, align straight routes where possible and separate labels/cardinality badges. Hover descriptions identify direction toward the referenced parent. Relationship Insights routes distinct paths so lookup blue cannot mask master-detail purple.
- Include describable platform events/custom metadata in Drag to Canvas, with type filters. Keep custom-type colouring consistent. Preserve declared cross-section relationships without inferring links from names/text fields.
- Keep heatmap independent of Sharing View. Platform event counts/heatmap and event/metadata record sharing are N/A; metadata counts are user-mode, bounded and labelled when truncated.
- Show indeterminate progress when opening/preparing diagrams or generating app models; do not invent percentages.
