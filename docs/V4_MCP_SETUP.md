# ER Modeller Studio V4 — Salesforce Hosted MCP setup and verification

**Status (2026-10-11):** Four Apex invocable actions and MCP object metadata deployed successfully to `warden-dev`; 170 Apex tests passed. **No verified external MCP client invocation or activated custom server yet.** Salesforce hosts the MCP transport. ER Modeller supplies the intelligence and Apex actions; it does not run a standalone MCP server.

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

## Administrator setup in Salesforce

1. Use an authorised development org with V4 Apex, objects, fields, permission sets and dependencies deployed. `warden-dev` is the current validation org. Assign `Diagram_Studio_User` only to trusted users. It consolidates MCP administration, reading and scan execution. Verify effective object/field access and the MCP server's own tool access.
2. In **Salesforce Setup**, locate **Salesforce MCP Servers** (menu placement can vary by release). Create a **custom** Hosted MCP server for ER Modeller, following Salesforce's current custom-server guide. Do not deploy or run a separate server on Linux.
3. Add the four named **Apex invocable actions** as tools. Start with the read-only **Get Snapshot Status** tool for smoke testing. Do not include Salesforce's standard record tools. Save and activate the custom server.
4. Obtain the actual MCP server URL from Salesforce Setup; do not invent or hard-code an endpoint. If the feature or actions are unavailable, check edition, feature availability, permissions and Salesforce's current Hosted MCP prerequisites.
5. Create/configure an **External Client App** for the external caller, with Salesforce-supported OAuth authorisation and `mcp_api` scope. Follow Salesforce's current client authentication guide; protect secrets and use an appropriate integration identity. A Tooling API Named Credential is **not** an external MCP client credential.
6. In ER Modeller Studio, open **Help → Configuration → MCP Server Configuration** for the complete administrator walkthrough. Use **Settings → MCP Server** for tool execution switches, scan cooldown and invocation logs. Settings does **not** confirm server activation or external OAuth connectivity, and it does not create Salesforce's custom MCP server.
7. From an authorised MCP client, connect to the URL, perform tool discovery (`tools/list`), invoke **Get Snapshot Status** (`tools/call`) and compare the returned snapshot ID/date with the Studio. Then test Field Usage, Changed Fields and Run Scan with deliberately bounded test data and a scan-authorised user.
8. Verify rejection of unauthorised/disabled tools, missing snapshots, invalid cursors, cooldown and active-scan conflicts. Check the configured Studio diagnostic object (if enabled); do not infer success from Apex unit tests alone.

## Implementation inventory

- Shared logic: `ErMcpCore`, `ErMcpFieldUsageService`; four `ErMcp*` invocable actions.
- Configuration and logs: `MCP_Settings__c`, `ErMcpSettingsController`, `ErStudioDiagnosticService`, the shared Studio diagnostic configuration and `erMcpSettings` LWC.
- Permission set: `Diagram_Studio_User` (consolidated MCP administration, reading and scan execution). The `ER_MCP_Admin` and `ER_MCP_Scan_Operator` custom permissions remain internal Apex security gates and are granted by this permission set.
- Diagnostics: failed MCP tool outcomes feed `ErStudioDiagnosticService`, scoped exclusively to ER Modeller Studio. Optional persistence uses an admin-configured existing Salesforce object. See `DIAGNOSTIC_COVERAGE.md`.

## Verified vs not verified

**Verified:** On 2026-10-11, deployment of the MCP object metadata and related Apex classes to `warden-dev` succeeded, with **170 passing Apex tests, zero failures**. The source remains on branch `v4`.

**Not verified:** A custom Hosted MCP server's creation/activation, external OAuth handshake, MCP tool discovery, external invocation, client app attribution, automated log-retention scheduling, end-to-end permission behaviour and authenticated visual UI checks. No production-readiness claim.

**Known limits:** Changed Fields refuses comparisons above 40,000 evidence rows; Field Usage cursor pagination is tied to the snapshot ID; log CSV covers displayed rows; historical Studio diagnostic events are not reloaded from arbitrary configured objects; logging in a rolled-back transaction may be lost. Snapshot coverage may be incomplete and must not be presented as proof a field is safe to modify.

## Official references

- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/custom-servers.html
- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/invocable-actions.html

MCP invocation diagnostics use the existing opt-in Studio logging configuration. The shared diagnostic message starts with `ER_STUDIO_MODELLER_MCP [HOSTED_MCP / Tool invocation]` to distinguish MCP calls from other Studio logs. V4 does not install a separate MCP log object, log retention scheduler, or dedicated invocation-history table. Successful tool calls emit INFO and failures emit ERROR; only tool name, outcome and duration are logged, not request values. If the chosen severity field has no INFO value, INFO events use its configured warning value.

All other Studio diagnostic messages begin with ER_STUDIO_MODELLER, while MCP messages begin with ER_STUDIO_MODELLER_MCP.
