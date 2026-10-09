# ER Modeller V4 — Salesforce Hosted MCP setup (draft)

**Status: not yet deployed or tested against a Salesforce org.** Salesforce hosts the MCP endpoint; this repository does not contain a self-hosted MCP server.

## Initial available Apex tools
- **ER Modeller Get Snapshot Status** — `ErMcpGetSnapshotStatus` (read-only stored snapshot state)
- **ER Modeller Get Field Usage** — `ErMcpGetFieldUsage` (read-only current evidence, cursor pagination using afterEvidenceId and pageSize (maximum 200 per call))

**Not yet available:** Get Changed Fields, Run Scan, log purge, complete log filtering, and historical comparison. Do not register missing actions as tools.

## Manual org setup (requires separate deployment authorisation)
1. Deploy V4 metadata to an approved non-production org only after permission to do so is granted.
2. Assign `ER MCP Administrator` to trusted administrators and `ER MCP Reader` to permitted read-only MCP callers. Review object/field access and organisation-specific permission policies before activation.
3. Open Salesforce Setup → Integration → Salesforce MCP Servers. Create a **custom** MCP server named for ER Modeller.
4. Add only the available **Apex Action** tools above. Do **not** add standard SObject record tools. Activate the server and copy its URL from Salesforce Setup.
5. Register each external MCP client as an External Client App using the supported OAuth/PKCE flow and `mcp_api` scope. Do not commit secrets.
6. Open ER Modeller → Settings → MCP Server to configure exposed tool switches and inspect logs.
7. Test each tool with an authorised test user. Confirm tool discovery, invocable schema, no-current-snapshot responses, disabled behaviour, logging and permission denials.
8. Confirm Salesforce Hosted MCP availability, edition and Flex Credits implications with the org administrator.

## Limitations
- Apex classes and metadata have **not** been compiled or tested in a Salesforce org.
- The initial log records effective Salesforce user through CreatedBy; caller External Client App attribution is not yet implemented.
- Log retention is configurable but automatic purge is **not** yet implemented.
- CSV exports only the currently displayed log rows.
- Pagination cursors are evidence record IDs; callers should restart from the first page if the active snapshot changes between calls.
- Snapshot status advertises scanner families supported by the product, not independently verified per-run coverage.
- The settings page does not create, discover or activate a Salesforce Hosted MCP server.
- The Hosted MCP server configuration itself is an admin Setup step. Salesforce documentation says custom server configurations are Metadata API deployable, but cannot yet be included in ISV managed packages.

## Sources
- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/custom-servers.html
- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/invocable-actions.html
