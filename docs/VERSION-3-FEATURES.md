# ER Modeller Studio — Version 3 Features

**Author: Vikas Cohen**

Version 3 extends ER Modeller Studio from schema visualisation and structural architecture analysis into **field-level dependency intelligence, change-impact analysis, operational scanning, diagnostics and richer object intelligence**. This document is the Version 3 feature catalogue. It deliberately links to specialist architecture documents rather than repeating their implementation detail.

## Product philosophy

Version 3 follows four principles:

1. **Evidence before opinion.** The Studio reports what it can observe and distinguishes evidence from recommendations.
2. **Understand before change.** Field and object change decisions should begin with schema, dependency and architecture context.
3. **Sparse, current intelligence.** Field Usage persists detected dependency evidence for the current successful snapshot instead of manufacturing rows for unused fields.
4. **Modular growth.** Scanners, analysis modules, UI workspaces and export utilities are separated so capabilities can evolve without turning the Studio into a single monolith.

## Version 3 capabilities

### Field Usage Intelligence

- Background Field Usage scans using Batch Apex.
- Manual **Run now** execution and configurable scheduled scans.
- Current-successful-snapshot model so users do not consume a half-completed scan as current evidence.
- Durable work units and retry-oriented processing for large orgs.
- Persisted dependency evidence in `Field_Usage_Evidence__c` linked to a scan run.
- Live scan activity/status and progress information.
- Scanner coverage for supported Salesforce artefacts, including formula fields, Apex classes, Apex triggers, active Flows, Lightning Web Components, Aura and supported metadata-oriented scanners such as validation/layout evidence where implemented by the current scanner pipeline.
- Tooling API integration through authenticated Salesforce credentials rather than embedded secrets.
- Field Usage Map with object and field selection, evidence grouping and component-level drill-down.
- Field Change Impact for investigating dependencies before changing a field.
- Explicit zero-evidence behaviour: no detected dependency is presented as scanner evidence, not as universal proof that a field is unused.
- Field Usage map export support.

For the detailed batch pipeline, persistence model, scanner boundaries and failure semantics, see [FIELD_USAGE_ARCHITECTURE.md](FIELD_USAGE_ARCHITECTURE.md).

### Object Architecture Health and Object Intelligence

- Per-object architecture health view.
- Standard/custom field counts and relationship/derived-field context.
- Review signals such as potential custom-to-standard field overlap where the evidence supports a review.
- Required custom-field visibility.
- Dependency and metadata evidence for Apex triggers, validation rules, Flows, record types and page layouts.
- On-demand metadata loading with Studio-session caching to avoid unnecessary repeated Tooling API traffic.
- Evidence-based wording: counts such as record types or layouts are not automatically labelled as architecture defects.

### Data Dictionary improvements

- Object and field metadata browsing.
- Field search/filtering.
- Field detail/intelligence view.
- Standard versus custom field visibility.
- Description/documentation context.
- Per-object populated-field usage calculation where supported.
- Bulk Data Dictionary export to Excel.
- Separation between **record population percentage** and **dependency usage** so the two concepts are not confused.

### Architecture Intelligence

Version 3 retains and refines the architecture-analysis capabilities introduced previously:

- Architecture Overview.
- Structural metrics and topology.
- Hotspot and isolated-object analysis.
- Connected components and bounded-cycle analysis.
- Relationship Path Finder.
- Object Map & Impact / structural neighbourhood analysis.
- Architecture recommendations framed as review signals rather than automatic design verdicts.
- Field Change Impact backed by Field Usage evidence.
- Architecture exports and focused visual views.
- Object Architecture Health integration.

The detailed Architecture Intelligence implementation/refactor notes remain in [architecture-intelligence-refactor.md](architecture-intelligence-refactor.md). Version 2 history remains in [PHASE-2-DATA-ARCHITECTURE-INTELLIGENCE.md](PHASE-2-DATA-ARCHITECTURE-INTELLIGENCE.md) and [RELEASE-NOTES-V2.md](RELEASE-NOTES-V2.md); those files are not duplicated here.

### ER modelling and schema exploration retained from earlier versions

- Visual ER canvas with draggable objects.
- Salesforce object import/describe.
- Automatic Lookup, Master Detail and Polymorphic relationship modelling.
- Bidirectional visual model ↔ DSL workflow.
- DSL IntelliSense/editor assistance.
- Saved diagrams and multi-tab workflow.
- Mimic New ER for modelling proposed custom schemas without deploying metadata.
- Compare with Org / schema drift analysis.
- Sharing View.
- Record-count Heatmap.
- Fit Model, zoom and canvas navigation.
- PNG, Mermaid and Draw.io-oriented export capabilities where exposed by the Studio.

The DSL language itself is documented in [DSL.md](DSL.md), and its compiler architecture is documented separately in [dsl-compiler-architecture.md](dsl-compiler-architecture.md).

### Settings, operations and diagnostics

- Field Usage schedule management.
- Running-task monitoring.
- Theme preferences persisted by the Studio.
- System information and diagnostics.
- Tooling API credential/configuration diagnostics.
- In-product Help with Configuration and User Manual sections.
- Permission-set based access to the Studio metadata and supporting objects.

### Help and configuration

The in-product Help is the user-facing source for day-to-day operation. It covers initial modelling, files, DSL, schema drift, Data Dictionary, Field Usage, Architecture Intelligence, settings, diagnostics, exports and Tooling API configuration. Configuration is intentionally kept in the Help UI rather than duplicated into this feature catalogue.

## What Version 3 does not claim

ER Modeller Studio is an architecture and dependency-intelligence tool. Its findings are evidence for human review. A missing dependency means the implemented scanners did not detect evidence in the successful snapshot; it does not prove that no dependency exists anywhere in Salesforce or an external system. Likewise, a hotspot, cycle, overlap candidate, high record-type count or other structural signal is not automatically a defect.

## Related documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — whole-product architecture, modularity and end-to-end data flow.
- [FIELD_USAGE_ARCHITECTURE.md](FIELD_USAGE_ARCHITECTURE.md) — Field Usage implementation architecture.
- [dsl-compiler-architecture.md](dsl-compiler-architecture.md) — DSL compiler architecture.
- [DSL.md](DSL.md) — DSL language reference.
- [SECURITY.md](SECURITY.md) — security model and configuration considerations.
- [architecture-intelligence-refactor.md](architecture-intelligence-refactor.md) — Architecture Intelligence refactor design.
- [RELEASE-NOTES-V2.md](RELEASE-NOTES-V2.md) — Version 2 release history.
