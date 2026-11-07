# Crius Consulting V5 packaging

## Beta build — 8 November 2026

**Success:** version **5.0.0.1**, subscriber version **`04taj000000pMsvAAE`**, request `08caj000000JMEXAA4`. Salesforce reported **91% Apex coverage**, coverage gate passed, **268 metadata files**, and no packaging errors. This is a beta build, not a production release.

- [Install V5 beta in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000pMsvAAE)
- [Install V5 beta in a Developer Edition/test org](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000pMsvAAE)

The login.salesforce.com domain is also used by Developer Edition orgs; this link does not make beta versions eligible for production installation. Use a clean disposable target, verify the org identity, and install for admins first. Do not install alongside V4 without a tested migration plan. No clean-org package-install acceptance or promotion is claimed.


Package: **Crius Consulting - Salesforce ER Modeller Studio V5** (`0Hoaj0000006uM5CAI`), second-generation unlocked, without a namespace. This is separate from V4 and is not a verified in-place upgrade; overlapping package-owned metadata requires a migration plan.

## Packaging test permissions

The initial V5 version build failed two `DslFileServiceTest` methods with `No such column File_Key__c`. The field is included in source. `DslFileService.resolveDirect` uses `WITH USER_MODE`; the clean packaging test user needs the shipped `Diagram_Studio_User` permission set to read canonical filenames and import bindings. The package directory now declares:

```json
"apexTestAccess": {
  "permissionSets": ["Diagram_Studio_User"]
}
```

This assigns permissions to the package-build test user. It does not disable field-level security or sharing checks, remove tests, or automatically assign access to subscriber users. Salesforce documents this setting in [Apex access for unlocked-package tests](https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-unlocked-pkg-unpackaged-md.html).

## Build

From the repository root:

```bash
sf package version create --package 0Hoaj0000006uM5CAI --version-name "Crius Consulting V5" --version-number 5.0.0.NEXT --version-description "Salesforce ER Modeller Studio V5 by Crius Consulting." --installation-key-bypass --code-coverage --wait 120 --target-dev-hub crius-devhub
```

Do not skip validation. Verify the resulting subscriber version ID, code coverage gate and beta status before sharing an installation link. Clean-org installation, permission assignment, scanner credentials and functional acceptance remain separate from a passing package build.

After installing in a disposable target org, assign access explicitly:

```bash
sf org assign permset --name Diagram_Studio_User --target-org TEST_ORG_ALIAS
```

Do not promote or attempt a V4 migration until the installed package has been tested.
