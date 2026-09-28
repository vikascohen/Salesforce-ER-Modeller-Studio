# Salesforce ER Modeller Studio — Version 2 Stable

## What is Salesforce ER Modeller Studio?

Salesforce ER Modeller Studio is a **Salesforce-native data modelling and architecture intelligence workspace** built for architects, developers and teams that need to understand, design and reason about complex Salesforce data models.

Enterprise Salesforce orgs rarely stay simple. Over time they accumulate standard and custom objects, relationships, integrations, inherited design decisions and dependencies that can make architecture difficult to understand and risky to change. Traditional ER diagrams can show structure, but they do not always help answer the questions architects face when assessing an existing org or planning a change.

ER Modeller Studio brings **modelling, Salesforce metadata and architecture analysis into one workspace**. Teams can create models visually or through the Studio DSL, import Salesforce schema information, inspect objects and fields, explore relationships, analyse topology and dependencies, trace paths between objects, investigate potential change impact and maintain architecture artefacts without leaving the Salesforce ecosystem.

### Problems it helps solve

- **Understanding complex data models:** turn Salesforce object and relationship structures into navigable architecture views rather than relying on disconnected spreadsheets, screenshots or tribal knowledge.
- **Architecture discovery:** explore how objects are connected, identify highly connected or isolated areas of a model, inspect relationship paths and understand structural dependencies.
- **Change analysis:** investigate the represented blast radius around an object before making schema changes, while clearly distinguishing model evidence from dependencies the diagram cannot prove.
- **Design and modelling:** create ER models using a visual workspace or a lightweight DSL with live rendering, relationship linting and Salesforce-aware modelling capabilities.
- **Documentation:** generate a Data Dictionary and export architecture information to formats that can be shared outside the Studio.
- **Architecture conversations:** give architects, developers and delivery teams a common visual and evidence-based representation of the Salesforce data architecture.

### Who can benefit?

**Enterprise and Solution Architects** can use the Studio for architecture discovery, data-model reviews, dependency analysis and change planning.

**Salesforce Developers and Technical Leads** can investigate unfamiliar schemas, understand object relationships and reason about the structural context surrounding a proposed implementation.

**Administrators and Platform Teams** can inspect metadata, maintain data dictionaries and obtain a clearer view of how an org's data model has evolved.

**Consulting and Delivery Teams** can use it during discovery, solution design, technical assessment and handover to create a shared understanding of an organisation's Salesforce data architecture.

**Large Salesforce programmes** can use the architecture intelligence capabilities to complement existing governance and design practices, particularly where years of customisation have made the underlying data model difficult to reason about.

> **Evidence boundary:** Architecture Intelligence analyses the model and Salesforce information available to the Studio. It does not claim that an ER diagram alone can prove every Apex, Flow, integration, reporting, security or runtime dependency.

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
- [Version 2 combined feature set](#version-2-combined-feature-set)
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
- [Author](#author)
- [License](#license)
- [Contributing](#contributing)

## Version 2 combined feature set

**Version 2 Stable is the complete product.** It contains the full Version 1 feature set plus the Version 2 architecture-intelligence capabilities. Users deploying Version 2 do not need Version 1 separately.

### Modelling and DSL
- Live text-to-visual ER modelling with the Studio DSL and shared parser/compiler.
- Lookup, Master Detail, polymorphic and self relationships, including multiple relationships between the same objects.
- Mimic New ER for point-and-click creation of custom-object models. Mimic owns the Salesforce custom suffix, automatically generates `__c`, normalises accidental `_c` / `_C` / `__...` suffix input, and starts with a clean draft each time.
- Import from Org, object palette drag-and-drop, relationship linting, schema comparison and context-aware DSL autocomplete.
- Freeform canvas, object resizing, collapsing, focus mode, zoom and automatic layout.
- Multi-file workspace with save, rename, duplicate and delete flows.

### Salesforce-aware architecture workspace
- Data Dictionary with object and field metadata, sorting, usage calculation and CSV/XLSX export.
- Sharing View for internal and external sharing models.
- Sharing Rules / Apex Sharing evidence through runtime share-table evidence without requiring the Tooling API.
- Heatmap for represented object record activity and freshness.
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

For release-specific history, see [Version 1 release notes](docs/RELEASE-NOTES-V1.md) and [Version 2 release notes](docs/RELEASE-NOTES-V2.md).

## Version 2 — Data Architecture Intelligence

Phase 2 keeps the Phase 1 modelling engine intact and adds an architect-facing analysis layer over the ER model currently open on the canvas. It does not generate an opaque architecture score or pretend that a diagram contains runtime facts it cannot know. Instead, it turns relationships already represented in the model into readable structural evidence.

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

### Version 2 architecture at a glance

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

The existing Apex production and test classes remain the Version 1 Salesforce foundation; Phase 2 / Version 2 did not change those Apex classes. `DiagramFileControllerTest`, `SchemaMetadataControllerTest` and `DiagramPreferenceControllerTest` cover their Salesforce-side paths. Apex tests must be run in a Salesforce org and are not included in the Jest pass count above.

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
