# Salesforce ER Modeller Studio — Version 3 Release Notes

## Field Usage Intelligence

Version 3 expands Salesforce ER Modeller Studio beyond ER modelling and structural Architecture Intelligence with a persisted, asynchronous **Field Usage Intelligence** platform.

The release is designed around a practical architecture question:

> **Before I change a Salesforce field, where is that field used and what could I affect?**

## Major additions

### 1. Persisted Field Usage dependency index

Version 3 introduces asynchronous dependency discovery backed by Salesforce custom objects. Heavy scanning is performed in Batch Apex and persisted as a successful snapshot. Interactive screens query the snapshot rather than rescanning source metadata on demand.

### 2. Seven scanner families

Version 3 architecture supports dependency evidence from:

- Apex Classes
- Apex Triggers
- Active Flows
- Lightning Web Components
- Aura components
- Formula Fields
- Validation Rules

All scanners converge on a common evidence model.

### 3. Field Usage Map

The new map visualises dependency evidence using the hierarchy:

```text
Object → Field → Source Type → Component → Evidence
```

Objects and fields come from Salesforce Schema, so a field can still be selected even when the current snapshot contains no evidence for it.

### 4. Field Change Impact

Architecture Intelligence now includes field-level change investigation backed by the same successful Field Usage snapshot. This provides a focused blast-radius view without launching another metadata scan.

### 5. Summary-first and lazy-detail architecture

Initial map construction uses compact aggregate evidence. Component/evidence detail is retrieved only when the user expands a source branch. Detail is bounded and paginated for large dependency sets.

### 6. Durable work units

Long-running scans are decomposed into persisted `Field_Usage_Work_Unit__c` records. This gives the pipeline explicit work state, bounded processing and better failure isolation.

### 7. Safe snapshot promotion

A replacement scan becomes current only after required work completes successfully. Failed or incomplete scans preserve the previous successful snapshot.

### 8. Operational Console

The Field Usage Settings experience provides:

- Run Scan Now
- automatic polling
- live Batch Apex processed/total information
- pipeline phase and progress
- dependency counts
- error counts
- scanner coverage
- schedule configuration
- scheduled-job monitoring
- recent scan history

### 9. Scan error inspection

`Completed With Errors` and failed history entries expose persisted error details. This makes it possible to diagnose scanner/API failures even when Salesforce Setup shows the terminal Batch Apex job itself as `Completed`.

### 10. Configurable automatic scans

Administrators can configure automatic Field Usage scans without manually authoring CRON expressions. Manual and scheduled execution share the same orchestration path.

### 11. Tooling API integration

Version 3 uses a Named Credential called `Salesforce_Tooling_API` for server-side Salesforce Tooling API access. API transport is separated from scanner logic and authentication remains owned by the target Salesforce org.

### 12. Validation Rule intelligence

Validation Rule formulas participate in Field Usage evidence. Validation Rule metadata is retrieved through supported Tooling API resources; Tooling requests are not embedded inside the standard Data API Composite resource.

### 13. LWC and Aura intelligence

Lightning Web Component and Aura resources participate in the common Field Usage evidence model, allowing UI dependencies to appear alongside Apex, Flow, Formula and Validation Rule evidence.

### 14. System Information and Diagnostics

The Settings experience includes environment/system information and diagnostics to help administrators understand Studio configuration and Field Usage readiness.

### 15. Theme support

Studio appearance settings are separated from scan state and architecture semantics.

## Existing Architecture Intelligence retained

Version 3 builds on the Version 2 architecture capabilities, including architecture metrics, topology, hotspots, isolated objects, connected components, bounded cycles, Object Map & Impact, relationship path finding, junction intelligence, Object Usage & Change Readiness and Architecture Overview.

## Reliability improvements

Version 3 formalises several invariants:

- a failed scan does not replace the last successful snapshot;
- scanner failures remain observable;
- expensive metadata work is asynchronous;
- evidence reads are bounded;
- source detail is lazy-loaded;
- work is persisted rather than represented only by in-memory state;
- map reads are separated from scan execution;
- API credentials are not stored in application source.

## Performance design

The release is designed for large Salesforce orgs. Important decisions include:

- Batch Apex for heavy work;
- durable work units;
- sparse evidence persistence;
- aggregate summary queries;
- bounded detail retrieval;
- keyset-style pagination;
- client-side caching scoped to snapshot context;
- independent measurement of scan throughput and interactive map latency.

## Administrator requirement

Configure the Salesforce Named Credential:

```text
Salesforce_Tooling_API
```

The authenticated principal must have the permissions required to retrieve the metadata being analysed. External Credential principal access must be granted to the relevant Salesforce users/permission set.

## Known boundaries

Version 3 does not claim universal field usage detection. Evidence may not cover every possible dependency source, including runtime-generated references, external integrations, reports, managed-package internals and future metadata families.

OmniStudio scanning is intentionally outside the Version 3 release boundary.

## Future direction

Planned future architecture can build on the Version 3 foundation with:

- optional OmniStudio scanning;
- Object Architecture Health;
- configurable Architecture Health / governance rules;
- organisation-specific naming conventions;
- metadata quality and technical-debt policy packs.

The configurable governance rule engine is a future phase and is not a Version 3 release claim.

## Upgrade philosophy

Version 3 is an additive architecture evolution of ER Modeller Studio. Existing ER modelling and Architecture Intelligence concepts remain separate from the persisted Field Usage scan lifecycle. Field Usage data can therefore evolve without requiring the ER diagram itself to become the dependency persistence store.

---

**Lead Architect & Author:** Vikas Cohen  
**Developed by:** Crius Consulting Architects  
**Licence:** MIT
