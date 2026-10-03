# Salesforce ER Modeller Studio — Architecture Intelligence Refactor

**Author: Vikas Cohen**

> **Development branch:** `architecture-intelligence-refactor`  
> **Version 3 Field Usage Intelligence plus the Architecture Intelligence refactor.**

[![Deploy Refactor to Salesforce](https://img.shields.io/badge/Deploy%20Refactor-Salesforce-00A1E0?style=for-the-badge&logo=salesforce&logoColor=white)](https://githubsfdeploy.herokuapp.com/app/githubdeploy/vikascohen/Salesforce-ER-Modeller-Studio?ref=architecture-intelligence-refactor&continue)

> The deploy button above targets only the `architecture-intelligence-refactor` branch. This branch was created from `version-3-field-usage-intelligence`, so it contains the Version 3 code plus the Architecture Intelligence refactor.

## What this branch contains

ER Modeller Studio combines visual Salesforce ER modelling, DSL-driven modelling, Data Dictionary/schema exploration, Architecture Intelligence and Version 3 Field Usage dependency intelligence. Version 3 adds asynchronous field-dependency scanning, Field Usage maps, Field Change Impact, scheduling/operations, diagnostics and richer selected-object intelligence.

## Documentation

- [Version 3 Features](docs/VERSION-3-FEATURES.md) — current feature catalogue.
- [Whole-project Architecture](docs/ARCHITECTURE.md) — end-to-end architecture, diagrams, philosophy and modularity.
- [Field Usage Architecture](docs/FIELD_USAGE_ARCHITECTURE.md) — detailed Version 3 scanner/batch/snapshot design.
- [DSL Reference](docs/DSL.md) — modelling language reference.
- [DSL Compiler Architecture](docs/dsl-compiler-architecture.md) — compiler internals.
- [Security](docs/SECURITY.md) — current Version 3 security and Tooling API trust boundary.
- [Architecture Intelligence Refactor](docs/architecture-intelligence-refactor.md) — refactor-specific design notes.

Historical Version 2 documentation remains under `docs/` and is intentionally not duplicated into the Version 3 documents.

## Deployment requirement: Tooling API Named Credential

Version 3 Field Usage and selected metadata-intelligence capabilities require the Salesforce Named Credential `Salesforce_Tooling_API` and the corresponding External Credential / principal configuration. Use **Help → Configuration** inside the Studio for the current operational setup and troubleshooting steps.

## Contributors

Developed and maintained by **Crius Consulting Architects**.

**Lead Architect & Author: Vikas Cohen**

## License

MIT — see [LICENSE](LICENSE).
