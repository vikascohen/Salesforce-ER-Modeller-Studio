# Salesforce ER Modeller Studio — Phase 3 Field Usage Intelligence

> **Phase 3 development branch:** `version-3-field-usage-intelligence`  
> **Understand where Salesforce fields are used from a persisted, asynchronous org snapshot.**

[![Deploy Phase 3 to Salesforce](https://img.shields.io/badge/Deploy%20Phase%203-Salesforce-00A1E0?style=for-the-badge&logo=salesforce&logoColor=white)](https://githubsfdeploy.herokuapp.com/app/githubdeploy/vikascohen/Salesforce-ER-Modeller-Studio?ref=version-3-field-usage-intelligence&continue)

> Phase 3 is isolated from `main`, `version-1-stable` and `version-2-stable`. The deploy button above targets only the Phase 3 branch.

## Phase 3 — Field Usage Intelligence

Phase 3 introduces a Salesforce-native asynchronous field-dependency index. The LWC never performs an expensive live org scan. Scheduled or manually started Batch Apex builds a persisted snapshot and the UI queries that snapshot by object and selected fields.

### Snapshot safety

Each scan owns its own `Field_Usage_Run__c` and `Field_Usage_Evidence__c` records. The last successful snapshot remains authoritative while a new scan is running. A new run is promoted only from the batch finish path. If a scan fails before promotion, the previous snapshot remains available. After successful promotion, the previous snapshot and its child evidence are removed so the dependency table represents the org at the latest successful scan rather than accumulating daily history.

Runs record status, start/completion/heartbeat times, job id, dependency count, error count and bounded error details. Evidence records deliberately contain extensible source/component/evidence/confidence fields so future scanners can add new dependency categories without replacing the persistence model.

### Scheduling without CRON knowledge

On first use, Phase 3 bootstraps two default daily schedules: **03:00** and **21:00** in the scheduling user's Salesforce timezone. Admins can add, edit, enable, disable or remove additional daily scan times in the Field Usage Intelligence component. Apex generates and manages the CRON expressions. There is no two-run limit.

The scheduler calls the same orchestration service as **Run Scan Now**. A persisted run lock prevents a manual or scheduled invocation from starting a second scan while one is already queued or running.

### Resumable governor-safe scan execution

Phase 3 scan discovery now creates durable `Field_Usage_Work_Unit__c` checkpoints. A work unit identifies the run, scanner type and target component/object and records Pending, Running, Completed or Failed state plus attempt count and error details. The worker batch runs with a scope of **one work unit per transaction**, giving each target a fresh asynchronous Apex governor-limit budget.

Completed work units are excluded from subsequent worker queries. Evidence insertion is idempotent within a run by checking the field/source/component/location identity before inserting, so retrying or resuming a target does not intentionally duplicate the same dependency evidence. Snapshot promotion is separated into `FieldUsageSnapshotFinalizer` and occurs only after the worker has exhausted its checkpoint query and no work units failed. Failed/incomplete runs never replace the previous successful current snapshot.

This design is deliberately extensible: Flow, Apex, Trigger, OmniStudio and future scanners should create their own work units rather than loading all metadata into one transaction. A scanner may further split a large component into multiple work units if its payload itself can approach CPU or heap limits.

### Performance and scalability

Phase 3 is designed to avoid doing metadata analysis in interactive LWC requests. Formula scanning tokenises each formula once and resolves tokens through a field-name map instead of running a regular expression once for every candidate field. The formula batch skips objects that have no calculated fields, reducing asynchronous work in large orgs.

Snapshot reads are bounded and driven by `Field_Key__c`, which is an External ID. Exact `Object.Field` searches use that key directly. General search uses bounded prefix filters over compact indexed/searchable evidence columns and deliberately does not perform a synchronous wildcard scan of the long evidence body. Salesforce recommends narrow/selective queries and reducing the number of active records processed for large-data-volume performance.

Both Field Usage Map and Architecture Field Change Impact calculate their graph geometry once when evidence changes and cache the resulting nodes/edges. Zooming and ordinary component rerenders reuse that geometry instead of repeatedly rebuilding the complete dependency graph.

### Error handling and performance

Phase 3 is designed around governor-limit-safe asynchronous processing. Scanner work is divided across Batch Apex transactions. Database writes are collected and executed outside processing loops, evidence inserts use partial DML, individual object/scanner failures are captured without intentionally terminating unrelated work, and the LWC reads only persisted evidence for the selected fields. The field key is an External ID to support selective snapshot queries.

The UI continues to show the last successful results while a refresh is running and gives an explicit running/wait state. A failed refresh does not intentionally clear the current snapshot.

### Scanner coverage and the no-Tooling-API boundary

Phase 3 does **not use the Tooling API**. The first native scanner included on this branch indexes field references in formula fields using Schema Describe and records high-confidence evidence. The scanner/persistence architecture is deliberately source-agnostic so Apex, Trigger, Flow, OmniStudio and other adapters can write to the same evidence model.

There is an important Salesforce platform boundary: Apex class and trigger source bodies are development metadata and are not exposed to ordinary Apex SOQL/Schema Describe. Salesforce documents source-code access through development metadata interfaces such as Tooling API. Because this project explicitly prohibits Tooling API, Phase 3 must not pretend that ordinary Batch Apex can discover Apex/Trigger source references that Salesforce has not exposed to it. A future non-Tooling metadata-source adapter can be added behind the batch layer without changing the LWC or snapshot schema.

### Main Phase 3 components

- `FieldUsageController` — thin LWC-facing controller.
- `FieldUsageOrchestrator` — run locking and batch launch.
- `FieldUsageSnapshotBatch` — asynchronous snapshot construction, error aggregation and promotion.
- `FieldUsageFormulaScanner` — native formula dependency scanner.
- `FieldUsageScheduler` and `FieldUsageScheduleService` — arbitrary daily schedules managed without exposing CRON.
- `Field_Usage_Run__c` — snapshot/run lifecycle and audit record.
- `Field_Usage_Evidence__c` — extensible dependency evidence index.
- `Field_Usage_Schedule__c` — human-readable scan-time configuration.
- `fieldUsageIntelligence` — object/field selection, persisted dependency tree, scan status, Run Now and schedule administration.

### Architecture Intelligence: Field Change Impact

Architecture Intelligence now includes a **Field Change Impact** tile. It combines the objects represented by the current ER model with the latest successful Field Usage snapshot. When a current snapshot exists, users can search for an ER-model object, select it, search all described fields on that object, select a field and render a stable impact map showing **Field → Source Type → Component → Evidence Location** with occurrence totals.

The impact workspace also includes **Search Field Usage**, which searches the persisted evidence index across field/object keys, component names, evidence locations and evidence text. Users can filter by whatever source types exist in the snapshot, including **Formula Field, Flow, Apex, Trigger, OmniStudio** and future adapters. This makes questions such as “where is Account.Status__c used?”, “which formula fields reference this field?” or “show Flow references” searchable without a live metadata scan.

The impact workspace includes horizontal and vertical scrolling, zoom out/reset/in, **Clear**, and **Back to Architecture Intelligence**. Clear resets the object, field, searches, evidence and zoom without deleting persisted scan data.

If no successful current snapshot exists, Architecture Intelligence deliberately hides the selectors and map. It explains that Field Change Impact requires the persisted Field Usage index and offers **Open Batch Console** so the user can run the batch. Once a successful snapshot exists, the instruction state is replaced by the normal impact-analysis screen. A selected field with no persisted references displays a factual “No indexed references found” state rather than treating absence of evidence as proof that the field is unused.

### Integrated map and scan console

Phase 3 is integrated into the existing Diagram Studio rather than presented as a disconnected application. Open **View → Field Usage Map** to enter the full-screen dependency workspace and use **Back to Diagram** to return to the ER canvas. The workspace inherits the Studio theme and provides **Clear Map**, zoom out, zoom reset and zoom in controls plus two-axis scrolling for large dependency maps.

The map uses a deterministic, non-force-directed hierarchy so the same evidence produces stable positions. Its hierarchy is **Object → Field → Source Type → Component → Evidence Location**. Nodes display occurrence totals. For example, an Apex evidence adapter can produce **Account → My_Field__c → Apex → AccountService (4 usages) → evidence locations**; Flow, Trigger, OmniStudio, Formula and future source types use the same graph model.

Open **Diagram → Run Field Usage Scan…** or **Scan Console** from the map for the compact batch activity window. The console is intentionally similar to an installer activity log: it shows persisted timestamped progress, current phase, percentage, objects processed, dependency counts and errors from the actual asynchronous run. It follows scheduled scans as well as manual scans. **Launch Batch Now** is disabled while a run is queued/running. **Clean Console** appears after activity completes and clears only the local console display; it never deletes the authoritative snapshot. Close/Back to Diagram leaves the asynchronous batch running.

### Optional metadata objects and dynamic SOQL

Phase 3 includes the project's existing `GenericDynamicSoqlBuilder` and a `FieldUsageDynamicQueryService`. Optional metadata/configuration objects are checked through `Schema.getGlobalDescribe()` before query construction. Requested fields are filtered against runtime Describe information, and unavailable objects return an empty result instead of causing a static-SOQL deployment/runtime failure. This is intended for source adapters such as OmniStudio where available object models can differ by org and installed product version.

The dynamic query service has tests covering missing optional objects and runtime field filtering. Phase 3 also includes tests for current-snapshot-only reads, occurrence counting, schedule validation/default creation and concurrent scan protection.

### Deployment and first use

Deploy with the Phase 3 button above, add **Field Usage Intelligence** to a Lightning App/Home page or Lightning tab, and open it as an administrator. The first component initialisation creates the two default schedule records and corresponding Salesforce scheduled jobs if they do not already exist. This first-use bootstrap is idempotent because normal Salesforce source deployment does not execute arbitrary Apex automatically.

Use **Run Scan Now** for an immediate snapshot. While it runs, the prior successful snapshot remains queryable. Use the schedule editor to add more daily scans or change the defaults without writing a CRON expression.

### Apex engineering standards

Phase 3 follows Salesforce bulk-processing patterns: no intentional SOQL or DML inside record-processing loops, collection-oriented DML, bounded UI queries, Batch Apex for large asynchronous work, thin controllers, separated orchestration/services/scanners, defensive null/error handling and testable helper logic.

---

## Version 2 foundation

> **Salesforce Data Architecture Intelligence & ER Modelling**  
> **Understand your Salesforce data architecture before you change it.**

Salesforce ER Modeller Studio is an open-source, Salesforce-native workspace for **visualising, modelling and analysing complex Salesforce data architectures**.

As Salesforce orgs grow, the data model often becomes harder to reason about. Custom objects accumulate, relationships multiply, ownership changes, implementations span multiple teams, and important architectural knowledge can end up distributed across diagrams, spreadsheets, documentation and people's heads. A schema change that looks small in isolation may sit inside a much larger network of structural dependencies.

ER Modeller Studio is designed to make that architecture easier to see and investigate. It combines **ER modelling, Salesforce metadata, data dictionaries and architecture intelligence** in one workspace so architects and engineering teams can move from simply drawing a schema to asking useful architectural questions about it.

### What problems does it solve?

**Architecture visibility**  
Import or model Salesforce objects and relationships and turn them into an explorable architecture rather than relying only on static diagrams or tribal knowledge.

**Understanding dependencies**  
See incoming and outgoing relationships, direct neighbours, connected areas of the model, structural paths between objects and explicit references beyond the declared diagram.

**Change investigation**  
Explore the represented blast radius around an object and understand what is structurally connected before making schema changes. The Studio presents evidence rather than pretending that structural reach automatically means something will break.

**Complex-org discovery**  
Use topology, connectivity, depth, density, isolation, bounded cycle detection and highly connected object analysis to identify areas that deserve architectural attention.

**Data model design**  
Create and modify ER models visually or through the Studio DSL with live rendering, relationship linting, Salesforce-aware field types and point-and-click custom-object modelling.

**Documentation and knowledge sharing**  
Generate a Data Dictionary, inspect object and field metadata, and export architecture artefacts so knowledge is easier to share across architecture, engineering, administration and delivery teams.

**Salesforce-aware analysis**  
Complement the model with org-aware capabilities including schema import, sharing-model views, record-count heatmaps and metadata inspection.

### Who is it for?

The Studio is designed for **Enterprise Architects, Solution Architects, Salesforce Architects, Developers, Technical Leads, Administrators, Platform Teams and Consulting/Delivery Teams** working with Salesforce environments where understanding the data architecture matters.

It can be particularly useful during **solution discovery, architecture reviews, legacy-org assessment, schema redesign, technical due diligence, change planning, documentation and engineering handover**.

### More than an ER diagrammer

Traditional ER diagrams are useful for showing entities and relationships. ER Modeller Studio extends that idea into an **interactive Salesforce architecture workspace**.

Version 2 combines the modelling foundation with Data Architecture Intelligence, including:

- Architecture Overview and graph-based topology analysis
- Object Map and structural change-impact / blast-radius evidence
- Relationship Path Finder
- Object Usage & Change Readiness
- Relationship Insights and dependency summaries
- Junction Intelligence
- Salesforce schema import and metadata-aware modelling
- Data Dictionary and field-usage analysis
- Sharing-model and org-aware views
- Record-count heatmaps
- Visual and DSL-based modelling
- PNG, Mermaid and draw.io / diagrams.net export

The goal is simple: **help teams understand the structure they have, investigate the consequences of what they intend to change, and make architecture conversations more evidence-based.**

> **Evidence boundary:** Architecture Intelligence analyses relationships and information represented by the current model and the Salesforce information available to the Studio. It does not claim that an ER model alone can discover every Apex, Flow, integration, report, security configuration or runtime dependency.

## Deploy Version 2 Stable to Salesforce

[![Deploy to Salesforce](https://img.shields.io/badge/Deploy%20to-Salesforce-00A1E0?style=for-the-badge&logo=salesforce&logoColor=white)](https://githubsfdeploy.herokuapp.com/app/githubdeploy/vikascohen/Salesforce-ER-Modeller-Studio?ref=version-2-stable&continue)

Deploy **Version 2 Stable** directly to a Salesforce org using the button above.

> **Note:** This deploy button points specifically to the `version-2-stable` branch. For Version 1, use the `version-1-stable` branch.

## Installing

All package links below are **unmanaged Salesforce packages**. Once installed, the components are available in the target org as editable metadata.

### Latest Release — Version 2

**Version 2 Stable** includes the complete Version 1 modelling foundation plus Version 2 Data Architecture Intelligence.

- **Production or Developer Edition:** [Install Version 2 unmanaged package](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000hugT)
- **Sandbox:** [Install Version 2 unmanaged package](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000hugT)

### Previous Release — Version 1

Version 1 remains available for users who specifically need the previous stable release.

- **Production or Developer Edition:** [Install Version 1 unmanaged package](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000gRTd)
- **Sandbox:** [Install Version 1 unmanaged package](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000gRTd)

For both releases, the package is the same for Production/Developer Edition and Sandbox; only the Salesforce login domain changes. **Admins Only** is the safest default installation option, after which access can be assigned deliberately through the provided permission set.

## Contents

- [Installing](#installing)
- [Version 1 release notes](docs/RELEASE-NOTES-V1.md)
- [Version 2 release notes](docs/RELEASE-NOTES-V2.md)
- [Data Architecture Intelligence](#data-architecture-intelligence)
- [Product capabilities](#product-capabilities)
  - [Version 1 vs Version 2](#version-1-vs-version-2)
- [What it does](#what-it-does)
  - [Modeling the diagram](#modeling-the-diagram)
  - [Org-aware views](#org-aware-views)
  - [Data Dictionary](#data-dictionary)
  - [Export](#export)
  - [Workspace & appearance](#workspace--appearance)
- [Components](#components)
- [Architecture](#architecture)
  - [How the DSL parser works internally](docs/dsl-compiler-architecture.md)
- [Deploying to an org](#deploying-to-an-org)
- [Setting it up in the org](#setting-it-up-in-the-org)
- [Quick start](#quick-start)
- [Testing](#testing)
- [Security overview](docs/SECURITY.md)
- [Contributors](#contributors)
- [License](#license)
- [Contributing](#contributing)

## Product capabilities

### Version 1 vs Version 2

**Version 1 Stable** is the original modelling foundation. It includes the visual ER modelling experience, DSL/compiler workflow, Salesforce schema visualisation, diagram editing, Import from Org, Data Dictionary capabilities, export options, themes and the supporting Salesforce components used by the Studio.

**Version 2 Stable** is the current complete release. It includes everything in Version 1 and adds the **Data Architecture Intelligence** layer: Architecture Overview, Object Map & Impact, Relationship Path Finder, Object Usage & Change Readiness, Relationship Insights, explicit external-reference detection, junction intelligence, shared graph analysis, Clear / Refresh and active-file visibility.

You do **not** need to install Version 1 before Version 2. Version 1 remains available as a preserved stable release for users who specifically need the earlier modelling-only release.

For detailed release history, see [Version 1 release notes](docs/RELEASE-NOTES-V1.md) and [Version 2 release notes](docs/RELEASE-NOTES-V2.md).

### Modelling and DSL
- Live text-to-visual ER modelling with the Studio DSL and shared parser/compiler.
- Lookup, Master Detail, polymorphic and self relationships, including multiple relationships between the same objects.
- Mimic New ER for point-and-click creation of custom-object models. Mimic owns the Salesforce custom suffix, automatically generates `__c`, normalises accidental `_c` / `_C` / `__...` suffix input, and starts with a clean draft each time.
- Import from Org, object palette drag-and-drop, relationship linting, schema comparison and context-aware DSL autocomplete.
- Freeform canvas, object resizing, collapsing, focus mode, zoom and automatic layout.
- Multi-file workspace with save, rename, duplicate and delete flows.

### Salesforce-aware architecture workspace
- Data Dictionary with object and field metadata, sorting, usage calculation and CSV/XLSX export.
- Sharing View for internal and external object sharing-model values.
- Record-count heatmap for represented objects.
- Object summary hover cards combining available structural and org-aware evidence.

### Data Architecture Intelligence
- Architecture Overview with topology, connected-component, density, depth, isolation, connectivity and bounded cycle evidence.
- Object Map & Impact with incoming/outgoing dependencies, neighbours, bounded reach and change-impact/blast-radius evidence.
- Relationship Path Finder for minimum-hop structural routes between two objects.
- Object Usage & Change Readiness for custom objects, including represented dependencies and explicit references outside the declared diagram.
- Relationship Insights with a layered dependency graph, relationship detail and per-object dependency summaries. Self relationships are intentionally omitted from this interpretation view.
- Junction Intelligence for custom objects with multiple parent relationships and stronger Master Detail junction patterns.
- Clear / Refresh analysis and active-file visibility so architecture evidence is rebuilt from the current ER source.

### Export, viewing and appearance
- PNG export, Mermaid ER syntax and draw.io / diagrams.net export.
- Read-only `diagramViewer` for publishing saved diagrams on Salesforce pages.
- Dark+, Light+, Monokai and Solarized Light themes, including theme-aware Mimic New ER.
- Per-user theme persistence.

### Reliability and engineering
- Shared graph-analysis engine rather than duplicate parsers for individual Architecture Intelligence screens.
- Analysis caching, breadth-first traversal, bounded expensive operations, malformed-model safeguards, stale-response protection and lifecycle cleanup.
- Automated GitHub Actions Jest CI for the Version 2 release line and `main`.
- **112 Jest tests across 5 suites are currently passing on `main`.**
- Version 2 makes no claim that diagram evidence proves unrepresented Apex, Flow, report, integration, security or live-record dependencies.


## Data Architecture Intelligence

The architecture layer builds on the original modelling engine and analyses the ER model currently open on the canvas. It does not generate an opaque architecture score or pretend that a diagram contains runtime facts it cannot know. Instead, it turns relationships already represented in the model into readable structural evidence.

Open **View → Architecture Intelligence** to analyse the current file. The header identifies the file being analysed, and **Clear / Refresh** resets Architecture Intelligence and rebuilds the analysis from the current ER source.

### Architecture Overview

Architecture Overview answers: **what does this model look like structurally?**

It combines object, field and relationship totals with graph evidence such as connected components, depth, relationship density, highly connected objects, isolated objects and bounded cycle detection. The purpose is to help an architect decide where to investigate first rather than repeat counts already visible on the canvas.

Analysis is cached for unchanged DSL and expensive graph operations are deliberately bounded for interactive use.

### Object Map & Impact

Object Map is the one-object architecture view. Select an object to understand its immediate architectural context without creating a second copy of the full ER canvas.

For the selected object it shows structural role, relationship degree, incoming and outgoing relationships, parent or target objects, child or dependant objects, direct neighbours, bounded one, two and three hop reach, cycles involving the object, and **Change Impact / Blast Radius** evidence.

Blast Radius is deliberately part of Object Map rather than a competing top-level feature. Reachability means an object is structurally connected within the model; it does **not** claim that every reachable object will break when a change is made.

### Relationship Path Finder

Relationship Path Finder answers: **how are two objects connected?**

Choose a source and target object and Phase 2 calculates a minimum-hop structural route between them. It is an A-to-B navigation tool, not an impact assessment.

### Object Usage & Change Readiness

Object Usage & Change Readiness answers: **what does this model tell me about changing a custom object?**

The selector deliberately contains **custom objects only**. Standard Salesforce objects can still appear as dependencies because they are part of the architecture, but Phase 2 does not present standard objects as removal candidates.

The assessment uses only evidence represented by the current ER model, including incoming and outgoing dependencies and explicit references to objects outside the set of entities declared in the DSL. For example, a custom object may reference Account even when Account was not explicitly declared as an entity in the current file; Phase 2 surfaces that as a known external diagram reference.

This feature deliberately does **not** use the Tooling API and does not invent live-org facts. It does not claim to know record counts, last usage, Apex references, Flow references, reports, integrations or dependencies absent from the ER source. An isolated custom object is therefore **not** automatically described as unused or safe to remove.

### Relationship Insights

Relationship Insights keeps the relationship diagram but makes it an interpretation view rather than another full ER canvas.

The diagram omits **self relationships** because they do not represent a dependency between two different objects and add visual noise in this view. It uses a layered dependency layout instead of the previous degree-sorted square grid, positions objects in structural bands to reduce connector crossing, uses vertical anchors between layers and side anchors for same-row relationships, and does not print Lookup, Master Detail or Polymorphic on every connector because the relationship legend already communicates those semantics.

Below the diagram, **Relationship Detail** explains represented child-to-parent dependencies and their relationship types. **Object Dependency Summary** presents, per declared object, what it depends on and what depends on it.

Record and schema impact wording is deliberately conservative. Master Detail can carry strong lifecycle semantics, while a Lookup shown in the ER model does not by itself prove cascade behaviour, automation behaviour or runtime data impact. Polymorphic relationships are treated as dependencies that may target more than one represented type.

### Junction Intelligence

Phase 2 identifies custom objects with multiple parent relationships and distinguishes stronger junction patterns where two or more different parents are connected through Master Detail relationships. This is structural evidence, not a claim about business intent. Standard Salesforce relationships are treated as platform context rather than redesign suggestions.

### Evidence boundaries

Architecture Intelligence analyses the **current ER model**. It can state what objects and relationships are represented, what is connected, what is isolated, what paths exist, what is reachable within bounded hops and which explicitly referenced targets sit outside the declared diagram. It cannot infer unrepresented Apex, Flow, reporting, integration, security or live-record behaviour.

Phase 2 therefore follows a simple principle: **show what the model proves, identify what remains unknown, and avoid synthetic certainty.**

### Architecture at a glance

~~~mermaid
flowchart LR
    DSL["Current ER source"] --> PARSER["Phase 1 DSL parser"]
    PARSER --> GRAPH["Architecture graph"]
    GRAPH --> OVERVIEW["Architecture Overview"]
    GRAPH --> MAP["Object Map & Impact"]
    GRAPH --> PATH["Relationship Path Finder"]
    GRAPH --> USAGE["Object Usage & Change Readiness"]
    GRAPH --> REL["Relationship Insights"]
    GRAPH --> JUNCTION["Junction Intelligence"]
~~~

### Reliability and performance hardening

Phase 2 also protects the existing Studio experience. It includes stale-response protection for rapid file changes and asynchronous org-aware views, lifecycle cleanup for delayed work, architecture-analysis caching, breadth-first graph traversal, bounded cycle analysis, defensive malformed-model handling, graceful treatment of incomplete relationship endpoints and recoverable Architecture Intelligence errors.

The Architecture Intelligence engine is shared rather than implementing separate parsers for each screen. This keeps Object Map, Path Finder, usage analysis, relationship analysis and overview metrics grounded in the same parsed model.

### Scope

Phase 2 is intentionally about **Salesforce data architecture intelligence**: objects, fields, relationships, topology, reachability, dependency evidence and change-readiness evidence.


### Testing

**LWC / Jest CI**

Version 2 currently has **112 Jest tests across 5 suites**, covering the shared ER/diagram logic, export utilities, viewer, Studio workflows and Architecture Intelligence. The suite includes regression coverage for graph metrics, malformed/incomplete models, path finding, blast radius, junction detection, custom-only Object Usage, explicit external references, Relationship Insights self-relationship filtering, Clear / Refresh, Mimic draft reset and custom `__c` suffix normalisation.

The GitHub Actions workflow runs the Version 2 Jest suite on the Version 2 release line and on `main`. The latest release promotion to `main` completed successfully with **112/112 tests passing**.

**Apex**

The existing Apex production and test classes remain the original Salesforce foundation; the Data Architecture Intelligence work did not change those Apex classes. `DiagramFileControllerTest`, `SchemaMetadataControllerTest` and `DiagramPreferenceControllerTest` cover their Salesforce-side paths. Apex tests must be run in a Salesforce org and are not included in the Jest pass count above.

## Contributors

Developed and maintained by **Crius Consulting Architects**.

**Lead Architect & Author:** Vikas Cohen

## License

MIT — see [LICENSE](LICENSE). Free to use, modify, and distribute; just
keep the copyright notice. Bundles one third-party library (SheetJS,
Apache-2.0) — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the project is laid out
and what to check before opening a PR.
