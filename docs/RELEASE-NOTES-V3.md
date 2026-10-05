# Salesforce ER Modeller Studio — Version 3 Release Notes

**Release:** Version 3.0.0.2  
**Status:** Stable / Released  
**Package:** Second-generation unlocked package (2GP)  
**Apex code coverage:** 91%  
**Subscriber Package Version ID:** `04taj000000imKHAAY`

Version 3 is the current stable release of Salesforce ER Modeller Studio. It carries forward the ER modelling and Data Dictionary foundation from Version 1, the Architecture Intelligence capabilities developed in Version 2, and adds Field Usage Intelligence, Field Change Impact, richer Object Intelligence, operational scanning and diagnostics.

The release philosophy remains the same throughout the product: **provide useful architectural evidence for human review without presenting structural signals or missing evidence as certainty.**

## 1. Version lineage

```text
Version 1
ER modelling + DSL + Data Dictionary + schema exploration
        |
        v
Version 2
Version 1 + Architecture Intelligence
        |
        v
Version 3
Version 1 + Version 2 + Field Usage Intelligence +
Field Change Impact + richer Object Intelligence + scan operations
```

Stable release branches:

- [Version 1 stable](../tree/version-1-stable)
- [Version 2 stable](../tree/version-2-stable)
- [Version 3 stable](../tree/version-3-stable)
- [`main`](../) — current Version 3 release line

The former `v3-beta-testing` branch may remain available as a historical pre-release branch, but it is no longer the current release line.

## 2. Installation

Version 3 can be installed directly. Versions 1 or 2 are not prerequisites.

### Production / Developer Edition

[Install Version 3](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY)

### Sandbox

[Install Version 3 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY)

Version 3 is a new 2GP unlocked-package lineage. Versions 1 and 2 were distributed through the earlier unmanaged-package route, so an existing V1/V2 installation should not be treated as an ordinary in-place upgrade to V3.

## 3. Functionality carried forward from Version 1

Version 3 retains the core modelling and schema-exploration capabilities established in Version 1, including:

- Visual ER canvas with draggable Salesforce objects
- Salesforce schema import and Describe-based exploration
- Lookup, Master-Detail and polymorphic relationship modelling
- Bidirectional visual model and ER DSL workflow
- DSL editor assistance
- Saved diagrams and multi-tab workflow
- Data Dictionary and object/field metadata exploration
- Schema drift / Compare with Org capabilities
- Basic sharing-model view
- Record-count heatmap
- Fit Model, zoom and canvas navigation
- PNG, Mermaid and Draw.io-oriented exports where exposed by the Studio

The ER DSL language reference is maintained in [DSL.md](DSL.md).

## 4. Functionality carried forward from Version 2

Version 3 retains the Architecture Intelligence capabilities developed in Version 2, including:

- Architecture Overview
- Structural architecture metrics and topology
- Hotspot analysis
- Isolated-object analysis
- Connected-component analysis
- Bounded-cycle analysis
- Relationship Path Finder
- Junction-object intelligence
- Object Map & Impact / structural neighbourhood analysis
- Blast-radius evidence
- Object Usage & Change Readiness
- Relationship Insights
- Architecture-oriented visual views and exports where exposed by the Studio
- Mimic New ER for modelling proposed custom schemas

These capabilities provide structural evidence for architectural review. A hotspot, cycle, isolated object or other structural signal is not automatically a defect.

## 5. New in Version 3 — Field Usage Intelligence

Version 3 adds field-level dependency intelligence to help investigate what supported Salesforce artefacts may reference a field before that field is changed.

### Background scanning

- Asynchronous Field Usage scanning using Batch Apex
- Manual **Run Now** execution
- Configurable scheduled scans
- Durable scan runs and work units for larger-org processing
- Current-successful-snapshot semantics so a partial or failed replacement scan does not displace the last successful snapshot

### Dependency evidence

Field Usage can collect evidence from supported Salesforce metadata and source artefacts including:

- Apex Classes
- Apex Triggers
- Active Flows
- Formula Fields
- Lightning Web Components
- Aura Components
- Validation Rules

Evidence is persisted in `Field_Usage_Evidence__c` using a sparse evidence model. The absence of evidence means the supported scanners did not detect a dependency in the current successful snapshot; it does **not** prove that a field is universally unused or safe to delete.

### Field Usage Map

- Object and field selection
- Evidence grouped by source type
- Component-level evidence drill-down
- Summary-first retrieval
- Lazy/paginated evidence detail where applicable
- Snapshot-aware behaviour so evidence from different scan snapshots is not silently mixed
- Export support where exposed by the Studio

### Field Change Impact

Field Change Impact uses the current successful Field Usage snapshot to show supported artefacts that may depend on a selected field. It complements the structural Object Map & Impact capability in Architecture Intelligence; the two represent different types of evidence.

## 6. Object Intelligence

Version 3 expands selected-object investigation with contextual metadata including:

- Standard and custom field context
- Relationship context
- Required custom-field visibility
- Potential custom-to-standard overlap candidates for review
- Apex Trigger context
- Validation Rule context
- Flow context
- Record Type context
- Page Layout context
- On-demand metadata loading and Studio-session caching where applicable

Counts and structural observations are presented as evidence and context rather than automatically being labelled as architectural defects.

## 7. Data Dictionary improvements

Version 3 retains the Data Dictionary and expands the experience with:

- Improved object and field browsing, search and filtering
- Field detail and field-intelligence views
- Clear standard/custom field visibility
- Description and documentation context
- Record-population analysis kept separate from dependency usage
- Bulk Data Dictionary export to Excel
- Direct access to richer selected-object intelligence

## 8. Operations, settings and diagnostics

Version 3 adds or expands operational support for Field Usage:

- Field Usage schedule management
- Running-task monitoring
- Scan status and operational visibility
- Theme preferences
- System information
- Environment diagnostics
- Tooling API configuration diagnostics
- Permission-set based access to supporting components
- In-product **Help → Configuration** and **Help → User Manual** guidance

## 9. Tooling API configuration

Field Usage and selected metadata-intelligence capabilities use authenticated Salesforce Tooling API access.

After installing Version 3:

1. Assign the **Diagram Studio User** permission set to the intended users.
2. Configure the Salesforce Named Credential `Salesforce_Tooling_API`.
3. Configure the corresponding External Credential and authenticated principal.
4. Grant the required principal access.
5. Use **Help → Configuration** for the current configuration steps.
6. Run **Diagnostics** to verify the environment and Tooling API configuration.
7. Run a Field Usage scan and confirm that a successful snapshot is available.

Credentials are not embedded in the application source.

For source/CLI deployment guidance, see [GIT_SALESFORCE_CLI_DEPLOYMENT.md](GIT_SALESFORCE_CLI_DEPLOYMENT.md).

## 10. Security and processing boundary

Salesforce ER Modeller Studio performs its architecture and dependency analysis within the customer's Salesforce environment. Salesforce metadata and source code used for analysis are not exported to an external SaaS platform for processing.

See [SECURITY.md](SECURITY.md) for the security model and Tooling API trust boundary.

## 11. Interpretation and limitations

ER Modeller Studio is architecture and dependency-intelligence software. It is not a general-purpose static-code analyser, runtime observability platform or automated architecture judge.

The product reports evidence within its implemented analysis scope. A missing dependency does not prove that no dependency exists elsewhere in Salesforce, through unsupported metadata, dynamically constructed references or an external system. Likewise, a hotspot, cycle, overlap candidate, Record Type count, Layout count or other structural observation is not automatically a defect.

The intended workflow is therefore:

**discover → inspect evidence → apply architectural judgement → make the change**

## 12. Release validation

The released Version 3 package was created with Salesforce package validation enabled and reports **91% Apex code coverage** with the package code-coverage requirement met.

The release package is:

`04taj000000imKHAAY` — Version `3.0.0.2`

## 13. Documentation

Version 3 uses a deliberately small documentation set:

- [README](../README.md) — product overview, philosophy, version history and installation links
- [ARCHITECTURE.md](ARCHITECTURE.md) — whole-product technical architecture
- [DSL.md](DSL.md) — ER DSL syntax and language reference
- [BUSINESS-USE-CASES.md](BUSINESS-USE-CASES.md) — practical business use cases
- [SECURITY.md](SECURITY.md) — security model and Tooling API boundary
- [GIT_SALESFORCE_CLI_DEPLOYMENT.md](GIT_SALESFORCE_CLI_DEPLOYMENT.md) — source/CLI deployment and configuration guidance
- In-product **Help** — configuration, operation and troubleshooting

---

**Vikas Cohen**  
**Lead Architect & Author**
