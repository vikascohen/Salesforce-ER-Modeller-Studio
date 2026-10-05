# Salesforce ER Modeller Studio — Version 3 Beta

**Author: Vikas Cohen**

> **Beta testing branch:** `v3-beta-testing`  
> **Version 3 Field Usage Intelligence plus Architecture Intelligence and the complete ER modelling platform.**

> **Security and data boundary:** Salesforce ER Modeller Studio performs its architecture and dependency analysis within the customer's Salesforce environment. Salesforce metadata and source code used for analysis are not exported to an external SaaS platform for processing.

[![Deploy V3 Beta to Salesforce](https://img.shields.io/badge/Deploy%20V3%20Beta-Salesforce-00A1E0?style=for-the-badge&logo=salesforce&logoColor=white)](https://githubsfdeploy.herokuapp.com/app/githubdeploy/vikascohen/Salesforce-ER-Modeller-Studio?ref=v3-beta-testing&continue)

> The deploy button above targets only the `v3-beta-testing` branch. Use it for Version 3 beta installation and clean-org testing. Version 1 and Version 2 stable branches are unaffected.

## What this branch contains

ER Modeller Studio combines visual Salesforce ER modelling, DSL-driven modelling, Data Dictionary/schema exploration, Architecture Intelligence and Version 3 Field Usage dependency intelligence. Version 3 carries forward the Version 1 and Version 2 capabilities and adds asynchronous field-dependency scanning, Field Usage maps, Field Change Impact, scheduling/operations, diagnostics and richer selected-object intelligence.

## Documentation

The Version 3 documentation is intentionally small and avoids overlapping architecture documents.

- [Version 3 Beta Release Notes](docs/RELEASE-NOTES-V3.md) — what V3 contains, what is retained from V1/V2, deployment requirements and the beta validation sequence.
- [Whole-project Architecture](docs/ARCHITECTURE.md) — the single authoritative architecture document for the complete product, including the ER DSL compiler architecture and V3 Field Usage architecture.
- [DSL Reference](docs/DSL.md) — DSL syntax, examples and language reference.
- [Security](docs/SECURITY.md) — security model and Tooling API trust boundary.
- **In-product Help** — user operation, configuration and troubleshooting.

Historical Version 2 documentation remains under `docs/` and is intentionally not duplicated into Version 3 documentation. Version 1 and Version 2 stable branches remain untouched.

## Deployment requirement: Tooling API Named Credential

Version 3 Field Usage and selected metadata-intelligence capabilities require the Salesforce Named Credential `Salesforce_Tooling_API` and the corresponding External Credential / principal configuration. Use **Help → Configuration** inside the Studio for the current operational setup and troubleshooting steps.

## Contributors

Developed and maintained by **Crius Consulting Architects**.

**Lead Architect & Author: Vikas Cohen**

## License

MIT — see [LICENSE](LICENSE).
