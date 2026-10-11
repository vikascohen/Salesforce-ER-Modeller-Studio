# Salesforce ER Modeller Studio — Version 4 (Development)

**Author and maintainer:** Vikas Cohen

**Branch:** `v4`

**Status:** **UNSTABLE — UNDER ACTIVE DEVELOPMENT AND TESTING**

> **Do not install or use V4 as a stable release or in a production Salesforce org.** V4 is still being developed and tested. Features, contracts and configuration may change, and external MCP connectivity has not yet passed end-to-end acceptance testing.
>
> **Want the stable version?** Switch to the [`main` branch](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/main) and follow its installation instructions for **Version 3**. **Do not install from `v4` if you need a stable release.**

## What Version 4 is about

V4 makes Salesforce ER Modeller Studio's **persisted architectural intelligence available to authorised external systems and AI agents through Salesforce Hosted Model Context Protocol (MCP)**. An integration or AI assistant can query field dependencies and changes before proposing modifications to Salesforce. This is **impact intelligence, not a guarantee that a change is safe**.

Salesforce hosts the MCP server and transport. V4 supplies Apex invocable actions, server-side controls, audit logging, diagnostics and administrator guidance. **No separate Node.js, Linux or self-hosted MCP server is required.**

## Version 4 feature inventory

### 1. Four MCP tools (Apex invocable actions)

| Tool | Feature |
| --- | --- |
| **Get Snapshot Status** | Read the current successful Field Usage snapshot, its identity, completion date, dependency count and queued/running scan status, without launching a scan. |
| **Get Field Usage** | Query stored references for a specified Salesforce object and field. Return detected component references, evidence and provenance, with bounded, snapshot-aware cursor pagination. |
| **Get Changed Fields** | Compare field-dependency evidence across up to **five recent completed scans**. Identify added/removed references and unchanged comparisons. Synchronous comparison is limited to **40,000 evidence rows**. |
| **Run Scan** | Request an asynchronous Field Usage scan using the existing scanning pipeline. Enforce scan-operator permission, prevent overlapping scans and apply an administrator-configured cooldown. |

### 2. Salesforce Hosted MCP integration

- Four registered-ready Apex actions designed for a **custom Salesforce Hosted MCP server**.
- Administrator-managed tool registration, server activation and endpoint URL in Salesforce Setup.
- External-client authentication through a Salesforce **External Client App** and the `mcp_api` OAuth scope.
- Separate credentials for external MCP clients and the internal `Salesforce_Tooling_API` Named Credential used to collect metadata.
- No generic Salesforce record-access tools added by ER Modeller.

**Important:** The Apex actions have been deployed and tested in a development org, but the custom Hosted MCP server has **not** yet been confirmed activated or exercised through a real external MCP client. The server is not automatically created by installing V4.

### 3. MCP Settings in Studio

- **Settings → MCP Server** workspace.
- Independent server-enforced enable/disable switches for the four MCP actions.
- Configurable scan cooldown in hours.
- Diagnostic retention managed by the configured Salesforce logging object, not MCP Settings.
- Unified Studio diagnostics instead of a dedicated MCP call-log table.
- Explicit guidance distinguishing installed Apex tools, Salesforce server activation and external OAuth connectivity. These external states are **not automatically verified** by the Settings page.

### 4. Permissions and execution safeguards

- One **`Diagram_Studio_User`** permission set containing MCP class, object, field and custom-permission access. Assign only to trusted users: the consolidated set permits MCP administration and scan initiation.
- Permission checks and server-side tool enablement enforcement.
- Rejection of disabled tools, unauthorised scan requests, overlapping scans and scan requests inside the cooldown period.
- Input validation, bounded query results, pagination and defensive errors.
- Snapshot-based reads: read-only MCP tools use persisted evidence rather than initiating live scans.

### 5. Unified Studio diagnostics for MCP

- MCP invocations use the existing Studio diagnostic service, **not a dedicated MCP log object**. Every MCP entry is prefixed **`ER_STUDIO_MODELLER_MCP [HOSTED_MCP / Tool invocation]`** in the shared message field so administrators can filter MCP records.
- Events include tool name, outcome and elapsed milliseconds; request values and raw error details are not persisted by this integration.
- Configure an existing Salesforce object in **Settings → Diagnostics** to opt in to persistent events. With persistence disabled, no durable MCP call history is kept.
- Successful calls are emitted as `INFO`; errors as `ERROR`. If a configured severity field supports only ERROR/WARN values, INFO events use the configured warning value; distinguish the event level in the message.
- No MCP-specific retention setting, log table, CSV export or retention batch is installed. Retention follows the administrator's chosen diagnostic object policy.
- Best-effort persistence is subject to Salesforce transaction rollback and permissions; it is not a tamper-proof audit trail.

### 6. Studio diagnostics and error visibility

- Studio-scoped diagnostic events for relevant MCP, Field Usage and UI failures.
- Central diagnostic handling through `ErStudioDiagnosticService`.
- Configurable optional persistence to an administrator-selected existing Salesforce logging object.
- Studio Settings diagnostics controls and a session Error Log view.
- Clear distinction between session errors and historical persisted logs: the session Error Log **does not automatically reload** records from the configured logging object.

### 7. In-product setup and help

- **Help → Configuration → MCP Server Configuration:** dedicated Hosted MCP administrator walkthrough.
- **Help → Configuration → Field Usage / Tooling API:** separate internal scanner connection guidance.
- Instructions for tool registration, activation, permissions, OAuth, endpoint discovery, testing and troubleshooting.
- [Detailed Salesforce Hosted MCP setup guide](docs/V4_MCP_SETUP.md).
- [V4 requirements, scope and acceptance tracker](docs/V4_REQUIREMENTS.md).
- [Diagnostic coverage and limitations](docs/DIAGNOSTIC_COVERAGE.md).

### 8. Tests and development validation

- Dedicated Apex regression tests for MCP action responses, snapshots, dependency comparisons, pagination, disabled tools, permissions, scan cooldown, concurrent scan rejection, settings and diagnostic dispatch.
- Latest full Apex coverage run in development org `warden-dev`: **183/183 tests passed**, **86% org-wide coverage**, **87% test-run coverage**. The obsolete `ErMcpLogRetention` class was removed; individual coverage must be read from the current test run.
- Latest JavaScript regression: **177 Jest tests passed**, **10 skipped**, across 30 passing suites.
- These results demonstrate code-level testing; they **do not establish production readiness or successful external MCP interoperability**.

## Still in development / not yet accepted

- Creation, activation and real-client verification of the Salesforce Hosted MCP custom server.
- Authenticated external `tools/list` and `tools/call` requests for all four tools.
- End-to-end permission and OAuth checks using actual integration users.
- Diagnostic persistence and rollback behaviour, and large-scale snapshot comparisons under real operating conditions.
- Browser-level acceptance and full operational verification.

Additional MCP tools and architecture rule engines are **not part of the currently implemented V4 feature set**. See the requirements tracker for proposals and unresolved decisions; they must not be mistaken for shipped features.

## Stable release

**For a stable installation, use [the `main` branch](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/main) and install Version 3 following its README.** This `v4` branch is exclusively for ongoing development and testing.

## Licence

See [LICENSE](LICENSE) for the repository licence.

All other Studio diagnostic messages begin with ER_STUDIO_MODELLER, while MCP messages begin with ER_STUDIO_MODELLER_MCP.
