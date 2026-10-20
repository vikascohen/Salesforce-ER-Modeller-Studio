# V4 packaging and release verification

**Branch:** `V4-latest` (20 October 2026). Stable V3 remains on `main`.

## Salesforce V4 2GP unlocked package — sandbox and production

**Built successfully on 20 October 2026:** `Salesforce ER Modeller Studio V4` version **4.0.0.1**. Package ID `0Hoaj0000006YgXCAU`; subscriber package version ID `04taj000000lDjNAAU`; packaging request `08caj000000IMwXAAW`. Salesforce packaging reported **Success**, **88% Apex coverage**, coverage check passed, **238 metadata files**, and zero packaging errors. This is a separate V4 package; stable V3 is unchanged.

- **Sandbox installation:** https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lDjNAAU
- **Production installation:** https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lDjNAAU

Both links reference the **same** V4 package version; the domain selects the Salesforce login environment, not a different build. Sign in to the **intended target org** and verify the org name before approving installation. **Production link availability does not mean production readiness:** clean-org installation, post-install regression, permissions, and external Hosted MCP client/OAuth acceptance have not yet been verified. Test in a disposable sandbox first. Installing V4 alongside V3 may cause overlapping component/namespace conflicts; assess replacement and migration before attempting a same-org installation.

## Complete V4 source inventory

The generated `manifest/v4-complete-package.xml` explicitly enumerates all local top-level Salesforce metadata components. The Metadata API distribution at `releases/ER-Modeller-Studio-V4-Metadata-2026-10-20.zip` is converted from **the current working tree** (including uncommitted V4 scanner and exclusion changes), not from a stale Git tag or the old partial `manifest/package.xml`.

| Type | Count |
| --- | ---: |
| Apex classes, including test classes | 61 |
| Custom objects (with contained fields and metadata) | 8 |
| Custom fields (including fields on standard Contact) | 49 |
| Lightning Web Component bundles | 18 |
| Custom permissions | 2 |
| Permission sets | 1 |
| Custom tabs | 1 |
| Static resources | 1 |
| **Total metadata manifest entries** | **141** |

**Intentional exclusion:** The repository also contains `objects/Contact/validationRules/Field_Usage_Test_Contact_Name.validationRule-meta.xml`, an **active test-only Contact validation rule**. It is preserved separately under `releases/v4-optional-test-fixtures/` and deliberately omitted from the distributable: installing it could change Contact record validation in customer orgs. Do not ship this fixture in a production unmanaged package.

The zip is a **deployable Metadata API archive**, separate from the successfully built **second-generation unlocked V4 package** described above. The zip itself does **not** generate a Salesforce installation URL (`04t...` or `04s...`). A first-generation unmanaged package would require a different Salesforce packaging workflow; it is **not** needed for the published V4 2GP unlocked package. The V4 metadata zip is an input for deployment and release review; it is not itself a clickable unmanaged-package installation link.

## Install/validate the metadata archive

From the repository root, with a connected target org:

```bash
sf project deploy validate --metadata-dir releases/v4-unmanaged-mdapi --target-org TARGET_ALIAS --test-level RunLocalTests --wait 60
sf project deploy start --metadata-dir releases/v4-unmanaged-mdapi --target-org TARGET_ALIAS --test-level RunLocalTests --wait 60
```

Deploy to a clean disposable org first. An existing development org can mask missing dependencies. Metadata conversion and a successful developer-org validation do **not** guarantee installation into a clean org. The Salesforce Hosted MCP **server registration/activation**, External Client App, OAuth secrets, Tooling API credentials, user permissions and any optional external diagnostic logging objects require separate target-org setup; those org-level settings and secrets are intentionally not included in this source package.

## Release acceptance

- [x] V4 working-tree source enumerated and converted into a Metadata API archive.
- [x] Apex test classes and `FieldUsageExclusionService` included in the inventory.
- [x] **RunLocalTests passed 1,444/1,444, 0 failures, 0 skipped**, test run `707aj00001Ma5dX` (20 October 2026).
- [ ] Metadata deployment validation **blocked** by pending/in-progress `FieldUsageDiscoveryBatch` job `707aj00001MXjTb` (validation `0Afaj00000oMeq1CAC`). Wait for the job to complete and retry; do not mistake this deployment restriction for an Apex test failure.
- [ ] Clean-org installation and post-install functional tests passed.
- [x] Separate Salesforce V4 2GP unlocked package built successfully; sandbox and production login URLs documented.
- [ ] Install the V4 2GP package in a clean sandbox and verify runtime functionality.
- [ ] External MCP client acceptance passed.

Do not label V4 production-validated until the remaining acceptance checks pass.
