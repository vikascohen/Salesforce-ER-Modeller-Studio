# Salesforce ER Modeller Studio — Version 3

**Author: Vikas Cohen**

> **Stable branch:** `version-3-stable`  
> **Salesforce Data Architecture Intelligence, ER Modelling and Field Usage Intelligence.**

> **Security and data boundary:** Salesforce ER Modeller Studio performs its architecture and dependency analysis within the customer's Salesforce environment. Salesforce metadata and source code used for analysis are not exported to an external SaaS platform for processing.

## Install Version 3

Version 3 is released as a Salesforce second-generation unlocked package (2GP), version **3.0.0.2**. The released package was validated by Salesforce with **91% Apex code coverage**.

### Production / Developer Edition

[![Install V3 in Salesforce](https://img.shields.io/badge/Install%20V3-Salesforce-00A1E0?style=for-the-badge&logo=salesforce&logoColor=white)](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY)

### Sandbox

[![Install V3 in Sandbox](https://img.shields.io/badge/Install%20V3-Sandbox-00A1E0?style=for-the-badge&logo=salesforce&logoColor=white)](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY)

Subscriber Package Version ID: `04taj000000imKHAAY`

After installation:

1. Assign the **Diagram Studio User** permission set to each ER Modeller user.
2. Configure the `Salesforce_Tooling_API` Named Credential, External Credential and authenticated principal as described in the installation/configuration documentation and **Help → Configuration**.
3. Open the **ER Modeller** tab.
4. Run **Diagnostics** to verify the environment and Tooling API configuration before running Field Usage scans.

## What Version 3 includes

Version 3 includes the functionality delivered in Version 1 and Version 2 and extends the product with Field Usage and change-impact intelligence.

### ER modelling

- Visual Salesforce ER modelling canvas.
- Automatic Lookup, Master-Detail and polymorphic relationship modelling.
- Drag-and-drop modelling and bidirectional UI/DSL editing.
- DSL import/export and IntelliSense-style modelling support.
- PNG, Mermaid and Draw.io export.
- Point-and-click custom model creation.

### Data Dictionary and object intelligence

- Salesforce object and field exploration.
- Per-object and consolidated Data Dictionary capabilities.
- Field metadata, relationship and usage information.
- Object Intelligence for understanding a selected object's structure and dependencies.
- Schema drift and architecture-oriented metadata exploration.

### Architecture Intelligence

- Architecture overview and structural metrics.
- Object hotspots and connectivity analysis.
- Connected components and isolated-object identification.
- Relationship paths and bounded cycle analysis.
- Junction-object intelligence.
- Object impact and blast-radius views.
- Change-readiness and structural review signals.

Architecture Intelligence provides evidence and review signals; it does not declare architectural defects solely from structural metrics.

### Field Usage Intelligence — Version 3

- Field dependency discovery across supported Salesforce metadata and source artefacts.
- Apex Class and Apex Trigger usage evidence through the Salesforce Tooling API.
- Active Flow dependency analysis.
- Formula-field dependency analysis.
- LWC and Aura field-reference analysis.
- Validation Rule field-reference analysis.
- Field Usage Map with dependency counts and evidence drill-down.
- Field Change Impact for assessing likely impact before changing a Salesforce field.
- Sparse evidence persistence so the current successful snapshot represents detected dependencies without unnecessarily storing every unused field.
- Durable asynchronous work units designed for larger Salesforce environments.
- A failed or incomplete scan does not replace the last successful current snapshot.

An empty Field Usage result is not a guarantee that a field is safe to delete. See the architecture and security documentation for scope and limitations.

### Operations and administration

- Manual Field Usage scans.
- Configurable scheduled scans.
- Running-task monitoring and scan status.
- Persisted scan errors and operational diagnostics.
- System information and environment checks.
- In-product configuration guidance and user help.
- ER Modeller Lightning tab and **Diagram Studio User** permission set.

## Documentation

Version 3 keeps the documentation deliberately consolidated:

- [Version 3 Release Notes](docs/RELEASE-NOTES-V3.md) — Version 3 capabilities and release information.
- [Installation and Configuration](docs/INSTALLATION.md) — installation, permission assignment, Tooling API configuration and verification.
- [Whole-project Architecture](docs/ARCHITECTURE.md) — the authoritative architecture document for ER modelling, Architecture Intelligence, the DSL/Fusion compiler architecture and Field Usage Intelligence.
- [DSL Reference](docs/DSL.md) — DSL syntax, examples and language reference.
- [Business Use Cases](docs/BUSINESS-USE-CASES.md) — why the product is useful in practical Salesforce architecture work.
- [Security](docs/SECURITY.md) — security model and Tooling API trust boundary.
- **In-product Help** — operation, configuration and troubleshooting.

Version 1 and Version 2 stable branches remain available as historical stable releases and are not modified by the Version 3 release.

## Open source

Salesforce ER Modeller Studio is open source and free to use. Version 3 is intended to provide enterprise-grade Salesforce data-architecture capabilities without requiring a commercial SaaS platform for architecture and dependency analysis.

## Contributors

Developed and maintained by **Crius Consulting Architects**.

**Lead Architect & Author: Vikas Cohen**

## License

MIT — see [LICENSE](LICENSE).
