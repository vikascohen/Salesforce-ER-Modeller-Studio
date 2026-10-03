# Security Overview

**Author: Vikas Cohen**

This document describes the current security and trust boundaries of ER Modeller Studio Version 3. Earlier versions were predominantly schema-local; Version 3 adds authenticated Salesforce Tooling API callouts for Field Usage and object intelligence, so the security model must explicitly describe that boundary.

## Security principles

- ER Modeller Studio is a native Salesforce LWC + Apex application.
- It has no application-owned external server, telemetry service or third-party processing backend.
- Tooling API access is an authenticated call from Salesforce back to Salesforce and must use configured Salesforce credentials; credentials are not embedded in source code.
- The Studio is an architecture/dependency tool, not a record-data extraction product.
- Evidence and diagnostics must never persist access tokens, session identifiers, passwords or credential secrets.
- Salesforce access controls and the supplied permission set remain part of the deployment boundary.

## What the Studio reads

| Capability | Information used |
|---|---|
| ER modelling / Import from Org | Object, field, type and relationship schema metadata |
| Data Dictionary | Schema/field metadata, descriptions and supported metadata detail |
| Sharing View | Object sharing-model metadata |
| Heatmap | Aggregate record counts |
| Data Dictionary % Used | Aggregate/non-blank population calculations; the UI is interested in percentage, not record values |
| Architecture Intelligence | Current ER model plus supported metadata/evidence supplied to the architecture workspace |
| Field Usage | Salesforce source/metadata required by implemented scanners, including supported Apex, Flow, formula, LWC, Aura and validation metadata |
| Object Intelligence | Selected-object metadata/evidence such as triggers, validation rules, Flows, record types and page layouts where supported |
| Diagnostics | Configuration/runtime metadata required to verify Studio and Tooling API operation |

The Studio should not be described as making **no HTTP callouts**: Version 3 intentionally uses authenticated Tooling API callouts.

## Tooling API trust boundary

Version 3 uses Tooling API access for capabilities that Salesforce Apex describe alone cannot provide. The relevant client classes include `FieldUsageToolingApiClient` and `FieldUsageUiToolingClient`; selected-object intelligence and diagnostics also depend on the configured Salesforce authentication boundary.

The deployment must configure the Named Credential / External Credential / principal required by the Studio. The in-product **Help → Configuration** guide is the operational source of truth for the current setup steps.

Security rules for this boundary:

1. Never hardcode tokens, passwords, client secrets or session IDs in Apex or JavaScript.
2. Use Salesforce credential facilities for authentication and principal assignment.
3. Grant only the access required for the Studio's supported metadata/source retrieval.
4. Do not write credential material into `Field_Usage_Evidence__c`, scan logs, errors or diagnostics output.
5. Treat retrieved source/metadata as organisation information and expose it only to authorised Studio users.

## Persisted application data

Version 3 separates persistence by purpose:

- `Diagram_File__c` — saved diagram/DSL content.
- `Diagram_Studio_Pref__c` — Studio preferences such as theme.
- `Field_Usage_Run__c` — scan lifecycle and status.
- `Field_Usage_Work_Unit__c` — durable bounded scan work/checkpoints.
- `Field_Usage_Evidence__c` — normalised detected field dependency evidence.
- `Field_Usage_Schedule__c` — configured Field Usage schedules.

These records must not be used as a place to persist authentication secrets.

## Record-data boundary

Some existing Studio features use aggregate queries, for example record-count Heatmap and Data Dictionary populated-field percentage. Those features should be described accurately as aggregate record-data calculations rather than as never touching record data at all. The Studio does not need to display or persist individual business record values for those calculations.

Field Usage is different: its purpose is source/metadata dependency discovery. Evidence records contain identifiers and dependency context rather than copies of business records.

## Dynamic metadata and SOQL safety

Where object or field API names must participate in dynamic operations, identifiers must be validated against Salesforce schema/expected identifier rules before use. New code must not concatenate arbitrary user text into dynamic SOQL or API paths.

Bulk operations should use collection-oriented SOQL/DML and bounded work units. This is both a governor-limit requirement and a security/reliability measure because it reduces uncontrolled query/callout behaviour.

## Permission model

The repository includes `Diagram_Studio_User.permissionset-meta.xml`. Deployments should assign Studio access deliberately and separately configure any External Credential principal access required for Tooling API operation.

A successful UI load does not imply that every metadata source is available. The Studio is designed to degrade or report configuration/permission failures rather than manufacture evidence.

## Snapshot integrity

Field Usage preserves the previous successful snapshot while a replacement scan is running. A partial or failed scan must not silently replace the current trusted snapshot. This is a data-integrity control as well as an architectural one: users should be able to distinguish successful evidence from incomplete processing.

## Logging and diagnostics

Diagnostics and scan logs may contain object, field, component and error context useful for troubleshooting. They must not contain credentials or authentication tokens. Error handling should preserve enough source context to diagnose failed work without leaking secrets.

## Third-party code

Third-party components included in the repository are documented in `THIRD_PARTY_NOTICES.md`. Review that file alongside this security document when assessing deployment.

## Security review checklist

Before deployment or a major Version 3 change, verify:

- the Tooling API credential/principal is configured and scoped appropriately;
- the Studio permission set grants only intended access;
- no secrets are present in source, custom-object data or logs;
- new dynamic SOQL/API identifiers are validated;
- scanner results cannot promote a failed/partial snapshot to current;
- new scanners use bounded work and shared authenticated API clients rather than inventing a new credential path;
- UI wording distinguishes unavailable evidence from zero detected evidence;
- any new external integration is documented here before release.

For the complete component/data-flow architecture see [ARCHITECTURE.md](ARCHITECTURE.md). For the Field Usage pipeline and scanner contract see [FIELD_USAGE_ARCHITECTURE.md](FIELD_USAGE_ARCHITECTURE.md).
