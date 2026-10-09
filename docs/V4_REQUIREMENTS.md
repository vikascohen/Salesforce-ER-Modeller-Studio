# ER Modeller Studio — V4 Salesforce Hosted MCP Requirements

**Branch:** `v4` (forked from `main`)  
**Status:** Requirements baseline / feasibility pending  
**Implementation completion:** **15% (provisional, locally validated only)**. No org deployment or Apex compilation has occurred.
**Scope owner:** ER Modeller Studio; security and sharing analysis belongs to Warden Studio.

## 1. Immutable development boundaries — 0%
- All V4 code, tests and documentation target `v4` only. Never commit, merge or deploy to `main`, V1, V2 or V3.
- No deployment to any Salesforce org without explicit authorisation. Local tests and GitHub validation are permitted.
- No security/sharing analysis, rule engine, standalone MCP server, duplicate records/schema/data-dictionary/record-count tools.
- Reuse existing V3 scanners, snapshot model and run command. Avoid duplicate scanner logic.
- Confirm Salesforce Hosted MCP supports each desired action contract before implementation.

## 2. Hosted MCP delivery — 0%
- Salesforce Hosted MCP is the MCP endpoint and transport. ER Modeller provides **Apex invocable actions** exposed as tools through a **custom MCP server configured in Salesforce Setup**.
- Ship invocable Apex classes, tests, permission set(s), configuration metadata, and Help/setup instructions. Admin creates/configures server, adds actions and activates it.
- Each caller (MuleSoft, Postman, agent) uses an External Client App with `mcp_api` scope, subject to Salesforce's actual supported OAuth and authorisation configuration.
- Do not add standard Salesforce record tools to this custom server.
- Setup documentation must explain prerequisites, user permissions, tool registration, OAuth, endpoint discovery, smoke test, diagnostics and troubleshooting. Do not hard-code an org-specific server URL.
- Verify which Setup/server elements can be packaged, and whether caller app identity is visible in Apex. Record evidence before relying on either.

## 3. Tool contracts — 0%

### Agreed (in scope)
1. **Get Changed Fields — 0%:** Compare the last five successful runs in chronological order (up to four consecutive transitions); per run report changed field keys, dependency additions/removals and current usage. Return run dates and explicit `No changes` when applicable. If fewer than two successful runs exist, return an informative insufficient-history response. Do not interpret scanner failure or missing coverage as removed dependencies.
2. **Get Field Usage — 0%:** Input canonical object/field key; read current successful snapshot, return every supported detected reference with component type/name, location, confidence, provenance, pagination and coverage warnings.
3. **Get Snapshot Status — 0%:** Return current successful snapshot identity, completion time, age, supported scanner families, coverage/failures where available, plus active queued/running scan state. No live scanning.
4. **Run Scan — 0%:** Invoke existing V3 asynchronous run command; return run ID immediately. Check scan-operator permission, active-scan conflict and configurable cooldown measured from most recent successful completion. Fail closed on unauthorised, busy or cooldown; record outcome.

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

## 4. Snapshot history and dependency comparison — 0%
- Retain last **10 successful** snapshots. Failed runs do not count toward 10.
- Last **5 successful** snapshots drive Changed Fields, with per-run `No changes` or exact dependency additions/removals.
- Compare stable evidence identity (field key, component identity, evidence type/location as justified); define duplicate and occurrence-count semantics explicitly.
- Preserve complete successful snapshot until replacement succeeds, then retain according to bounded policy.
- **Storage representation remains undecided:** ten full copies vs one full copy plus nine reversible deltas. Evaluate Apex/SOQL limits, write amplification, restore/reconstruction, query latency, delete handling, integrity and storage cost before selecting. Neither design is approved yet.
- Define upgrade behaviour for orgs with only one historical snapshot; cannot reconstruct missing past scans.

## 5. MCP invocation audit log — 0%
- One row per attempted invocation: UTC time, effective user, tool/method, requested object/field (bounded and redacted as appropriate), result success/error, duration in milliseconds, caller app name **only if Salesforce exposes it reliably**.
- Do not log credentials/tokens, full source code or sensitive tool payloads. Correlation ID for diagnostics.
- Handle logging failure without misrepresenting tool success; test transaction rollback and asynchronous logging semantics.
- Index/filter on date, method, user, result; CSV escaping and large-data export limits.

## 6. Settings > MCP Server — 0%
- **Server setup:** prerequisite checklist, validation/health checks, Hosted MCP configuration instructions, configured endpoint URL if discoverable; otherwise an explicit admin-supplied URL.
- **Exposed tools:** independent enable switches for all approved tools; server-side enforcement.
- **Scan guard:** admin-configured cooldown hours and scan-operator authorisation.
- **Call log:** today and trailing seven-day counts by method, filterable log table (date, method, user, result), CSV export.
- **Log retention:** configurable days, scheduled bounded purge, protected against active jobs and governor limits.
- **Access:** admins and scan operators only; separate read/admin/operator capabilities if supported, least privilege.
- Provide diagnostics, useful failure states, accessible UI and tests.

## 7. Explicit decisions awaiting owner approval — 0%
1. Changed Fields: dependency changes only **or** include fields created/deleted? Default implementation blocked until decided.
2. Snapshot storage: ten full snapshots **or** full + nine deltas? Run feasibility/cost study before choosing.
3. Proposed tools: Check Field List, Get Component Footprint, Get Object Automation — individually in or out?
4. Watch list alerts, `who changed it`, and recent-change heatmap: V4 or parked? Default **parked**, not silently in scope.

## 8. Pre-build Salesforce platform verification — 0%
- [ ] Confirm Salesforce Hosted MCP custom server registration and Apex invocable action requirements, payload limits and supported tool contracts with official documentation and a non-deploying prototype/metadata review where possible.
- [ ] Confirm caller External Client App identity visibility to Apex; if unavailable, document separate integration users per caller.
- [ ] Confirm whether custom server definitions can be packaged or must be configured manually in Setup.
- [ ] Confirm overlap with native MCP trigger/validation rule tools before considering Get Object Automation.
- [ ] Confirm Hosted MCP authorisation and permission set behaviour, scan-run execution context and limitations.
- [ ] Record versioned source references and evidence in this document before claiming support.

## 9. Tests, acceptance and delivery — 0%
- Apex tests: tool DTO contracts, permission failures, toggles, cooldown, concurrency, missing snapshot, partial coverage, pagination, malformed inputs, logging and retention.
- Snapshot tests: successful promotion, failed scan, last-ten policy, five-run comparison, unchanged runs, deleted/renamed components, storage integrity and scale.
- LWC Jest tests: settings, switches, log filters, summary counts, export and accessibility.
- Static checks and local tests first; any org deployment or org-executed Apex tests require separate approval.
- Verify Hosted MCP interoperability using a properly authorised environment only after approval.
- Keep existing V3 behaviour stable. Update this requirements file with tested evidence and commit IDs for each milestone.

## 10. Progress dashboard
| Workstream | Weight | Complete | Evidence |
|---|---:|---:|---|
| Boundaries and baseline | 5% | 0% | Branch created; implementation not started |
| Hosted MCP feasibility/delivery | 15% | 20% | Official Hosted MCP docs checked; invocable action scaffolding and permissions; org activation pending |
| Four agreed invocable tools | 25% | 20% | Snapshot Status and Field Usage initial Apex actions; Changed Fields and Run Scan not built |
| Snapshot retention and five-run diff | 20% | 0% | Pending |
| MCP call logging | 10% | 25% | Log object and best-effort Apex call logging; reliability, retention and caller app unresolved |
| Settings > MCP Server | 15% | 30% | Initial Settings tab, tool switches, cooldown/retention inputs, log table and CSV; retention job not built |
| Test, docs and release validation | 10% | 0% | Pending |
| **Overall implementation** | **100%** | **15%** | **Local implementation in progress; no Salesforce validation** |

Progress percentages are implementation completion, not documentation completion. Each workstream should record tested behaviour, commit/PR, unresolved gaps and remaining acceptance criteria. Proposed tools and parked features are excluded from the denominator until approved.

## 11. Recommended implementation order
1. Verify Hosted MCP platform capabilities and resolve open decisions.
2. Preserve snapshots and implement deterministic five-run diff/query service.
3. Implement four agreed invocable actions with shared response contracts.
4. Implement tool invocation logging and retention.
5. Implement settings and setup Help.
6. Run local regression, contract and load tests; prepare manual Hosted MCP setup instructions. **Do not deploy to an org without permission.**


## V4 implementation log — 2026-10-09
- Verified official Salesforce Hosted MCP docs: custom Apex actions require `global @InvocableMethod`; admin configures server in Setup; packaged server definition itself is not included in an ISV managed package. Official documentation: https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/invocable-actions.html and https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/custom-servers.html
- Initial implementation: `ErMcpGetSnapshotStatus`, `ErMcpGetFieldUsage`, `ErMcpCore`, `ErMcpSettingsController`; `MCP_Settings__c` and `MCP_Tool_Log__c`; MCP permission sets; Settings > MCP Server navigation and component.
- Explicit limitations: Apex not compiled in an org; no Hosted MCP server activated; no org changes. The Changed Fields and Run Scan tools are not yet implemented. Caller app attribution and automatic log retention remain unimplemented. Field Usage is limited to 500 rows and lacks continuation pagination; log CSV exports only displayed rows; no live MCP integration test. Local Jest regression: 27/27 suites, 169 passing, 10 skipped. No new Apex tests executed. Do not claim production readiness.
