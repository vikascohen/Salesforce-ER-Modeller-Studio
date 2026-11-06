# V5: Generate an ER model from a Salesforce app

V5 is a source preview on `v5-app-er-model`. It does not replace the published V4 package, and there is no V5 installation link or package version yet.

## Using the feature

1. Save any diagram you are editing.
2. Choose **File → Generate ER Model from App…**. The dialog loads available apps automatically; select a Salesforce app.
3. Keep **Include Flow, LWC and Apex object usage from org scan** enabled for dependency expansion. Run a successful V5 org scan first; V4 snapshots contain field evidence and are not a substitute.
4. Optionally include object-triggered automation. This follows triggers and record-triggered flows for reached objects, including downstream objects; these are possible execution paths, not evidence of execution.
5. Choose **Relationships and name** (the compact default) or **All fields**, then click **Generate ER Model**.
6. The complete schema is loaded and parsed before a new diagram tab is created. The dialog closes, the DSL editor opens, and the canvas renders from that same editable source. Use **Diagram → Model Details…** to inspect inclusion evidence and coverage, then save normally. DSL edits continue to update the canvas; saving stores the same DSL source.

Generation does not write object definitions or Salesforce business records. It uses the existing DSL compiler, renderer, fitting controls and diagram save path. Failed discovery, missing metadata, excessive scope or edits made during discovery leave the current model intact. The existing unsaved-tab implementation cannot recover unsaved source after switching tabs, so generation requires the current model to be saved first.

## Generation errors and recovery

Generation failures keep the dialog open and show a focused error banner, a help tooltip and the original error detail. Missing or incompatible scan evidence shows **Please run the org scan first** with an **Open Org Scan** shortcut to **Settings → Field Usage**. Choose **Run Scan Now**, wait for successful completion, then return to generation. Opening the shortcut does not start a scan automatically. For an app-navigation-only model, turn off the Flow, LWC and Apex usage option; that mode does not require a scan. This metadata scan is separate from error logging.

Credential and empty-app failures have their own guidance. A disabled Generate button explains that an app must be selected, or that the current operation must finish. Failed attempts preserve the active diagram and DSL.

## What the org scan adds

The existing discovery and resumable work units are reused. A V5 run is marked with `Field_Usage_Run__c.Object_Scan_Version__c = 5`. The worker captures new evidence into `Object_Usage_Evidence__c` in the same savepoint as field evidence. A source chunk replaces its own prior object evidence on retry. Field evidence counts and the published field-usage MCP response contract remain unchanged.

| Source | Object evidence | Component links |
| --- | --- | --- |
| Apex classes and triggers | Static SOQL FROM targets, typed declarations and collections, constructors, sObject tokens, existing validated field references | Salesforce MetadataComponentDependency supplies class dependencies; trigger entry objects are recorded separately |
| Active flows | Explicit object properties, record variables and existing validated field references; record-triggered entry object | Subflows, invocable Apex actions and custom LWC screen components |
| LWC | Object-only and field schema imports, literal object API names, existing validated field references | Apex imports and nested `c-*` components |
| App navigation and pages | Object navigation items | Custom tabs, app dependencies, FlexiPages, utility pages and component chains exposed by Salesforce |

App discovery uses UI API app details and Salesforce's Tooling dependency graph. Source IDs are used where available; developer names and labels are included because the dependency API can expose an app's display name instead of its developer name. Non-object navigation items do not become fake ER entities. Only reached components contribute their scanned object references; arbitrary org-wide classes mentioning the same object are not treated as app members.

The existing Named Credential, `Salesforce_Tooling_API`, must support the UI API and Tooling API under its configured principal. The dropdown reflects apps available to that API principal. Users need `Diagram_Studio_User`, including the new controller and read-only object-evidence access. Source code and credentials are not sent to an external service.

## Boundaries

This is a static potential-dependency model, not a guarantee that every runtime object is known. Dynamically built SOQL/object names, variable-driven UI API configuration, dynamic component loading, some relationship-only references, managed-package source and excluded Apex classes can be unresolved. Only active Flow versions are scanned. Salesforce's dependency API does not cover every metadata relationship or conditional page assignment. The UI reports API failures and coverage limitations; absence of evidence is never proof an object is unused.

Dependency expansion is paginated and cycle-safe. Limits are explicit: 40 components per request, 2,000 evidence rows per expansion, 2,000 reached components, 150 expansion requests and 150 generated objects. Schema descriptions use chunks of 10 objects, because the existing controller queries field definitions per object. Repeated pagination cursors and size-limit breaches fail visibly. Generated DSL is checked against the current 131,072-character save limit.

The snapshot timestamp is displayed; live app/dependency metadata can be newer than the source scan. Rerun the scan after source changes. Coverage notes and snapshot identity are saved as DSL comments. Detailed inclusion evidence is available during generation, not persisted as a separate report.

## Validate from a desktop checkout

Use an isolated checkout and an explicitly selected non-production org:

```bash
git clone --branch v5-app-er-model https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git er-modeller-v5
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

A dry run does not install V5. A package build, actual deployment and interactive end-to-end org scan/app-generation acceptance remain separate release steps. `sfdx-project.json` intentionally has no V5 2GP package ID, so a build cannot accidentally publish this source as the existing V4 package.
