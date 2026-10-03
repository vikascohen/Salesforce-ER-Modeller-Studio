# ER Modeller Studio — Version 3 Beta Release Notes

**Author: Vikas Cohen**

Version 3 Beta extends ER Modeller Studio from visual schema modelling and structural architecture analysis into **field-level dependency intelligence, operational scanning, richer object intelligence and evidence-backed change analysis**.

## Major additions in Version 3

### Field Usage Intelligence

- Asynchronous Field Usage scanning using Batch Apex.
- Manual Run Now and configurable scheduled scans.
- Durable scan runs and work units for large-org processing.
- Current-successful-snapshot semantics: an incomplete or failed replacement scan does not displace the last trusted snapshot.
- Normalised dependency evidence persisted in `Field_Usage_Evidence__c`.
- Evidence scanning across supported Apex Classes, Apex Triggers, active Flows, LWC, Aura, Formula Fields and Validation Rules.
- Authenticated Tooling API integration through Salesforce Named Credential / External Credential configuration.
- Field Usage Map with object/field selection, source grouping and component-level evidence drill-down.
- Lazy/paginated evidence detail so the initial map does not hydrate an entire org-wide snapshot.
- Field Change Impact based on persisted dependency evidence.
- Explicit zero-evidence semantics: no detected dependency is not presented as universal proof that a field is unused.
- Canonical Salesforce API field identity so evidence remains consistent across standard, custom, namespaced and non-namespaced fields.

### Object Intelligence

- Per-object architecture/metadata intelligence.
- Standard/custom field and relationship context.
- Required custom-field visibility.
- Potential custom-to-standard overlap candidates presented as review signals rather than automatic defects.
- Trigger, validation rule, Flow, record type and page-layout context where available.
- On-demand metadata loading and Studio-session caching.
- Evidence-based wording: metadata counts are not automatically labelled architecture problems.

### Data Dictionary

- Improved object and field browsing/search/filtering.
- Field detail/intelligence experience.
- Standard/custom visibility and description context.
- Record-population analysis kept distinct from dependency usage.
- Bulk Data Dictionary export to Excel.
- Expanded Object Intelligence from the selected object.

### Architecture Intelligence

Version 3 retains and refines Architecture Intelligence capabilities including:

- Architecture Overview.
- Structural metrics and topology.
- Hotspots and isolated objects.
- Connected components and bounded-cycle analysis.
- Relationship Path Finder.
- Object Map & Impact / structural neighbourhood analysis.
- Architecture findings and recommendations framed as human review signals.
- Field-level change exploration backed by Field Usage evidence.
- Architecture exports and focused visual views.

### Existing modelling capabilities retained

- Visual ER canvas and draggable objects.
- Salesforce schema import/Describe.
- Lookup, Master Detail and Polymorphic relationship modelling.
- Bidirectional visual model ↔ DSL workflow.
- DSL editor assistance / IntelliSense.
- Saved diagrams and multi-tab workflow.
- Mimic New ER for proposed custom modelling.
- Compare with Org / schema drift.
- Sharing View and record-count Heatmap.
- Fit Model, zoom and canvas navigation.
- PNG, Mermaid and draw.io-oriented exports where exposed by the Studio.

### Settings, diagnostics and help

- Field Usage schedule management.
- Running-task monitoring.
- Theme preferences.
- System information and diagnostics.
- Tooling API configuration diagnostics.
- In-product Help with Configuration and User Manual areas.
- Permission-set based access to supporting metadata/objects.

## Deployment requirement

Version 3 Field Usage and selected metadata-intelligence capabilities require the Salesforce Named Credential `Salesforce_Tooling_API` and the corresponding External Credential / principal configuration. Follow **Help → Configuration** after installation.

## Beta testing focus

The `v3-beta-testing` branch is intended for clean-org and upgrade-path beta validation before Version 3 is promoted to the main release line. Beta testing should include:

- installation into an org without a package namespace;
- Tooling API Named Credential setup;
- permission-set/principal validation;
- full Field Usage scan and snapshot promotion;
- Apex/Trigger/Flow/LWC/Aura/Formula/Validation evidence checks;
- schedule lifecycle;
- Data Dictionary and Object Intelligence checks;
- Architecture Intelligence regression checks;
- Salesforce CLI validation and full Jest suite.

## Important interpretation limits

ER Modeller Studio is architecture and dependency-intelligence software. Findings are evidence for human review. A missing dependency means the implemented scanners did not detect evidence in the current successful snapshot; it does not prove that no dependency exists anywhere in Salesforce or an external system. A hotspot, cycle, overlap candidate, record-type count or layout count is likewise not automatically a defect.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — authoritative whole-product technical architecture, including Field Usage and ER DSL compiler architecture.
- [DSL.md](DSL.md) — DSL syntax and language reference.
- [SECURITY.md](SECURITY.md) — security model and Tooling API trust boundary.
- In-product **Help** — user operation and configuration.

Version 2 history remains in [RELEASE-NOTES-V2.md](RELEASE-NOTES-V2.md) and [PHASE-2-DATA-ARCHITECTURE-INTELLIGENCE.md](PHASE-2-DATA-ARCHITECTURE-INTELLIGENCE.md).
