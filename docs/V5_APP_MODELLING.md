# V5: Generate an ER model from a Salesforce app

V5 beta 5.0.0.1 is available on `v5-Beta`. See [installation details](V5_PACKAGE_RELEASE.md) and the [V5 release notes](V5_RELEASE_NOTES.md). It is a separate unlocked package from V4, not a verified in-place upgrade.

## Using the feature

1. Save any diagram you are editing.
2. Choose **File → Generate ER Model from App…**. The dialog loads available apps automatically. Choose **All apps**, **Custom apps** or **Standard apps** in the App type filter, then select a Salesforce app. Salesforce AppDefinition namespace metadata identifies standard apps; packaged apps with other namespaces are custom. Apps whose type cannot be identified remain available under All apps only.
3. Run a successful V5 org scan first. Generation always follows scoped Flow, LWC and Apex evidence; it requires field evidence as well as object discovery.
4. Optionally include object-triggered automation. This follows triggers and record-triggered flows for reached objects, including downstream objects; these are possible execution paths, not evidence of execution.
5. Fields are fixed to **Fields used by this app only**. Name, audit fields and relationship fields appear only when the reached app components reference them. Id remains the structural key. Known system, security and licensing tables remain hidden in app-generated data models. The optional **Show permission set and licence names as access cards** resolves named access records separately; it does not turn those tables into entities. Standard business objects such as Account and Contact remain eligible. Click **Generate ER Model**.
6. The complete schema is loaded and parsed before a new diagram tab is created. The dialog closes, the DSL editor opens, and the canvas renders from that same editable source. Use **Diagram → Model Details…** to inspect inclusion evidence and coverage, then save normally. DSL edits continue to update the canvas; saving stores the same DSL source.

Generation does not write object definitions or Salesforce business records. It uses the existing DSL compiler, renderer, fitting controls and diagram save path. Failed discovery, missing metadata, excessive scope or edits made during discovery leave the current model intact. The existing unsaved-tab implementation cannot recover unsaved source after switching tabs, so generation requires the current model to be saved first.

## Generation errors and recovery

Generation failures keep the dialog open and show a focused error banner, a help tooltip and the original error detail. Missing or incompatible scan evidence shows **Please run the org scan first** with an **Open Org Scan** shortcut to **Settings → Field Usage**. Choose **Run Scan Now**, wait for successful completion, then return to generation. Opening the shortcut does not start a scan automatically. There is no whole-schema or navigation-only fallback. Missing field evidence blocks generation with guidance rather than silently including every field. This metadata scan is separate from error logging.

Credential and empty-app failures have their own guidance. When a successful scan exists but app dependencies cannot be resolved, the error explicitly identifies an app-discovery issue, retains dependency coverage warnings and does not prescribe rerunning the scan. A disabled Generate button explains that an app must be selected, or that the current operation must finish. Failed attempts preserve the active diagram and DSL.

## What the org scan adds

The existing discovery and resumable work units are reused. A V5 run is marked with `Field_Usage_Run__c.Object_Scan_Version__c = 5`. The worker captures new evidence into `Object_Usage_Evidence__c` in the same savepoint as field evidence. A source chunk replaces its own prior object evidence on retry. Field evidence counts and the published field-usage MCP response contract remain unchanged.

| Source | Object evidence | Component links |
| --- | --- | --- |
| Apex classes and triggers | Static SOQL FROM targets, typed declarations and collections, constructors, sObject tokens, existing validated field references | Salesforce MetadataComponentDependency supplies class dependencies; trigger entry objects are recorded separately |
| Active flows | Explicit object properties, record variables and existing validated field references; record-triggered entry object | Subflows, invocable Apex actions and custom LWC screen components |
| LWC | Object-only and field schema imports, literal object API names, existing validated field references | Apex imports and nested `c-*` components |
| App navigation and pages | Object navigation items | Custom tabs, app dependencies, FlexiPages, utility pages and component chains exposed by Salesforce |

App discovery uses UI API app details and Salesforce's Tooling dependency graph. Browser generation calls use primitive JSON string request/response methods (`getAppScopeJson` and `expandScopeJson`); nested component DTOs are serialized explicitly rather than relying on unsupported Apex inner-class parameter binding. Missing component types or names fail explicitly instead of silently producing an empty model. Custom component tabs can expose a bundle ID in objectApiName rather than an sObject name. V5 resolves that ID to the real LWC/Aura bundle name and follows its scanned references. Dependency queries filter by component ID; missing IDs are resolved through type-specific Tooling lookups, since Salesforce can reject name predicates on MetadataComponentDependency even when describe marks them filterable. Non-object navigation items do not become fake ER entities. Only reached components contribute their scanned object references; arbitrary org-wide classes mentioning the same object are not treated as app members.

The existing Named Credential, `Salesforce_Tooling_API`, must support the UI API and Tooling API under its configured principal. The dropdown reflects apps available to that API principal. Users need `Diagram_Studio_User`, including the new controller and read-only object-evidence access. Source code and credentials are not sent to an external service.

## Boundaries

This is a static potential-dependency model, not a guarantee that every runtime object is known. Dynamically built SOQL/object names, variable-driven UI API configuration, dynamic component loading, some relationship-only references, managed-package source and excluded Apex classes can be unresolved. Only active Flow versions are scanned. Salesforce's dependency API does not cover every metadata relationship or conditional page assignment. The UI reports API failures and coverage limitations; absence of evidence is never proof an object is unused.

Dependency expansion is paginated and cycle-safe. Limits are explicit: 40 components per request, 2,000 evidence rows per expansion, 2,000 reached components, 150 expansion requests and 150 generated objects. Schema descriptions use chunks of 10 objects, because the existing controller queries field definitions per object. Repeated pagination cursors and size-limit breaches fail visibly. Generated DSL is checked against the current 131,072-character save limit.

The snapshot timestamp is displayed; live app/dependency metadata can be newer than the source scan. Rerun the scan after source changes. Coverage notes and snapshot identity are saved as DSL comments. Detailed inclusion evidence is available during generation, not persisted as a separate report.

## Validate from a desktop checkout

Use an isolated checkout and an explicitly selected non-production org:

```bash
git clone --branch v5-Beta https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git er-modeller-v5
cd er-modeller-v5
npm ci
npm test -- --runInBand
sf org list
sf org login web --alias er-v5-validation
sf project deploy start --dry-run --source-dir force-app --target-org er-v5-validation --test-level RunLocalTests --wait 10
```

If a validation exceeds the wait window:

```bash
sf project deploy report --use-most-recent --target-org er-v5-validation
```

A dry run does not install V5. A package build, actual deployment and interactive end-to-end org scan/app-generation acceptance remain separate release steps. `sfdx-project.json` associates V5 with its separate 2GP package; see [package details](V5_PACKAGE_RELEASE.md).

## Strict field scope and object provenance

Field evidence is read from the selected snapshot only for reached component type/name pairs, including LWC/Aura bundle resource paths. Other classes using the same object cannot contribute fields. Fields are intersected with live schema before DSL generation. A missing scanned field fails explicitly; no schema expansion is substituted. Objects without field evidence can have only their structural Id when other app objects have resolved fields. Model Details lists included and hidden objects, categories, source evidence and app-used fields. These are schema dependencies, not names of permission-set or licence records, nor proof of required assignments. Dynamic references and inaccessible source remain coverage limits.

## Named app component cards

Enable **Show Apex class and Flow names as component cards** in app generation to add reached components with resolved Salesforce component IDs to the canvas. These are green cards with the actual developer name and type, separate from sObject entities, without Id or schema fields. The setting is off by default; ordinary object import is unchanged. The editable DSL preserves cards using `component ApexClass Logger` and `component Flow Save_Log`. Apex and Flow components with the same name remain distinct. Component cards do not participate in schema descriptions, sharing or record-count requests. Their presence means potential dependency, not confirmed execution. This feature does not infer a Flow/Apex name from an `ApexClass` or `FlowDefinitionView` table reference. Those metadata tables are hidden with other system objects by default.

Canvas/image and draw.io exports include component cards. Mermaid remains an ER-only export and lists component names in comments rather than turning them into tables. Limits: at most 300 component cards. Custom objects (`__c`), platform events (`__e`) and custom metadata types (`__mdt`) share the custom-object purple colour. Regenerate existing app diagrams to apply the revised object scope and add component DSL declarations.

Opening a saved diagram shows an indeterminate Please wait indicator until loading and preparation finish. App generation shows persistent progress in the dialog footer for app/scan discovery, dependency expansion, metadata loading and DSL preparation. Failed requests clear the indicator and retain the existing error guidance; a superseded load cannot clear a newer load’s progress. Percentages are not guessed.

Default app scope also hides Image, Dashboard, Report and PlatformCachePartitionType. They stay outside the app-generated data model; manual schema import remains available separately. Fit Model lays out all sObject cards first using their relationships, then places Apex/Flow cards in a separate grid below the lowest object card. Fitting changes presentation only and preserves the DSL.

When a completed scan returns no object evidence and no API/discovery failure, the dialog names the selected app and explains that welcome-only apps or inaccessible managed components may not expose an ER model. API failures keep their diagnostic guidance. Switching apps never reuses the previous app’s objects as a fallback.

Drag to Canvas includes describable platform events and custom metadata, with object-type filters applied before the 80-chip display limit. Both use the existing schema-to-DSL drag/drop and dependency-focus behavior. Custom metadata heatmap reads up to 10,001 visible metadata record IDs in user mode and marks the count as a lower bound at the limit; no freshness date is inferred. Platform event heatmap/count and event/metadata record sharing are labelled N/A. Heatmap remains independent of sharing.

## Data Cloud coverage boundary

Data Cloud's standard Audience360 app can resolve configuration/navigation objects without exposing the field references used by Salesforce's platform screens. V5's Flow/LWC/Apex scanner does not implement Data Cloud DMO/DLO schema, mapping or data-graph discovery. When that app resolves no app-used field evidence, generation explains this coverage limit, does not prescribe the same scan again, and preserves the current DSL. It does not substitute all fields from DataStream/DataGraph configuration objects or claim those tables are the actual Data Cloud data model. A separate Data Cloud metadata integration is required for that capability; catalog schema by itself is not proof of app-used fields.

AggregateResult and ApexEmailNotification are also hidden from default app models as platform types. They stay outside app-generated data models; similarly named custom objects remain eligible. Regenerate existing app diagrams to apply this scope change.

Fit Model packs disconnected objects into rows, keeping relationship-connected groups together and all component cards below the object section. Object/component section labels and native full-name tooltips improve navigation; long headings are visually shortened only. Zoom/layout controls remain pinned outside the canvas scroller and can scroll horizontally on narrow panels. These changes do not rewrite DSL or alter relationship semantics.

Fit Model separates business/standard objects, platform events (`__e`), custom metadata (`__mdt`) and Apex/Flow component cards into successive sections. Events and metadata retain their entity fields and any DSL-declared relationships, including lines across sections. Section grouping does not infer lookup, publisher/subscriber or code-usage relationships from names or text fields.

## Optional OmniStudio scan layer

The scan probes standard OmniProcess/OmniProcessElement and OmniDataTransform/OmniDataTransformItem through global describe. It queries only existing, readable/queryable objects and described fields using dynamic SOQL with bound IDs and USER_MODE access. No static Omni sObject dependency is introduced. If OmniStudio is absent it skips safely and records a capability summary in the scan log. Managed OmniScript__c/DRBundle__c variants are detected and reported, but their configuration field variants are not scanned in this version.

Active OmniScripts/Integration Procedures and Data Mapper definitions are checkpointed as one component per resumable work unit. Validated Input/Output/Lookup object-field mappings and explicit object/field JSON properties contribute field evidence. Literal Data Mapper, Integration Procedure, reusable OmniScript and remote Apex references contribute dependency edges. Explicit Omni keys in LWC/Aura configuration and supported Flow metadata can connect app components to this evidence; app generation never includes every Omni definition simply because it mentions the same object. Names, Type/SubType/Language keys and process keys are indexed as source aliases.

Limits: 5,000 definitions per root type, 1,000 child items per component, 2,000 field-evidence entries per component, 131,072 characters per JSON configuration and 40 nesting levels. Limit breaches, malformed JSON, disappearing records and missing required child/configuration fields fail visibly through normal work-unit retry/error handling rather than accepting a partial component. Dynamic expressions, arbitrary JSON paths, relationship-path field mappings, generated wrappers without explicit Omni references, FlexCards and package-specific configurations are coverage limits. Configured SOQL strings are never executed. A new successful scan is needed to populate Omni evidence in an installed org; adding this code does not change existing snapshots.

Duplicate Data Mapper names/versions without a resolvable active identity are rejected rather than merged into a misleading app field scope. The first implementation has fixture coverage for standard-runtime objects and a live no-Omni org check; a real installed OmniStudio org acceptance test is still needed before claiming comprehensive version/package coverage.

Relationship Insights uses individually routed SVG edges with separate attachment ports. Same-row edges curve through the row gap, while long multi-row edges route outside the node grid so lookup lines do not mask master-detail lines. Blue remains Lookup, purple Master Detail and dashed red Polymorphic. Native edge tooltips identify the source field, target and DSL relationship kind; analysis labels and DSL semantics are unchanged.


## Reusable DSL and named access cards

V5 supports inert exported modules, plain saved-file imports, named imports and additive `extends`. Only `use` activates exported definitions; ordinary top-level declarations still render. See the [DSL reference](DSL.md) and [module guide](DSL-MODULES.md). These language features need no new scan.

The old technical-object checkbox is replaced by **Show permission set and licence names as access cards**. It resolves app visibility/reached Apex access grants, named permission sets, their explicit licence bindings and a namespaced app’s package licence when available. Names persist as typed `component` declarations with readable `label` strings. They occupy a separate fitted section and are excluded from schema analysis/heatmap/sharing. They do not assert required user assignments. Empty or inaccessible coverage is explained; no licence is invented. See [named access coverage](APP-ACCESS-CARDS.md).

IntelliSense covers all six component types, local/imported access declarations, resolved app cards, JSON label strings and module/import/inheritance syntax. Access-name suggestions work from saved declarations after reopening. Module and label parsing reject conflicts/malformed active text without substituting unrelated metadata.

The [V5 release notes](V5_RELEASE_NOTES.md) describe current functionality. Use the V5 beta links in [package installation](V5_PACKAGE_RELEASE.md).


## Standalone Lightning tab/component sources

In **File → Generate ER Model from App**, set **Model source → Lightning tab / component (LWC or Aura)**. The source catalogue lists readable LWC and Aura bundle identities, including components backing standalone tabs and Aura applications. **ER Modeller Studio (diagramStudio — LWC)** maps to Studio’s existing bundle; it does not create a new Salesforce app or App Launcher entry.

The server verifies the selected type/ID and resolves its actual developer name, rejects ambiguous same-name namespace identities, and attaches the completed V5 snapshot. Traversal begins only at that bundle, reusing the existing field/object/dependency pipeline. It does not infer every containing Salesforce app or every object a modelling component can display. Fields remain evidence-only, and dynamic/inaccessible/excluded source can limit coverage. Refresh source list reloads the catalogue. Limits: 1,000 bundles per type; incomplete catalogues fail visibly rather than being silently accepted.

Custom/Standard filters apply only to Salesforce app mode. Named permission/licence discovery also requires an app identity, so it is disabled in component mode rather than borrowing a containing app’s grants. Source changes clear the old selection; superseded catalogue responses cannot overwrite a newer source list. Failed generation preserves the current DSL/model.

A live check of the existing Studio bundle with object-triggered automation off traversed 77 components in seven expansion requests and resolved 109 field references using the existing snapshot, before platform-object filtering. No new scan or business-record changes were performed for that check. Run a new scan if your selected component or source changes are not covered by the existing V5 snapshot.

## Current DSL validation versus error history

Partial input such as `use` or `use cus` can be invalid while a statement is being completed. The editor shows its current source/line message inline and retains the last valid canvas. Completing `use Customer`, correcting the text or clearing it removes that validation message. Normal typing validation is not persisted or counted as unread diagnostic history. Genuine file/API/geometry/action errors keep their existing diagnostic path; prior persisted records are not deleted. The toolbar badge explicitly identifies unread recorded events, which are separate from current DSL validity.
