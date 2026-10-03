# ER Modeller Studio — Version 3 Beta Release Notes

**Author: Vikas Cohen**

Version 3 Beta is the next evolution of Salesforce ER Modeller Studio. **Version 3 includes the functionality carried forward from Version 1 and Version 2, then adds Field Usage Intelligence, field-level change impact, richer Object Intelligence, operational scanning, diagnostics and further Architecture Intelligence integration.**

This document is the single release note for Version 3. It describes what is retained, what is new, what must be configured, and what should be validated during beta testing.

## 1. Version lineage

Version 3 is evolutionary rather than a replacement of the earlier modelling product.

```text
Version 1
Visual ER modelling + DSL + Data Dictionary + schema exploration
        |
        v
Version 2
Version 1 capabilities + Data Architecture / Architecture Intelligence
        |
        v
Version 3
Version 1 + Version 2 capabilities + Field Usage Intelligence +
Field Change Impact + richer Object Intelligence + scanning operations
```

The stable historical branches remain unchanged:

- [Version 1 stable branch](../tree/version-1-stable)
- [Version 2 stable branch](../tree/version-2-stable)
- [Version 3 beta branch](../tree/v3-beta-testing)

Version 2 release history remains available in [RELEASE-NOTES-V2.md](RELEASE-NOTES-V2.md). Version 1 and Version 2 stable branches are not modified by Version 3 beta development.

## 2. Functionality carried forward from Version 1

Version 3 retains the core modelling and schema-exploration experience established in Version 1, including:

- Visual ER canvas with draggable Salesforce objects.
- Salesforce schema import and Describe-based exploration.
- Lookup, Master Detail and Polymorphic relationship modelling.
- Bidirectional visual model and ER DSL workflow.
- DSL editor assistance / IntelliSense.
- Saved diagrams and multi-tab workflow.
- Data Dictionary and object/field metadata exploration.
- Schema drift / Compare with Org capabilities.
- Sharing View.
- Record-count Heatmap.
- Fit Model, zoom and canvas navigation.
- PNG, Mermaid and draw.io-oriented exports where exposed by the Studio.

The ER DSL language reference remains in [DSL.md](DSL.md).

## 3. Functionality carried forward from Version 2

Version 3 retains the Architecture Intelligence capabilities introduced and developed in Version 2, including:

- Architecture Overview.
- Structural architecture metrics and topology.
- Hotspot analysis.
- Isolated-object analysis.
- Connected-component analysis.
- Bounded-cycle analysis.
- Relationship Path Finder.
- Object Map & Impact / structural neighbourhood analysis.
- Architecture findings and recommendations for human review.
- Architecture-oriented exports and focused visual views.
- Mimic New ER for modelling proposed custom schemas.

Version 3 refines these capabilities and integrates them with newer field-level evidence where appropriate. Historical Version 2 detail remains in [RELEASE-NOTES-V2.md](RELEASE-NOTES-V2.md) and [PHASE-2-DATA-ARCHITECTURE-INTELLIGENCE.md](PHASE-2-DATA-ARCHITECTURE-INTELLIGENCE.md).

## 4. New in Version 3 — Field Usage Intelligence

Version 3 adds a new field-level dependency intelligence subsystem.

### 4.1 Background scanning

- Asynchronous Field Usage scanning using Batch Apex.
- Manual **Run Now** execution.
- Configurable scheduled scans.
- Durable scan runs and work units for large-org processing.
- Current-successful-snapshot semantics: a partial or failed replacement scan does not displace the last trusted successful snapshot.

### 4.2 Dependency evidence

- Normalised dependency evidence persisted in `Field_Usage_Evidence__c`.
- Supported evidence scanning across Apex Classes, Apex Triggers, active Flows, Lightning Web Components, Aura, Formula Fields and Validation Rules.
- Canonical Salesforce API field identity so field evidence remains consistent for standard, custom, namespaced and non-namespaced metadata.
- Explicit zero-evidence semantics: no detected dependency means the supported scanners found no evidence in the current successful snapshot; it is not presented as proof that a field is universally unused.

### 4.3 Field Usage Map

- Object and field selection.
- Evidence grouped by source type.
- Component-level evidence drill-down.
- Compact initial summary retrieval.
- Lazy and paginated evidence detail rather than loading an entire org-wide evidence set at once.
- Snapshot-scoped client behaviour so refreshed scan results do not silently mix with previous evidence.
- Field Usage map export support where exposed by the Studio.

### 4.4 Field Change Impact

Field Change Impact uses the current successful Field Usage snapshot to show what supported Salesforce artefacts may depend on a selected field before that field is changed. This complements structural Object Map & Impact from Architecture Intelligence; the two are intentionally not treated as the same type of evidence.

## 5. New and refined in Version 3 — Object Intelligence

Version 3 expands selected-object analysis with:

- Per-object architecture and metadata intelligence.
- Standard/custom field and relationship context.
- Required custom-field visibility.
- Potential custom-to-standard overlap candidates for architectural review.
- Apex Trigger context.
- Validation Rule context.
- Flow context.
- Record Type context.
- Page Layout context.
- On-demand metadata loading and Studio-session caching where applicable.
- Evidence-based wording: metadata counts are not automatically labelled as architecture defects.

## 6. Data Dictionary improvements in Version 3

Version 3 retains the Data Dictionary and adds/refines:

- Improved object and field browsing, search and filtering.
- Field detail/intelligence experience.
- Clear standard/custom field visibility.
- Description/documentation context.
- Record-population analysis kept separate from dependency usage.
- Bulk Data Dictionary export to Excel.
- Direct access to richer selected-object intelligence.

## 7. Settings, operations and diagnostics

Version 3 adds or expands operational support for Field Usage:

- Field Usage schedule management.
- Running-task monitoring.
- Scan status and operational visibility.
- Theme preferences.
- System information and diagnostics.
- Tooling API configuration diagnostics.
- Permission-set based access to supporting metadata and objects.
- In-product Help with Configuration and User Manual sections.

## 8. Tooling API and deployment requirement

Version 3 Field Usage and selected metadata-intelligence capabilities use authenticated Salesforce Tooling API access.

After installation:

1. Configure the Salesforce Named Credential `Salesforce_Tooling_API`.
2. Configure the corresponding External Credential and principal.
3. Grant the required principal/permission access.
4. Use **Help → Configuration** for the current setup instructions.
5. Run the Studio diagnostics to verify configuration.
6. Run a Field Usage scan and confirm a successful snapshot is promoted.

Credentials are not embedded in the application source.

## 9. Version 3 beta validation checklist

The `v3-beta-testing` branch is intended for clean-org and upgrade-path validation before Version 3 is promoted to the main release line.

Recommended beta sequence:

1. Install Version 3 Beta into a clean Salesforce org.
2. Confirm the core Version 1 modelling experience opens and functions.
3. Confirm the retained Version 2 Architecture Intelligence experience functions.
4. Configure `Salesforce_Tooling_API` and its External Credential/principal.
5. Run diagnostics and verify Tooling API connectivity.
6. Launch a full Field Usage scan.
7. Confirm the scan reaches successful completion and becomes the current snapshot.
8. Check evidence for Apex, Trigger, Flow, LWC, Aura, Formula and Validation Rule sources where examples exist in the test org.
9. Test the Field Usage Map and evidence drill-down.
10. Test Field Change Impact.
11. Test Data Dictionary and Object Intelligence.
12. Test schedule creation, pause/resume/delete and running-task monitoring.
13. Test Architecture Intelligence regression paths.
14. Run Salesforce CLI validation and the complete Jest suite.

## 10. Compatibility and interpretation

Version 3 is designed to preserve the product capabilities established in Versions 1 and 2 while adding the new Version 3 intelligence pipeline. Beta testing is still required before treating the branch as the production release line.

ER Modeller Studio is architecture and dependency-intelligence software. Its findings are evidence for human review. A missing dependency means the implemented scanners did not detect evidence in the current successful snapshot; it does not prove that no dependency exists anywhere in Salesforce or an external system. Likewise, a hotspot, cycle, overlap candidate, Record Type count or Layout count is not automatically a defect.

## 11. Documentation

To keep the repository clean, Version 3 uses a small documentation set with clear ownership:

- [ARCHITECTURE.md](ARCHITECTURE.md) — authoritative whole-product technical architecture, including the modelling pipeline, Architecture Intelligence, Field Usage architecture and ER DSL compiler architecture.
- [DSL.md](DSL.md) — DSL syntax and language reference.
- [SECURITY.md](SECURITY.md) — security model and Tooling API trust boundary.
- [RELEASE-NOTES-V2.md](RELEASE-NOTES-V2.md) — historical Version 2 release notes.
- In-product **Help** — user operation, configuration and troubleshooting.

For Version 3, this file is the release note. Separate duplicate V3 feature documents are intentionally avoided.

---

**Vikas Cohen**  
**Lead Architect & Author**
