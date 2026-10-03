# Version 3 Feature Guide

This guide summarises the user-facing and architectural capabilities introduced or extended in Salesforce ER Modeller Studio Version 3.

## Field Usage Intelligence

Field Usage Intelligence builds a persisted dependency snapshot for supported Salesforce metadata. It is intended for architects and developers assessing field change impact before modifying schema.

### Supported source types

| Source type | Purpose |
|---|---|
| Apex Class | Detect field references in Apex class source |
| Apex Trigger | Detect field references in trigger source |
| Flow | Detect field references in active Flow metadata |
| LWC | Detect field references in Lightning Web Component resources |
| Aura | Detect field references in Aura resources |
| Formula Field | Detect formula dependencies |
| Validation Rule | Detect field references in Validation Rule formulas |

## Run Scan Now

Starts the asynchronous scan pipeline. A new scan does not immediately invalidate the previous successful snapshot.

## Automatic scanning

Administrators can configure automatic scan schedules from Studio. Scheduling is represented in human-readable settings while Apex owns the underlying Salesforce scheduled job.

## Live scan monitoring

The Operational Console displays the active run and live asynchronous processing information. Polling refreshes run/job state while processing continues.

Useful indicators include:

- run health;
- snapshot status;
- dependencies found;
- error count;
- current pipeline phase;
- current Batch Apex processed/total;
- objects/work processed;
- scanner coverage.

## Last 10 Scans

The console displays recent Field Usage runs with status, timestamps, dependency totals, error totals and final phase.

For failed / `Completed With Errors` runs, the status can expose the persisted error detail inline. This is particularly useful when the Salesforce batch job technically completed but one of the dependency work units did not.

## Field Usage Map

The map visualises the latest successful snapshot.

```text
Object
  → Field
      → Source Type
          → Component
              → Evidence
```

The user selects one accessible object and one or more fields. Source detail is loaded on demand.

## Zero-evidence fields

The object and field lists are Schema-driven. A field does not disappear merely because the scanner found no evidence. A zero-evidence result means only that the supported scanners did not detect a dependency in the current successful snapshot.

## Field Change Impact

Field Change Impact provides a focused field-level blast-radius view in Architecture Intelligence. It reuses the same Field Usage snapshot rather than running a second scan.

## Evidence search and detail

Evidence is stored in a normalised structure with object, field, source type, component and location/context information where available. Summary APIs return aggregate counts; detail APIs are bounded and paginated.

## System Information

System Information helps identify the Studio/runtime environment and relevant org information. It is an operational/settings feature and does not require an ER diagram to be loaded.

## Diagnostics

Diagnostics are intended to help administrators validate Studio configuration and troubleshoot environment problems, including Field Usage prerequisites.

## Theme

Theme settings control Studio presentation independently of architecture data and scan state.

## Architecture Intelligence integration

Version 3 retains the broader Architecture Intelligence capabilities from Version 2 and adds Field Change Impact as a consumer of Field Usage evidence.

Diagram-based Architecture Intelligence and org-level Field Usage are related but not identical concerns. Field Usage scanning should remain usable independently of whether an ER model is currently loaded.

## Security model

Tooling API access is server-side and authenticated through the Salesforce Named Credential `Salesforce_Tooling_API`. Source retrieval is not delegated to the browser. Secrets and tokens must not be stored in repository code or scan evidence.

## Operational interpretation

### `Completed`
Required work completed and the snapshot was eligible for successful promotion.

### `Completed With Errors`
The asynchronous pipeline reached finalisation, but required work was incomplete or scanner errors were recorded. The previous successful snapshot remains authoritative.

### `Failed`
The run could not complete successfully.

A Salesforce Setup → Apex Jobs entry showing `Completed` does not by itself prove the Field Usage snapshot is complete. Studio evaluates the entire run/work-unit pipeline.

## Architecture extension model

Future scanner families should:

1. discover bounded work;
2. persist durable work units;
3. process asynchronously;
4. emit the common evidence shape;
5. participate in finalisation;
6. become available to existing summary/detail/map consumers.

This allows future metadata types to be added without redesigning the Field Usage Map.

## Future features not included in Version 3

- OmniStudio dependency scanning
- Object Architecture Health
- configurable governance / Architecture Health rules
- organisation-specific naming-convention rules
- configurable technical-debt policy packs

These are future-phase concepts and should not be represented as already delivered Version 3 functionality.
