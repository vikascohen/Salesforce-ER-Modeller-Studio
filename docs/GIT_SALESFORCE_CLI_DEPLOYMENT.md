# V5 installation, configuration and source deployment

**Crius Consulting · Maintainer: Vikas Cohen**

For the beta installer, use [V5 package installation](V5_PACKAGE_RELEASE.md). The source branch is `v5-Beta`; older versions remain on their own stable branches.

## Install and configure

1. Install V5 in a clean test org using the package guide. Do not assume it can coexist with a separately owned older package.
2. Assign **Diagram Studio User** under **Setup → Permission Sets → Manage Assignments**.
3. Open **ER Modeller → Help → Configuration** and configure the `Salesforce_Tooling_API` Named/External Credential for this target org. Grant the testing user External Credential Principal Access. Creating the credential alone is insufficient.
4. Run **Settings → Diagnostics**, then run **Org Scan** when the metadata connection passes. The editor and canvas can be used without scanning.
5. Verify save/reopen, DSL module/import use, app generation, canvas/DSL agreement and exports. Review small Developer Edition storage limits before retaining multiple snapshots.

Credentials are org-specific and are not transferred by the installer. Never commit passwords, tokens, session IDs or client secrets. See [security](SECURITY.md), [app modelling](V5_APP_MODELLING.md) and the in-product Configuration guide.

## Optional source deployment with Salesforce CLI

Use a separate development/test org rather than overwriting an installed package without a tested plan.

```bash
git clone --branch v5-Beta --single-branch https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git er-modeller-v5
cd er-modeller-v5
sf org login web --alias v5-test
sf project deploy start --manifest manifest/v5-complete-package.xml --target-org v5-test --test-level RunLocalTests --wait 60
sf org assign permset --name Diagram_Studio_User --target-org v5-test
```

Confirm the intended org identity before deployment. A successful source deployment does not configure OAuth or establish installed-package acceptance. The V5 manifest and `.forceignore` exclude the test-only Contact validation rule from distribution.

For compiler documentation, visit [Compiler.md](../Compiler.md). For the V5 feature list, see [release notes](V5_RELEASE_NOTES.md). Optional Salesforce Hosted MCP setup is documented separately in the [MCP administrator guide](MCP_ADMIN_GUIDE.md).
