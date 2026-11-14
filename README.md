# Salesforce ER Modeller Studio V5

**By Crius Consulting · Maintainer: Vikas Cohen**

Build Salesforce ER diagrams with a visual canvas and DSL editor. Generate app-scoped models from scan evidence, inspect dependencies, and reuse model definitions across saved files.

## Install the beta

**V5 beta 5.0.0.2** · [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000qMHNAA2) · [Install in Developer Edition](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000qMHNAA2)

Use a clean Salesforce sandbox or Developer Edition org. The [setup guide](docs/SETUP.md) lists the available installer, required permission set and Tooling API configuration.

## Draw your first diagram

1. Assign **Diagram Studio User** and open **ER Modeller**.
2. Open **Help → Diagram Language Reference**. Copy the Contact and Account example into the DSL editor to draw a lookup.
3. Save the file and reopen it. The reference also illustrates master-detail, polymorphic relationships and reusable modules.

## Generate a model from your org

1. Configure **Salesforce_Tooling_API** and its external credential principal in **Help → Configuration**. Run **Settings → Diagnostics** to test the connection.
2. Select **Settings → Field Usage → Run Scan Now**. You can close the tab once the job is queued. The Operational Console shows the current stage when you return.
3. After a successful snapshot, open **File → Generate ER Model from App**. Choose an app and inspect the inclusion evidence in **Model Details**.

**Read access during a scan.** In a supported Industry Cloud sandbox, Developer Edition or active trial, a permission administrator’s manual scan can add eligible missing Read grants to **Diagram Studio User** and run one verification pass. Assigned users can gain access to field values on records they can already read. A manual Health Check only inspects configuration. Remaining skips identify gaps in model coverage.

**Storage.** A Field Usage scan writes work units and evidence records. A small Developer Edition org can exhaust data storage before the final snapshot, even if the initial connection check passes. Check the recorded scan error and available data storage before retrying.

## Documentation

| Task | Guide |
| --- | --- |
| Install, configure credentials or enable optional MCP | [Setup](docs/SETUP.md) |
| Write DSL, import files or diagnose compiler errors | [Language reference](Compiler.md) |
| Understand how Studio discovers and stores evidence | [V5 architecture](docs/ARCHITECTURE.md) |
| Review permissions and data access | [Security](docs/SECURITY.md) |
| Check changes and test evidence | [Release notes](docs/V5_RELEASE_NOTES.md) · [Validation](docs/VALIDATION.md) |

Earlier releases have their own [version branches](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/branches).

## Licence

See [LICENSE](LICENSE).
