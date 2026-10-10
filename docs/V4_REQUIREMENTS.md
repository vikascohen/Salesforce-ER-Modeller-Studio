# ER Modeller Studio — V4 Salesforce Hosted MCP Requirements

**Branch:** `v4` (forked from `main`)  
**Status:** Implementation underway; Apex and metadata deployed to `warden-dev`; Hosted MCP external invocation not yet verified
**Implementation completion:** Partial. Four agreed invocable tools, settings, audit logging and diagnostic integration exist; Hosted MCP activation and end-to-end acceptance remain outstanding. Do not use the historical 30% estimate as current progress.
**Scope owner:** ER Modeller Studio; security and sharing analysis belongs to Warden Studio.

## 1. Immutable development boundaries
- All V4 code, tests and documentation target `v4` only. Never commit, merge or deploy to `main`, V1, V2 or V3.
- Deploy only to an explicitly authorised development org. `warden-dev` has been used for V4 validation; never deploy V4 to V1/V2/V3 or production without approval.
- No security/sharing analysis, rule engine, standalone MCP server, duplicate records/schema/data-dictionary/record-count tools.
- Reuse existing V3 scanners, snapshot model and run command. Avoid duplicate scanner logic.
- Confirm Salesforce Hosted MCP supports each desired action contract before implementation.

## 2. Hosted MCP delivery
- Salesforce Hosted MCP is the MCP endpoint and transport. ER Modeller provides **Apex invocable actions** exposed as tools through a **custom MCP server configured in Salesforce Setup**.
- Ship invocable Apex classes, tests, permission set(s), configuration metadata, and Help/setup instructions. Admin creates/configures server, adds actions and activates it.
- Each caller (MuleSoft, Postman, agent) uses an External Client App with `mcp_api` scope, subject to Salesforce's actual supported OAuth and authorisation configuration.
- Do not add standard Salesforce record tools to this custom server.
- Setup documentation must explain prerequisites, user permissions, tool registration, OAuth, endpoint discovery, smoke test, diagnostics and troubleshooting. Do not hard-code an org-specific server URL.
- Verify which Setup/server elements can be packaged, and whether caller app identity is visible in Apex. Record evidence before relying on either.

## 3. Tool contracts

### Agreed (in scope)
1. **Get Changed Fields — implemented; acceptance pending:** Compare the last five successful runs in chronological order (up to four consecutive transitions); per run report changed field keys, dependency additions/removals and current usage. Return run dates and explicit `No changes` when applicable. If fewer than two successful runs exist, return an informative insufficient-history response. Do not interpret scanner failure or missing coverage as removed dependencies.
2. **Get Field Usage — implemented; acceptance pending:** Input canonical object/field key; read current successful snapshot, return every supported detected reference with component type/name, location, confidence, provenance, pagination and coverage warnings.
3. **Get Snapshot Status — implemented; acceptance pending:** Return current successful snapshot identity, completion time, age, supported scanner families, coverage/failures where available, plus active queued/running scan state. No live scanning.
4. **Run Scan — implemented; acceptance pending:** Invoke existing V3 asynchronous run command; return run ID immediately. Check scan-operator permission, active-scan conflict and configurable cooldown measured from most recent successful completion. Fail closed on unauthorised, busy or cooldown; record outcome.

### Proposed (not approved for implementation)
5. **Check Field List — 0%:** Batch usage and recent dependency changes for bounded list of field keys, preserving per-field errors and snapshot provenance.
6. **Get Component Footprint — 0%:** Reverse index: for one supported component identity, list all fields referenced in the current snapshot; paginated, coverage-aware.
7. **Get Object Automation — 0%:** Triggers, active Flows and validation rules on one object. Explicit **live Tooling API exception**; check whether Salesforce Hosted MCP already exposes this information before building. Do not include until approved.

### Shared response and execution rules
- All tools except Run Scan use stored evidence; Object Automation is the sole proposed live Tooling API read.
- Each response includes snapshot ID/date and scanner-family coverage (Object Automation also includes live query timestamp/source).
- Deterministic payloads, bounded results, stable schemas, pagination, safe errors, permissions and governor-limit budgets.
- Snapshot promotion only on success; running or failed scans never displace the last successful snapshot.
- Tool enable/disable setting enforced server-side; disabled tool returns **disabled by administrator**.
- Audit one invocation per tool call, including rejected requests; avoid exposing sensitive request content in logs.

## 4. Snapshot history and dependency comparison
- Retain last **10 successful** snapshots. Failed runs do not count toward 10.
- Last **5 successful** snapshots drive Changed Fields, with per-run `No changes` or exact dependency additions/removals.
- Compare stable evidence identity (field key, component identity, evidence type/location as justified); define duplicate and occurrence-count semantics explicitly.
- Preserve complete successful snapshot until replacement succeeds, then retain according to bounded policy.
- **Storage representation remains undecided:** ten full copies vs one full copy plus nine reversible deltas. Evaluate Apex/SOQL limits, write amplification, restore/reconstruction, query latency, delete handling, integrity and storage cost before selecting. Neither design is approved yet.
- Define upgrade behaviour for orgs with only one historical snapshot; cannot reconstruct missing past scans.

## 5. MCP invocation audit log
- One row per attempted invocation: UTC time, effective user, tool/method, requested object/field (bounded and redacted as appropriate), result success/error, duration in milliseconds, caller app name **only if Salesforce exposes it reliably**.
- Do not log credentials/tokens, full source code or sensitive tool payloads. Correlation ID for diagnostics.
- Handle logging failure without misrepresenting tool success; test transaction rollback and asynchronous logging semantics.
- Index/filter on date, method, user, result; CSV escaping and large-data export limits.

## 6. Settings > MCP Server
- **Server setup:** prerequisite checklist, validation/health checks, Hosted MCP configuration instructions, configured endpoint URL if discoverable; otherwise an explicit admin-supplied URL.
- **Exposed tools:** independent enable switches for all approved tools; server-side enforcement.
- **Scan guard:** admin-configured cooldown hours and scan-operator authorisation.
- **Call log:** today and trailing seven-day counts by method, filterable log table (date, method, user, result), CSV export.
- **Log retention:** configurable days, scheduled bounded purge, protected against active jobs and governor limits.
- **Access:** admins and scan operators only; separate read/admin/operator capabilities if supported, least privilege.
- Provide diagnostics, useful failure states, accessible UI and tests.

## 7. Explicit decisions awaiting owner approval
1. Changed Fields: dependency changes only **or** include fields created/deleted? Default implementation blocked until decided.
2. Snapshot storage: ten full snapshots **or** full + nine deltas? Run feasibility/cost study before choosing.
3. Proposed tools: Check Field List, Get Component Footprint, Get Object Automation — individually in or out?
4. Watch list alerts, `who changed it`, and recent-change heatmap: V4 or parked? Default **parked**, not silently in scope.

## 8. Pre-build Salesforce platform verification
- [ ] Confirm Salesforce Hosted MCP custom server registration and Apex invocable action requirements, payload limits and supported tool contracts with official documentation and a non-deploying prototype/metadata review where possible.
- [ ] Confirm caller External Client App identity visibility to Apex; if unavailable, document separate integration users per caller.
- [ ] Confirm whether custom server definitions can be packaged or must be configured manually in Setup.
- [ ] Confirm overlap with native MCP trigger/validation rule tools before considering Get Object Automation.
- [ ] Confirm Hosted MCP authorisation and permission set behaviour, scan-run execution context and limitations.
- [ ] Record versioned source references and evidence in this document before claiming support.

## 9. Tests, acceptance and delivery
- Apex tests: tool DTO contracts, permission failures, toggles, cooldown, concurrency, missing snapshot, partial coverage, pagination, malformed inputs, logging and retention.
- Snapshot tests: successful promotion, failed scan, last-ten policy, five-run comparison, unchanged runs, deleted/renamed components, storage integrity and scale.
- LWC Jest tests: settings, switches, log filters, summary counts, export and accessibility.
- Run static checks and local tests first. Org deployments and org-executed tests are permitted only in authorised development environments.
- Verify Hosted MCP interoperability using a properly authorised environment only after approval.
- Keep existing V3 behaviour stable. Update this requirements file with tested evidence and commit IDs for each milestone.

## 10. Implementation status and evidence (updated 2026-10-11)

| Workstream | Verified implementation | Outstanding acceptance / limitations |
|---|---|---|
| Hosted MCP architecture | Salesforce-hosted custom server selected; no self-hosted MCP transport | Admin must create/configure/activate server in Setup, register tools and validate endpoint and external OAuth client |
| Four invocable tools | `ErMcpGetSnapshotStatus`, `ErMcpGetFieldUsage`, `ErMcpGetChangedFields`, `ErMcpRunScan` exist and have been deployed | Real MCP `tools/list` and `tools/call` tests not yet performed; test input/output schema and permissions through MCP |
| Field Usage intelligence | Reuses V3 persisted scan/evidence/snapshot services; Field Usage cursor pagination implemented | Five-run diff bounded to 40,000 evidence rows; verify retention of ten successful snapshots and behaviour at scale |
| Settings and authorisation | `MCP_Settings__c`, admin/reader/scan-operator permission sets, `ErMcpSettingsController`, Settings > MCP Server UI | Confirm assigned permissions and integration user access; admin Setup configuration is separate from the Studio UI |
| MCP invocation logs | `MCP_Tool_Log__c`, `ErMcpCore.logCall`, settings log queries and `ErMcpLogRetention` exist | Verify persistence under rollbacks, scheduled retention, redaction, CSV limitations and external client attribution |
| Studio diagnostics | Central `ErStudioDiagnosticService`, UI events, background Field Usage/MCP failure routing; configurable existing-object sink | Coverage gaps and historical log retrieval documented in `DIAGNOSTIC_COVERAGE.md`; not Salesforce-wide monitoring |
| Deployment/tests | `warden-dev` deployment of MCP classes and object metadata succeeded on 2026-10-11; 170 local Apex tests passed, zero failures | Salesforce Hosted MCP custom server has **not** been confirmed active or tested with an external MCP client; browser UX not verified |

**Verification distinction:** A successful Salesforce metadata deployment and Apex tests establish compilation and tested Apex behaviour. They do **not** establish a functioning MCP endpoint, successful tool discovery, OAuth client authentication or external invocation. No production-readiness claim until these are tested.

**Version control evidence:** V4-only commits `276ca72` (Studio diagnostics routing) and `57fe217` (Studio-only source boundary). Earlier MCP implementation is present on `v4`. Untracked `coverage/` is not part of the release.

## 11. Recommended implementation order
1. Verify Hosted MCP platform capabilities and resolve open decisions.
2. Preserve snapshots and implement deterministic five-run diff/query service.
3. Implement four agreed invocable actions with shared response contracts.
4. Implement tool invocation logging and retention.
5. Implement settings and setup Help.
6. Run local regression, contract and load tests; deploy only to authorised orgs; execute actual Hosted MCP client interoperability and permission tests.


## Implementation history and current interpretation

- **2026-10-09:** Initial Hosted MCP invocable actions, settings object, log object, permissions and Studio settings UI introduced. `b14c08b` subsequently added Changed Fields and Run Scan, plus snapshot preservation and log retention implementation.
- **2026-10-11:** Four Apex tools and MCP object metadata successfully deployed to authorised `warden-dev` with 170 passing Apex tests and no failures. The first metadata check found missing MCP fields; the follow-up MCP metadata deployment succeeded. This does not prove external MCP operation.
- **2026-10-11:** Central Studio-only diagnostics, optional administrator-configured logging destination and Studio Error Log workspace integrated. See `DIAGNOSTIC_COVERAGE.md` for exact instrumentation and limitations.
- **Outstanding:** Custom Salesforce Hosted MCP server activation, registering four actions, External Client App OAuth with `mcp_api`, `tools/list` and `tools/call` smoke tests, permission-denial tests, real scan-run safeguards, retention scheduling and load/rollback tests.

**Official references:** https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/custom-servers.html and https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/invocable-actions.html
