# Security Overview

**Author: Vikas Cohen**

This document describes the current security and trust boundaries of ER Modeller Studio Version 3. Version 3 adds authenticated Salesforce Tooling API access for Field Usage and Object Intelligence. The Tooling API communication remains within the Salesforce platform boundary: Salesforce calls Salesforce using administrator-configured Salesforce credentials.

## Security principles

- ER Modeller Studio is a native Salesforce LWC and Apex application.
- It has no application-owned external server, telemetry service, analytics endpoint or third-party processing backend.
- The Studio does not transmit organisation data, metadata, source code or Field Usage evidence to an ER Modeller Studio server or any other external service.
- Tooling API access is an authenticated Salesforce-to-Salesforce call and uses configured Salesforce credentials. Credentials are not embedded in source code.
- The Studio is an architecture, metadata and dependency-analysis tool. It is not a business-record extraction, migration or synchronisation product.
- Field Usage and architecture analysis do not modify the organisation's business records.
- Evidence and diagnostics must never persist access tokens, session identifiers, passwords or credential secrets.
- Salesforce access controls and the supplied permission set remain part of the deployment boundary.

## Data residency and external transmission

ER Modeller Studio does not require an application-owned cloud service or external processing environment. Processing occurs in the Salesforce org through Apex and Lightning components, with supported metadata/source retrieval performed through Salesforce APIs.

No business-record content, Salesforce metadata, Apex/Flow/Lightning source, dependency evidence, saved diagram content or diagnostic information is intentionally transmitted by the Studio to an external ER Modeller Studio service, because no such service exists.

Version 3 does make HTTP callouts for Tooling API operations. These must not be described as external third-party data transmission: they are authenticated calls from the Salesforce runtime to Salesforce API endpoints under the organisation's configured credential boundary.

If a future version introduces any external service, telemetry, AI endpoint or third-party processing integration, that would represent a new trust boundary and must be documented and reviewed before release.

## What the Studio reads

| Capability | Information used |
|---|---|
| ER modelling / Import from Org | Object, field, type and relationship schema metadata |
| Data Dictionary | Schema/field metadata, descriptions and supported metadata detail |
| Sharing View | Object sharing-model metadata |
| Heatmap | Aggregate record counts |
| Data Dictionary % Used | Aggregate/non-blank population calculations; the UI is interested in percentage, not individual record values |
| Architecture Intelligence | Current ER model plus supported metadata/evidence supplied to the architecture workspace |
| Field Usage | Salesforce source/metadata required by implemented scanners, including supported Apex, Flow, formula, LWC, Aura and validation metadata |
| Object Intelligence | Selected-object metadata/evidence such as triggers, validation rules, Flows, record types and page layouts where supported |
| Diagnostics | Configuration/runtime metadata required to verify Studio and Tooling API operation |

The Studio should not be described as never accessing record data at all. Some optional features perform aggregate calculations against records. The important boundary is that these features do not need to expose, export or persist individual business-record values.

## Tooling API trust boundary

Version 3 uses Tooling API access for capabilities that Salesforce Apex Describe alone cannot provide. The relevant client classes include `FieldUsageToolingApiClient` and `FieldUsageUiToolingClient`; selected-object intelligence and diagnostics also depend on the configured Salesforce authentication boundary.

The deployment must configure the Named Credential, External Credential and principal required by the Studio. The in-product **Help > Configuration** guide is the operational source of truth for the current setup steps.

Security rules for this boundary:

1. Never hardcode tokens, passwords, client secrets or session IDs in Apex or JavaScript.
2. Use Salesforce credential facilities for authentication and principal assignment.
3. Grant only the access required for the Studio's supported metadata/source retrieval.
4. Do not write credential material into `Field_Usage_Evidence__c`, scan logs, errors or diagnostics output.
5. Treat retrieved source/metadata as organisation information and expose it only to authorised Studio users.
6. Do not forward retrieved source, metadata or evidence to an external service.

## Persisted application data

Version 3 separates application persistence by purpose:

- `Diagram_File__c`: saved diagram/DSL content.
- `Diagram_Studio_Pref__c`: Studio preferences such as theme.
- `Field_Usage_Run__c`: scan lifecycle and status.
- `Field_Usage_Work_Unit__c`: durable bounded scan work/checkpoints.
- `Field_Usage_Evidence__c`: normalised detected field dependency evidence.
- `Field_Usage_Schedule__c`: configured Field Usage schedules.

These are Studio-owned operational/configuration records stored inside the Salesforce org. They are not copies of the organisation's business-record dataset and must never be used to persist authentication secrets.

## Business-record boundary

ER Modeller Studio does not modify business records as part of its architecture, Data Dictionary, Object Intelligence or Field Usage analysis.

Some existing Studio features use aggregate queries, for example the record-count Heatmap and Data Dictionary populated-field percentage. These calculations may read record-level state in order to calculate an aggregate, but the product does not need to display, export or persist individual business-record values for those calculations.

Field Usage is different. Its purpose is source and metadata dependency discovery. Persisted evidence contains identifiers and dependency context rather than copies of business records.

This distinction is important for security assessment:

```text
Business records:        not modified by Studio analysis
Individual record values: not persisted as analysis output
Architecture metadata:   read inside Salesforce
Source/dependency evidence: processed and persisted inside Salesforce
External Studio backend: none
```

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

Diagnostics and logs are not intentionally transmitted to an ER Modeller Studio telemetry or support service.

## Third-party code

Third-party components included in the repository are documented in `THIRD_PARTY_NOTICES.md`. Review that file alongside this security document when assessing deployment. Inclusion of client-side library code does not by itself create an external data-processing connection.

## Security review checklist

Before deployment or a major Version 3 change, verify:

- the Tooling API credential/principal is configured and scoped appropriately;
- the Studio permission set grants only intended access;
- no secrets are present in source, custom-object data or logs;
- new dynamic SOQL/API identifiers are validated;
- scanner results cannot promote a failed/partial snapshot to current;
- new scanners use bounded work and shared authenticated API clients rather than inventing a new credential path;
- UI wording distinguishes unavailable evidence from zero detected evidence;
- business-record values are not introduced into persisted dependency evidence;
- no feature introduces external transmission, telemetry or third-party processing without explicit architectural and security review.

For the complete component, data-flow and Field Usage architecture see [ARCHITECTURE.md](ARCHITECTURE.md).
