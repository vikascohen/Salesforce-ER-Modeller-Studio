# Salesforce ER Modeller Studio V4 — Release Notes

**Release:** 4.0.0.1
**Date:** 20 October 2026
**Release type:** Separate Salesforce second-generation (2GP) unlocked package
**Status:** Package build successful; sandbox installation and production readiness not yet validated

## Installation

| Target | Installation URL |
| --- | --- |
| Salesforce sandbox | [Install V4 in sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lDjNAAU) |
| Salesforce production | [Install V4 in production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lDjNAAU) |

Both links point to the **same** package version, `04taj000000lDjNAAU`. The login host selects the destination environment; it does not represent a separately compiled production build. Verify the destination org before installing. **Start with a clean sandbox**. The production link is supplied for deployment planning, not an assertion of production readiness.

## Package verification

- Package name: `Salesforce ER Modeller Studio V4`
- Package ID: `0Hoaj0000006YgXCAU`
- Version: `4.0.0.1`
- Subscriber package version: `04taj000000lDjNAAU`
- Package version creation request: `08caj000000IMwXAAW` — **Success**
- Apex code coverage: **88%** — Salesforce coverage gate **passed**
- Packaged metadata files: **238**
- Packaging errors: **0**

## V4 changes

V4 builds on the earlier ER Modeller Studio canvas, data dictionary, schema drift and Field Usage Intelligence features. V4-specific additions include:

- Salesforce Hosted Model Context Protocol (MCP) integration via Apex invocable actions for field usage, changed fields, snapshot status and scan requests.
- MCP settings and administrative guidance for Salesforce server registration, OAuth, permissions and diagnostics.
- Configurable diagnostic logging, session error log and diagnostic indicators.
- Field Usage scanner and batch-processing improvements, including configurable Apex exclusions.
- ER diagram export improvements, including Lucidchart-compatible export support.

Feature implementation does **not** imply external MCP interoperability has passed acceptance testing. See [V4 requirements](V4_REQUIREMENTS.md) and [MCP administration](V4_MCP_ADMIN_GUIDE.md) for known limitations and setup.

## Fixes included in the packaged build

- Reduced expensive object-name resolution in the Field Usage Apex scanner. `FieldUsageApexScannerTest`: **5/5 passed** in the development org.
- Updated `DiagramFileController.getFile()` retrieval and permission handling for the package test environment. `DiagramFileControllerTest`: **16/16 passed** in the development org.
- The subsequent isolated 2GP package build completed successfully with no Apex test failures reported.

## Compatibility and known limitations

- **V3 is unchanged.** V4 is a **separate package**, not an in-place upgrade of V3.
- Because components overlap, **do not assume V3 and V4 can coexist in the same org**. Evaluate migration, metadata ownership and data preservation before changing an existing V3 installation.
- Clean-org installation, post-install smoke tests, permissions and external MCP OAuth/client invocations remain **unverified**.
- The Salesforce Hosted MCP server registration, activation, external client application and secrets require separate configuration in each target org; package installation alone does not establish end-to-end connectivity.
- Do not deploy to a production org until sandbox acceptance and a rollback/migration plan have been completed.

For package build evidence and the metadata archive distinction, see [V4 packaging and verification](V4_PACKAGE_RELEASE.md).
