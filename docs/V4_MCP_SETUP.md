# ER Modeller Studio V4 — Salesforce Hosted MCP setup and verification

**Status (updated 2026-10-20):** Four Apex invocable actions are deployed. Supplied developer-org screenshots show the custom Hosted MCP server **Active** with four registered tools and an active Agentforce Registry entry. A manual Field Usage scan completed with zero errors; full authenticated external MCP acceptance remains pending. Earlier 2026-10-11 validation included 170 passing Apex tests. Salesforce hosts the MCP transport. ER Modeller supplies the intelligence and Apex actions; it does not run a standalone MCP server.

## Architecture and what is reused

External MCP client → Salesforce Hosted MCP custom server → ER Modeller Apex invocable action → existing V3 Field Usage snapshots/evidence. Salesforce handles MCP hosting, discovery and transport. ER Modeller owns tool behaviour, settings, access checks, application logs and Studio-scoped diagnostics. The existing `Salesforce_Tooling_API` Named/External Credential is for **internal metadata collection**; it does not replace an external MCP client's OAuth authentication or External Client App.

## Four implemented Apex tools

| Salesforce action label | Apex class | Purpose |
|---|---|---|
| ER Modeller Get Snapshot Status | `ErMcpGetSnapshotStatus` | Read current stored snapshot and active scan state |
| ER Modeller Get Field Usage | `ErMcpGetFieldUsage` | Read field reference evidence, with bounded cursor pagination |
| ER Modeller Get Changed Fields | `ErMcpGetChangedFields` | Compare dependency evidence across up to five successful snapshots; synchronous limit 40,000 evidence rows |
| ER Modeller Run Scan | `ErMcpRunScan` | Queue existing V3 scan, enforcing scan-operator permission, active-run check and cooldown |

These are deployed **application actions**, not proof of a live MCP endpoint. No standard Salesforce record/schema tools should be added to this custom server.

See also the [V4 administrator walkthrough](V4_MCP_ADMIN_GUIDE.md) based on the 20 October 2026 screenshots.

## Complete setup: from package installation to registered Hosted MCP server

This procedure reconstructs the **actual V4 development-org setup** from the recorded UI observations and the local OAuth/PKCE test scripts. UI labels can vary by Salesforce release. **Do not copy the developer-org endpoint, Consumer Key, token or callback configuration into a different org.** Salesforce-hosted server registration and External Client App configuration are **org-specific**; they are not provisioned merely by installing the V4 package.

### Step 1 — Install and prepare V4

1. Sign in to a **disposable sandbox** as a Salesforce administrator. Install the [V4 4.0.0.1 sandbox package](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lDjNAAU). Use the [production login URL](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000lDjNAAU) only after sandbox acceptance and migration planning. Both point to the same package version.
2. Confirm the package installed successfully and that the ER Modeller Studio app, `ErMcp*` Apex actions, `MCP_Settings__c` and `Diagram_Studio_User` permission set exist. Package build success does not prove a fresh-org installation has been tested.
3. Assign `Diagram_Studio_User` only to the intended administrator/integration identity and verify the identity's effective access. The `ER_MCP_Admin` and `ER_MCP_Scan_Operator` custom permissions are server-side gates; use a separately authorised scan operator for Run Scan.
4. For Field Usage scans, configure the separate `Salesforce_Tooling_API` Named/External Credential and its principal access as described in the Field Usage setup. **This credential is not used by an external MCP client.** Complete or identify an existing successful snapshot before testing the read tools.

### Step 2 — Locate Salesforce Hosted MCP configuration

1. Open **Salesforce Setup** and search **MCP Servers**.
2. In the development-org UI the path was **Integrations → API Catalog → MCP Servers → Salesforce Servers**. Select **Add MCP Server**, then the **custom server** option. Some releases use a different label or menu hierarchy.
3. Create the custom server with a descriptive label such as **ER Modeller Studio**. Record its **actual API/developer name** and Salesforce-generated URL. In the tested development org the path ended in `/custom/ERModellerStudio`; this is an **observed example**, not a URL to reuse in other orgs.
4. Save the server before registering tools. If the custom-server option is absent, verify Salesforce Hosted MCP availability, org permissions and the current Salesforce documentation rather than deploying a separate Linux MCP service.

### Step 3 — Register exactly four Apex invocable actions

Open the new custom server's **Tools** tab and add the following **Apex invocable actions** one at a time. Search by the action label; check the backing Apex class and description before saving each tool.

| Order | Action to select | Apex class | Expected operation |
| --- | --- | --- | --- |
| 1 | ER Modeller Get Snapshot Status | `ErMcpGetSnapshotStatus` | Read latest snapshot and active scan status |
| 2 | ER Modeller Get Field Usage | `ErMcpGetFieldUsage` | Read stored field dependency evidence |
| 3 | ER Modeller Get Changed Fields | `ErMcpGetChangedFields` | Compare stored successful snapshots |
| 4 | ER Modeller Run Scan | `ErMcpRunScan` | Request an asynchronous scan, permission and cooldown permitting |

Verify **exactly four tools** are registered. Do **not** add unrelated Salesforce standard record tools. The Apex classes expose invocable actions; they are not separate network endpoints. If an action is missing, verify its `@InvocableMethod` metadata, package deployment and permissions before proceeding.

### Step 4 — Activate and verify both Salesforce views

1. Activate the custom server in **MCP Servers → Salesforce Servers**. The recorded development-org screen showed **ER Modeller Studio**, **Active**, **4 tools**.
2. Open **Setup → Einstein → Agentforce Registry → Registered MCP Servers**. Find the server and verify that the registry entry is **Active** and exposes the same four tools. This is a **separate confirmation** from the MCP Servers screen.
3. Return to the server's **Details → Authentication Details** and copy the **Server URL generated by Salesforce**. Do not assemble it from a guessed host, domain or server name.
4. Record the server name, four action names and activation state in your org's deployment checklist. Avoid including internal org IDs or endpoints in public screenshots.

**Evidence:** The 20 October 2026 developer-org screenshots previously reviewed showed Active status and four registered tools in Salesforce MCP Servers and an Active Agentforce Registry entry. The actual screenshots of those two Salesforce Setup pages are not yet in this repository; the description is not a substitute for repeating verification in the destination sandbox.

### Step 5 — Configure the external OAuth client

1. In the **target org**, create/configure a Salesforce **External Client App** for the external MCP caller. Enable the OAuth authorisation-code flow and the scopes **`mcp_api`** and, if required for your client, **`refresh_token`**. Follow the capabilities and policies of the current Salesforce Hosted MCP release.
2. For the local Python proof-of-concept used during development, the callback was **`http://localhost:8765/callback`**. Register that **exact** redirect URI only when deliberately using the same local test flow; use your actual client's redirect URI otherwise. Ensure the callback port is free and local browser redirects are permitted.
3. Record the app's **Consumer Key/client ID** securely, outside the repository. Do not commit client secrets, authorisation codes, access/refresh tokens or `.env` files containing credentials. Apply appropriate OAuth policies and authorise only the intended integration user.
4. The local test scripts `er_mcp_snapshot_test.py` and `er_mcp_run_scan.py` (kept outside the repository) used **OAuth authorisation code with PKCE S256**, random `state`, and the scopes `mcp_api refresh_token`. They sent the browser to the org's `/services/oauth2/authorize` endpoint, checked callback state and exchanged the code at `/services/oauth2/token` using the PKCE verifier. These are recorded implementation details, **not evidence every OAuth attempt succeeded**.
5. For each sandbox/production org, obtain the **org-specific** OAuth host, Consumer Key and Salesforce-generated MCP Server URL afresh. Do not hard-code the development org's `orgfarm-...` hostname or `api.salesforce.com` path.

### Step 6 — Configure MCP execution inside ER Modeller

1. Open **ER Modeller Studio → Settings → MCP Server** (or **Help → Configuration → MCP Server Configuration** for the in-app walkthrough).
2. Enable the four switches: **Get Snapshot Status**, **Get Field Usage**, **Get Changed Fields** and **Run Scan**. The Run Scan action still requires scan-operator authorisation.
3. Set **Scan cooldown (hours)**. The recorded screen used **24**. Use **0** only for controlled tests and restore a sensible nonzero value afterwards; manual scans also affect the cooldown.
4. **Save settings.** These switches govern **Apex execution**; they do **not** register, activate or remove Salesforce Hosted MCP tools.

![Four ER Modeller MCP tool execution switches and 24-hour scan cooldown](images/mcp/mcp-tool-controls.png)

*Figure 1. Actual ER Modeller Studio MCP settings screenshot from development.*

### Step 7 — Test MCP OAuth, discovery and invocation

1. Use a compatible external MCP client with the **Salesforce-provided Server URL** and the OAuth configuration from Step 5. The development test scripts used HTTP `POST` with bearer authentication, JSON-RPC 2.0, `Accept: application/json, text/event-stream`, and an MCP protocol version header. They also retained any returned `Mcp-Session-Id` for subsequent calls.
2. Call `initialize`, then `notifications/initialized` as required by the negotiated protocol, and `tools/list`. Confirm the four registered ER Modeller tools. A visible Active status in Salesforce Setup **does not prove** external discovery succeeded.
3. Invoke **Get Snapshot Status** with `tools/call` and compare the snapshot identifier/date with **Studio → Settings → Field Usage**. Then invoke **Get Field Usage** with a bounded request and **Get Changed Fields** using suitable completed snapshots.
4. Test **Run Scan** last, with an authorised operator, no active scan and an appropriate cooldown. The development script supplied an invocation reference such as `ubuntu-mcp-manual-scan`. A previous invocation returned **`Scan cooldown has not elapsed.`** This shows an application-level guard response, **not a completed MCP-triggered scan**.
5. Validate failures for disabled tools, insufficient permissions, no snapshots, invalid cursors, active scans and cooldown. Capture redacted request/response evidence, including timestamps and outcomes, for each acceptance case.

**Observed status:** The manual Field Usage scan on 20 October 2026 completed with **1,756 dependencies and zero errors**. Full external OAuth + `tools/list` + all four successful `tools/call` operations have **not** been recorded as an accepted end-to-end test.

### Step 8 — Configure diagnostics and confirm MCP call history

1. Open **Settings → Error Log Configuration**. Optional persistent history requires an **existing, accessible Salesforce object** and correct field mapping; the package does not automatically create an MCP log object.
2. Choose a **Simple Salesforce Object** or **Custom Logging Structure**, supply actual object/field API names and validate CRUD/FLS, required fields and relationships. Save configuration.
3. Return to **Settings → MCP Server → Last 5 MCP calls**, invoke a tool and select **Refresh calls**. The list queries only the five newest persisted `ER_STUDIO_MODELLER_MCP` entries; it cannot reconstruct history if logging was previously disabled.
4. Open **View → Error Log** for session events or up to 50 persisted records, filter for MCP errors and inspect timestamps, outcomes and technical details. Persistence is best-effort, not an immutable audit trail.

![Custom diagnostic logging configuration](images/mcp/diagnostic-logging-configuration.png)

*Figure 2. Existing Salesforce-object diagnostic logging mapping (example values).*

![Error Log persisted history and technical details](images/mcp/error-log-history.png)

*Figure 3. Error Log history and filters.*

### Step 9 — Sandbox sign-off before production

- [x] Four invocable Apex actions implemented and developer-org Hosted MCP server observed Active with four tools.
- [x] Agentforce Registry entry observed Active in developer-org screenshots.
- [x] Developer-org manual Field Usage scan completed with zero errors.
- [ ] Install V4 in a **fresh sandbox** and verify all required components and permissions.
- [ ] Register/activate a new Hosted MCP custom server and verify the Agentforce Registry in that sandbox.
- [ ] Authenticate from a separate external MCP client and retain redacted `initialize`/`tools/list` evidence.
- [ ] Verify all three read actions against stored snapshot evidence and complete an authorised MCP-initiated scan.
- [ ] Test negative authorisation, disabled-tool, active-scan and cooldown behaviour.
- [ ] Verify optional persisted MCP logs, migration compatibility and rollback before production.

## Implementation inventory

- Shared logic: `ErMcpCore`, `ErMcpFieldUsageService`; four `ErMcp*` invocable actions.
- Configuration and logs: `MCP_Settings__c`, `ErMcpSettingsController`, `ErStudioDiagnosticService`, the shared Studio diagnostic configuration and `erMcpSettings` LWC.
- Permission set: `Diagram_Studio_User` (consolidated MCP administration, reading and scan execution). The `ER_MCP_Admin` and `ER_MCP_Scan_Operator` custom permissions remain internal Apex security gates and are granted by this permission set.
- Diagnostics: failed MCP tool outcomes feed `ErStudioDiagnosticService`, scoped exclusively to ER Modeller Studio. Optional persistence uses an admin-configured existing Salesforce object. See `DIAGNOSTIC_COVERAGE.md`.

## Verified vs not verified

**Verified:** On 2026-10-11, deployment of the MCP object metadata and related Apex classes to `warden-dev` succeeded, with **170 passing Apex tests, zero failures**. The latest V4 source is on `main` and `V4-latest`.

**Not yet fully verified:** External OAuth handshake, MCP tool discovery, successful external read/scan invocations, client app attribution, automated log-retention scheduling, end-to-end permission behaviour and authenticated visual UI checks. No production-readiness claim.

**Known limits:** Changed Fields refuses comparisons above 40,000 evidence rows; Field Usage cursor pagination is tied to the snapshot ID; log CSV covers displayed rows; historical Studio diagnostic events are not reloaded from arbitrary configured objects; logging in a rolled-back transaction may be lost. Snapshot coverage may be incomplete and must not be presented as proof a field is safe to modify.

## Official references

- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/custom-servers.html
- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/invocable-actions.html

MCP invocation diagnostics use the existing opt-in Studio logging configuration. The shared diagnostic message starts with `ER_STUDIO_MODELLER_MCP [HOSTED_MCP / Tool invocation]` to distinguish MCP calls from other Studio logs. V4 does not install a separate MCP log object, log retention scheduler, or dedicated invocation-history table. Successful tool calls emit INFO and failures emit ERROR; only tool name, outcome and duration are logged, not request values. If the chosen severity field has no INFO value, INFO events use its configured warning value.

All other Studio diagnostic messages begin with ER_STUDIO_MODELLER, while MCP messages begin with ER_STUDIO_MODELLER_MCP.

The MCP Settings screen shows up to five recent MCP invocation events from the configured Studio diagnostic object. The Apex query filters for `ER_STUDIO_MODELLER_MCP` and limits the result to five newest records. If no accessible log object is configured, the interface displays a notice instead of querying Studio-wide logs.
