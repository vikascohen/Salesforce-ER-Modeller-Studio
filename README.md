# Salesforce ER Modeller Studio — Version 3

**Salesforce Data Architecture Intelligence & ER Modelling**  
**Open source. Free to use. Built for Salesforce architects, developers and platform teams.**

Salesforce ER Modeller Studio helps teams understand the structure, relationships and dependencies in a Salesforce org before making change. Version 3 combines visual ER modelling, Data Dictionary, Object Intelligence, Architecture Intelligence and Field Usage Intelligence in one Salesforce-native tool.

> **Security boundary:** Analysis is performed within the customer's Salesforce environment. Salesforce metadata and source code used by the Studio are not exported to an external SaaS platform for processing.

## Install Version 3

Version **3.0.0.2** is released as a Salesforce second-generation unlocked package (2GP) and was validated with **91% Apex code coverage**.

| Environment | Install |
| --- | --- |
| Production / Developer Edition | [Install Version 3](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY) |
| Sandbox | [Install Version 3 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY) |

**Subscriber Package Version ID:** `04taj000000imKHAAY`

### After installation

1. Assign the **Diagram Studio User** permission set to ER Modeller users.
2. Configure the **Salesforce Tooling API** Named Credential, External Credential and authenticated principal. See [Installation and Configuration](docs/INSTALLATION.md) or **Help → Configuration** inside the Studio.
3. Open the **ER Modeller** tab.
4. Run **Diagnostics** to verify the environment before running Field Usage scans.

## What's included

Version 3 includes the capabilities delivered in Versions 1 and 2 and adds Field Usage and change-impact intelligence.

### ER Modelling

- Visual Salesforce ER modelling canvas
- Automatic Lookup, Master-Detail and polymorphic relationship modelling
- Drag-and-drop modelling
- Bidirectional visual ↔ DSL modelling
- DSL import/export and editor assistance
- Point-and-click custom model creation
- PNG, Mermaid and Draw.io export

### Data Dictionary & Object Intelligence

- Salesforce object and field exploration
- Per-object and consolidated Data Dictionary
- Field metadata, relationship and usage information
- Selected-object structural and dependency intelligence
- Schema drift and architecture-oriented metadata exploration

### Architecture Intelligence

- Architecture overview and structural metrics
- Object hotspots and connectivity analysis
- Connected components and isolated objects
- Relationship Path Finder
- Bounded cycle analysis
- Junction-object intelligence
- Object impact and blast-radius views
- Change-readiness and structural review signals

Architecture Intelligence provides evidence for architectural review. Structural signals are prompts for investigation, not automatic declarations of defects.

### Field Usage Intelligence

Version 3 adds dependency analysis designed to help answer a practical question before a field is changed: **what could this change affect?**

- Apex Class and Apex Trigger usage evidence
- Active Flow dependency analysis
- Formula-field dependency analysis
- LWC and Aura field-reference analysis
- Validation Rule field-reference analysis
- Field Usage Map with evidence drill-down
- Field Change Impact analysis
- Scheduled and manual scans
- Durable asynchronous work units for larger environments
- Sparse evidence persistence
- Last-known-good snapshot protection: an incomplete or failed scan does not replace the current successful snapshot

> **Important:** An empty Field Usage result is not a guarantee that a field is safe to delete. See [Architecture](docs/ARCHITECTURE.md) for analysis scope and limitations.

### Operations & Administration

- Configurable scan schedules
- Running-task monitoring
- Scan status and persisted error information
- Diagnostics and environment checks
- System information
- In-product configuration guidance and user help
- **ER Modeller** Lightning tab
- **Diagram Studio User** permission set

## Why use it?

Understanding a mature Salesforce org often means piecing together information from Setup, Schema Builder, source code, Flows, spreadsheets and separate architecture tools. ER Modeller Studio brings those views together so teams can investigate architecture and change impact from inside Salesforce.

The project is open source and free to use. It is designed to provide enterprise-grade data-architecture capabilities without requiring Salesforce metadata or source code to be sent to an external SaaS service for analysis.

See [Business Use Cases](docs/BUSINESS-USE-CASES.md) for practical examples.

## Documentation

| Document | Purpose |
| --- | --- |
| [Installation & Configuration](docs/INSTALLATION.md) | Package installation, permissions, Tooling API configuration and verification |
| [Architecture](docs/ARCHITECTURE.md) | Authoritative architecture for the Studio, DSL/compiler, Architecture Intelligence and Field Usage |
| [DSL Reference](docs/DSL.md) | DSL syntax, examples and language reference |
| [Business Use Cases](docs/BUSINESS-USE-CASES.md) | Practical Salesforce architecture use cases |
| [Security](docs/SECURITY.md) | Security model and Tooling API trust boundary |
| [Version 3 Release Notes](docs/RELEASE-NOTES-V3.md) | Version 3 release scope and capabilities |

Operational guidance and troubleshooting are also available through **Help** inside the Studio.

## Previous versions

Version 1 and Version 2 stable branches remain available as historical releases. Version 3 is the current stable release.

## Open Source & Licence

Salesforce ER Modeller Studio is released under the **MIT Licence**. See [LICENSE](LICENSE).

Developed and maintained by **Crius Consulting Architects**.  
**Lead Architect & Author: Vikas Cohen**
