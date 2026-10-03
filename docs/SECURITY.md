# Security Overview

**Author: Vikas Cohen**

ER Modeller Studio Version 3 is a Salesforce architecture and metadata analysis tool. Its purpose is to understand Salesforce schema, configuration, source dependencies and architecture. It deals with Salesforce metadata and architecture information rather than Salesforce business data.

## Security principles

- ER Modeller Studio is a native Salesforce LWC and Apex application.
- The Studio operates within the Salesforce platform and organisation boundary.
- It has no application-owned external server, telemetry service, analytics endpoint or third-party processing backend.
- Salesforce metadata, source and architecture evidence are not transmitted to an ER Modeller Studio external service.
- Version 3 Tooling API communication is Salesforce-to-Salesforce using administrator-configured Salesforce credentials.
- Credentials are not embedded in source code.
- Authentication secrets must never be persisted in Studio evidence, diagnostics or logs.
- Salesforce permissions and the supplied permission set remain part of the deployment boundary.

## Metadata scope

The Studio works with Salesforce architecture and metadata information required by its features. This includes areas such as:

- objects, fields, field types and relationships;
- sharing-model metadata;
- Apex Classes and Triggers;
- Flows;
- Lightning Web Components and Aura components;
- Formula Fields and Validation Rules;
- Record Types and Page Layout metadata where supported;
- architecture relationships and dependency evidence;
- Studio configuration and diagnostic metadata.

The purpose of this information is architecture modelling, Data Dictionary generation, Object Intelligence, Architecture Intelligence and Field Usage analysis.

ER Modeller Studio is not designed as a business-data integration, extraction, migration or synchronisation product.

## Salesforce-only processing boundary

ER Modeller Studio does not require an application-owned cloud service or external processing environment. Processing occurs within the Salesforce environment through Apex and Lightning components.

Version 3 uses Salesforce Tooling API where Salesforce Apex Describe alone cannot provide the metadata or source information required by a feature. These calls are authenticated Salesforce-to-Salesforce requests under the organisation's configured Salesforce credential boundary.

There is no ER Modeller Studio backend receiving organisation metadata, source code, dependency evidence, diagrams or diagnostic information.

If a future version introduces an external service, telemetry, AI endpoint or third-party processing integration, that would create a new trust boundary and must be documented and reviewed before release.

## Tooling API trust boundary

Version 3 uses Tooling API access for supported Field Usage, Object Intelligence and diagnostic capabilities.

The deployment configures the required Named Credential, External Credential and principal. The in-product **Help > Configuration** guide contains the current setup steps.

Security rules for this boundary:

1. Never hardcode tokens, passwords, client secrets or session IDs in Apex or JavaScript.
2. Use Salesforce credential facilities for authentication and principal assignment.
3. Grant only the access required for supported metadata and source retrieval.
4. Do not write credential material into Field Usage evidence, scan logs, errors or diagnostics output.
5. Treat retrieved source and metadata as organisation information and expose it only to authorised Studio users.
6. Do not forward retrieved source, metadata or evidence to an external service.

## Studio persistence

Version 3 stores only the Studio information required to provide its functionality, including saved diagrams and DSL, Studio preferences, Field Usage scan state, bounded work units, dependency evidence and schedules.

This information remains within the Salesforce organisation. Studio persistence must never be used to store authentication secrets.

## Permission model

The repository includes `Diagram_Studio_User.permissionset-meta.xml`. Deployments should assign Studio access deliberately and separately configure any External Credential principal access required for Tooling API operation.

A successful UI load does not imply that every metadata source is available. The Studio is designed to report configuration or permission failures rather than manufacture architecture evidence.

## Snapshot integrity

Field Usage preserves the previous successful snapshot while a replacement scan is running. A partial or failed scan must not silently replace the current successful snapshot. This allows users to distinguish successful architecture evidence from incomplete processing.

## Logging and diagnostics

Diagnostics and scan logs may contain object, field, component and error context useful for troubleshooting. They must not contain credentials or authentication tokens.

Diagnostics and logs are not transmitted to an ER Modeller Studio telemetry or support service.

## Third-party code

Third-party components included in the repository are documented in `THIRD_PARTY_NOTICES.md`. Review that file alongside this security document when assessing deployment. Inclusion of client-side library code does not by itself create an external processing connection.

## Security review checklist

Before deployment or a major Version 3 change, verify:

- the Tooling API credential and principal are configured and scoped appropriately;
- the Studio permission set grants only intended access;
- no secrets are present in source, Studio persistence or logs;
- new dynamic metadata/API identifiers are validated;
- scanner results cannot promote a failed or partial snapshot to current;
- new scanners use bounded work and shared authenticated Salesforce API clients rather than introducing a new credential path;
- UI wording distinguishes unavailable evidence from zero detected evidence;
- no feature introduces external transmission, telemetry or third-party processing without explicit architectural and security review.

For the complete component, data-flow and Field Usage architecture see [ARCHITECTURE.md](ARCHITECTURE.md).
