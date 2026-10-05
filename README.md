# Salesforce ER Modeller Studio

**Salesforce Data Architecture Intelligence & ER Modelling**  
**Open source. Free to use. Built for Salesforce architects, developers and platform teams.**

Salesforce ER Modeller Studio is a Salesforce-native workspace for understanding the structure, relationships and dependencies in a Salesforce org before making change. It combines visual ER modelling, a Data Dictionary, Object Intelligence, Architecture Intelligence and, in Version 3, Field Usage Intelligence.

> **Security boundary:** Analysis is performed within the customer's Salesforce environment. Salesforce metadata and source code used by the Studio are not exported to an external SaaS platform for processing.

## Current release

**Version 3** is the current stable release. It includes the modelling foundation from Version 1, the Architecture Intelligence introduced in Version 2, and the Field Usage and change-impact capabilities introduced in Version 3.

Version **3.0.0.2** is released as a Salesforce second-generation unlocked package (2GP). The released package was validated by Salesforce with **91% Apex code coverage**.

## Install

Choose the version you want below. You do **not** need to install an earlier version before installing a later version.

| Version | Release | Package | Production / Developer Edition | Sandbox | Branch |
| --- | --- | --- | --- | --- | --- |
| **Version 3** | **Current stable** | 2GP unlocked | [Install V3](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY) | [Install V3 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY) | [`version-3-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-3-stable) |
| Version 2 | Historical stable | Unmanaged | [Install V2](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000hugT) | [Install V2 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000hugT) | [`version-2-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-2-stable) |
| Version 1 | Historical stable | Unmanaged | [Install V1](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000gRTd) | [Install V1 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000gRTd) | [`version-1-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-1-stable) |

### Version 3 package details

**Subscriber Package Version ID:** `04taj000000imKHAAY`  
**Version:** `3.0.0.2`  
**Release status:** Released  
**Apex code coverage:** 91%

### After installing Version 3

1. Assign the **Diagram Studio User** permission set to ER Modeller users.
2. Configure the **Salesforce Tooling API** Named Credential, External Credential and authenticated principal. See the installation/configuration documentation or **Help → Configuration** inside the Studio.
3. Open the **ER Modeller** tab.
4. Run **Diagnostics** to verify the environment before running Field Usage scans.

> **Existing V1/V2 installations:** Versions 1 and 2 were distributed as unmanaged packages, while Version 3 is a new 2GP package lineage. Treat migration from an existing unmanaged installation separately rather than assuming V3 will overwrite the old package as an in-place upgrade.

## Version history

### Version 1: ER modelling foundation

Version 1 established the core Salesforce ER modelling workspace:

- Visual Salesforce ER modelling canvas
- Salesforce schema import
- Lookup, Master-Detail and polymorphic relationship modelling
- Drag-and-drop modelling
- Bidirectional visual ↔ DSL modelling
- DSL import/export and editor assistance
- Data Dictionary
- Sharing and org-aware views
- Record-count heatmap
- PNG, Mermaid and Draw.io export
- Multi-file diagram workspace
- Themes and per-user preferences

### Version 2: Architecture Intelligence

Version 2 includes Version 1 and adds architecture-level analysis of the represented Salesforce data model:

- Architecture Overview and structural metrics
- Object hotspots and connectivity analysis
- Connected components and isolated objects
- Relationship Path Finder
- Bounded cycle analysis
- Junction-object intelligence
- Object Map & Impact
- Blast-radius evidence
- Object Usage & Change Readiness
- Relationship Insights
- Expanded Data Dictionary and architecture-oriented metadata exploration

Architecture Intelligence provides evidence for architectural review. Structural signals are prompts for investigation, not automatic declarations of defects.

### Version 3: Field Usage & Change Impact

Version 3 includes Versions 1 and 2 and adds dependency analysis designed to answer a practical question before a Salesforce field is changed: **what could this change affect?**

- Apex Class and Apex Trigger usage evidence through the Salesforce Tooling API
- Active Flow dependency analysis
- Formula-field dependency analysis
- LWC and Aura field-reference analysis
- Validation Rule field-reference analysis
- Field Usage Map with evidence drill-down
- Field Change Impact analysis
- Improved Data Dictionary and Object Intelligence
- Scheduled and manual Field Usage scans
- Running-task monitoring and scan status
- Durable asynchronous work units for larger environments
- Sparse evidence persistence
- Last-known-good snapshot protection: an incomplete or failed scan does not replace the current successful snapshot
- Diagnostics and environment checks
- System information
- In-product configuration guidance and user help
- **ER Modeller** Lightning tab
- **Diagram Studio User** permission set

> **Important:** An empty Field Usage result is not a guarantee that a field is safe to delete. The Studio reports the evidence it can discover within its documented analysis scope.

## Why use it?

Understanding a mature Salesforce org often means piecing together information from Setup, Schema Builder, source code, Flows, spreadsheets and separate architecture tools. ER Modeller Studio brings those views together so teams can investigate data architecture and change impact from inside Salesforce.

The project is open source and free to use. It is designed to provide enterprise-grade Salesforce data-architecture capabilities without requiring Salesforce metadata or source code to be sent to an external SaaS service for analysis.

See [Business Use Cases](docs/BUSINESS-USE-CASES.md) for practical examples.

## Documentation

The `main` branch represents the current Version 3 release.

| Document | Purpose |
| --- | --- |
| [Installation & Configuration](docs/INSTALLATION.md) | Installation, permissions, Tooling API configuration and verification |
| [Architecture](docs/ARCHITECTURE.md) | Authoritative architecture for ER modelling, Architecture Intelligence and Field Usage Intelligence |
| [DSL Reference](docs/DSL.md) | DSL syntax, examples and language reference |
| [Business Use Cases](docs/BUSINESS-USE-CASES.md) | Practical Salesforce architecture use cases |
| [Security](docs/SECURITY.md) | Security model and Tooling API trust boundary |
| [Version 3 Release Notes](docs/RELEASE-NOTES-V3.md) | Version 3 release scope and capabilities |

Operational guidance and troubleshooting are also available through **Help** inside the Studio.

For documentation corresponding specifically to an older release, use that release's stable branch rather than `main`.

## Stable branches

- [`main`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio) — current release, Version 3
- [`version-3-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-3-stable) — preserved Version 3 stable release line
- [`version-2-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-2-stable) — preserved Version 2 stable release
- [`version-1-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-1-stable) — preserved Version 1 stable release

## Open Source & Licence

Salesforce ER Modeller Studio is released under the **MIT Licence**. See [LICENSE](LICENSE).

Developed and maintained by **Crius Consulting Architects**.  
**Lead Architect & Author: Vikas Cohen**
