# V5 installation and administration

**Crius Consulting · Updated 14 November 2026**

## Choose the distribution

| Distribution | When to use it |
| --- | --- |
| Released unlocked 2GP installer | Install V5 in production, Developer Edition or a sandbox. See the [build results](VALIDATION.md) for its coverage and build ID. |
| v5-Beta source | Deploy an exact revision to a development org using the complete manifest. |

**V5 release 5.0.0.4** · [Install in production or Developer Edition](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000qN5NAAU) · [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000qN5NAAU)

## First installation

1. Choose the installer for the target environment, confirm the org and version, and install for admins only.
2. In **Setup → Permission Sets**, assign **Diagram Studio User** to the Studio user.
3. Open the **ER Modeller** tab. Verify a simple diagram can be created, saved and reopened.
4. For scanning, complete **Help → Configuration → Tooling API**, grant External Credential Principal Access, and run **Settings → Diagnostics**.
5. Run **Org Scan** and wait for a successful snapshot before app-based generation. Check storage first in small Developer Edition orgs.

The editor, compiler and canvas do not require a scan. OAuth credentials are specific to each target org and are not transferred by installation.

## Tooling API authentication

The app expects the Named Credential **`Salesforce_Tooling_API`**. Configure its External Credential, authentication provider and principal using the installed **Help → Configuration** walkthrough. The named principal must have the required Salesforce metadata/source access; users also need access to use that principal.

Use the target org's actual My Domain, not its Setup hostname:

```text
Named Credential URL: https://<target-my-domain>.my.salesforce.com
Authorization endpoint: https://<target-my-domain>.my.salesforce.com/services/oauth2/authorize
Token endpoint: https://<target-my-domain>.my.salesforce.com/services/oauth2/token
```

For a developer domain, include the full domain prefix, including `.develop` when present. Copy the Auth Provider callback URL Salesforce generates into the OAuth application's permitted callback configuration. Authenticate the principal after saving, then rerun Diagnostics. Never commit client secrets, access/refresh tokens, session IDs or passwords.

If the page loads but scanning fails, check authentication, API permissions and External Credential Principal Access before rerunning. `STORAGE_LIMIT_EXCEEDED` needs storage investigation; retrying a full scan can refill a small allowance. Inspect the run's error details and Salesforce job status for worker rollbacks.

## Generate a model from an app

1. Save or close unsaved work. Choose **File → Generate ER Model from App**.
2. Choose **Salesforce app**, filter custom/standard/all apps and select the intended app. Or choose a standalone **Lightning tab / component** root.
3. In the newer source, **Include fields configured on app pages** is enabled by default for apps. It adds explicit assigned-page fields and readable navigation layouts. Default layouts use the Tooling API principal and its default record type, can be shared across apps, and are configuration evidence rather than runtime observations. Turn it off for component-source fields alone.
4. Optionally include object-triggered automation and named Apex/Flow cards. **Show permission set and licence names as access cards** applies to Salesforce app sources, not standalone components.
5. Generate, inspect warnings/evidence, and compare the resulting DSL and canvas before saving.

Name, audit and relationship fields need field evidence; Id remains structural. The generator never substitutes all object fields when evidence is missing. Unsupported Salesforce screens/layouts and inaccessible/dynamic source can remain unresolved. Page configuration is read live with its own provenance; component references use the scan snapshot. Refresh imports after saving shared library edits. See [Compiler.md](../Compiler.md) for modules and syntax.

The card options request discovery, not guaranteed nonzero cards. Generation shows a compact, dismissible result above the workspace. Detailed Apex/Flow and access counts remain in Model Details and DSL comments; inclusion reasons open expanded with a visible disclosure indicator. Sales can return no readable Apex/Flow references or explicit permission-set/licence records; this is different from hiding returned cards.

Named access cards describe explicit app visibility/reached Apex grants and actual licence/package references. They do not prove mandatory assignments or every access route. Security/licensing schema tables are not a substitute for named cards.

## Optional Salesforce Hosted MCP

Salesforce hosts the server. No standalone Linux/Node MCP service is included.

| Tool/action class | Purpose |
| --- | --- |
| `ErMcpGetSnapshotStatus` | Current successful snapshot and active scan status |
| `ErMcpGetFieldUsage` | Bounded stored field-reference evidence |
| `ErMcpGetChangedFields` | Changes between successful snapshots |
| `ErMcpRunScan` | Authorised asynchronous scan request |

In Salesforce Setup, register these four invocable actions in a custom **MCP Server** and activate it. Copy the server URL from Salesforce's Authentication Details rather than constructing one. Configure the external client's External Client App/OAuth permissions, including the supported MCP scope, and verify tool discovery and read calls before enabling scan requests. Setup labels can vary by Salesforce release; the installed **Help → Configuration → MCP** guide provides the walkthrough.

In **Settings → MCP Server**, action switches control execution and cooldown controls scan initiation. These switches do not register or unregister Salesforce tools. Manual scans also affect cooldown. The outbound Tooling API credential and the external MCP client's OAuth configuration are separate.

## Diagnostics and logging

Run **Settings → Diagnostics** after credential or permission changes. Current editor validation clears when corrected; the Error Log badge represents recorded operation history. Optional logging maps to an existing object chosen in **Error Log Configuration**. It is Studio-scoped, best-effort and can be rolled back with a failed transaction; it is not org-wide monitoring or a tamper-proof audit trail.

After a Field Usage scan, open **ER Modeller Studio Health Check → Scan Metadata Access**. The check reports skips from the latest scan under **SCAN_SKIP:&lt;run ID&gt;**. Older scans lack structured skip records. A new scan collects those results. Unavailable objects and fields are skipped while readable metadata continues through the scan.

**Review skipped objects** lists the objects recorded for that run. Select all or individual objects and choose **Review selected objects** to see the exact fields. **Apply Fix** appears after a complete review with an eligible change. Changing the selection requires another review. Supported Read fixes target only reviewed skips. Platform or licence restrictions can remain. After applying, run another scan to measure coverage again.

The update targets **Diagram Studio User**. An administrator needs Manage Profiles and Permission Sets and Customize Application. The progress bar tracks completed requests, the result list identifies each outcome and a fresh Health Check runs after the update. Stopping leaves completed batches in place. Selecting a field can require Object Read on its parent. Read permissions can expose field values on records available through existing sharing to everyone assigned the permission set. The diagnostic and access preview read metadata only.

Health Check reports current prerequisites and the latest scan or Apex job status. A complete scan may encounter additional errors. The Field Usage Operational Console displays a scan failure alert with **Open Error Log**. An observed failure enters the session log and is sent to the configured persistent logger when available. The scan run and work records retain the background history independently.

For support, capture the exact error, source/package version, Diagnostics result and scan/job identity. Never include authentication material. Preserve useful error detail before requesting cleanup.

## Source deployment and package builds

From Ubuntu, use a dedicated checkout and the intended test-org alias:

```bash
git clone --branch v5-Beta --single-branch https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git er-modeller-v5
cd er-modeller-v5
sf org login web --alias v5-test
sf project deploy start --manifest manifest/v5-complete-package.xml --target-org v5-test --test-level RunLocalTests --wait 60
sf org assign permset --name Diagram_Studio_User --target-org v5-test
```

Do not deploy overlapping source over an installed package without a tested plan. The complete manifest includes the app-page service/test classes and excludes the test-only Contact validation rule through `.forceignore`.

The V5 package container is **`0Hoaj0000006uM5CAI`**. Build a new validated version from current source:

```bash
sf package version create --package 0Hoaj0000006uM5CAI --version-name "Crius Consulting V5" --version-number 5.0.0.NEXT --version-description "Salesforce ER Modeller Studio V5 by Crius Consulting." --installation-key-bypass --code-coverage --wait 120 --target-dev-hub crius-devhub
```

The package-directory `apexTestAccess.permissionSets` setting assigns `Diagram_Studio_User` to the packaging test user so user-mode import queries can read canonical filename/binding fields. It does not weaken runtime security or automatically grant subscriber users access. Do not skip validation. Verify coverage, beta status, clean-org installation and the installed workflow before promotion.

See [release notes](V5_RELEASE_NOTES.md), [architecture](ARCHITECTURE.md), [security](SECURITY.md) and [current validation](VALIDATION.md).
