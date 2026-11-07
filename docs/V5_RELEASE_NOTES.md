# V5 release notes — source preview

**Updated: 7 November 2026. Maintainer: Vikas Cohen.**

V5 is the current development source on [`v5-app-er-model`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/v5-app-er-model), reviewed in [PR #3](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/pull/3). Developer-org deployments have succeeded. **No V5 2GP package or installation link has been published.** Existing V4 links continue to install V4; this branch does not merge or replace the released package.

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

## Coverage limits and compatibility

The scanner is static evidence, not a complete runtime map. Dynamic references, inaccessible managed source and internal Salesforce screens can lack usable field evidence. Scheduler Setup may expose navigation without its app-used fields. Data Cloud DMO/DLO/mapping/data-graph discovery is not implemented; enabling Data Cloud alone does not add that scanner capability. Rerunning the same scan does not cure a coverage boundary.

The optional standard OmniStudio layer probes schema before querying, uses described fields/bound IDs/user-mode dynamic SOQL, and skips absent capabilities. Managed-package variants are detected but not scanned by adapters in this version. A real installed OmniStudio org acceptance test remains outstanding; configured SOQL text is never executed.

Existing diagram source is not automatically regenerated or rewritten. Regenerate an app model to apply the named-access scope. A fresh scan is not required for modules/labels/access-name lookup; a successful V5 snapshot is still needed for app-used fields, and source changes require a suitable new scan. Legacy duplicate filenames must be resolved before canonical indexing; do not rename/delete existing diagrams automatically. Existing saved imports continue to require readable target records.

## UI scanner transaction isolation

LWC and Aura bundles are discovered as one bundle per work unit, rather than groups of twelve, to bound source matching within each Salesforce transaction. LWC object/import/tag and Omni UI matching first locate literal candidate markers, then apply anchored expressions at those positions; expressions no longer search the entire large source. Comment stripping is reused for LWC and Omni references. Supported explicit references remain enabled. This addresses a live LWC worker rollback reporting `Regex too complicated`; Omni runtime discovery had safely skipped in that org.

## Validation and release status

Current validation and deployment IDs are recorded in [V5_VALIDATION.md](V5_VALIDATION.md). Automated checks cover legacy diagrams, module activation/imports/labels, all card types, keyboard completion, strict field scope, schema/card separation, connector geometry and named-access query limits/errors. Developer-org live checks verify actual app/permission names and stable import bindings.

A representative org’s passing tests do not prove universal package compatibility. Clean-org/package acceptance, comprehensive dynamic/managed-source coverage, external MCP end-to-end acceptance and a published V5 package remain separate release gates. No production deployment is implied by these source-preview notes.
