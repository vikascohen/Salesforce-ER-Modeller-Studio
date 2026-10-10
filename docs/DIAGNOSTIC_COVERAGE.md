# ER Modeller Studio — diagnostic capture contract (V4)

All Studio features should emit errors through the shared diagnostics path rather than showing raw technical errors over the ER canvas.

## Capture paths

| Area | Source | Capture | Caveat |
|---|---|---|---|
| Diagram, DSL and modelling | `diagramStudio` | `errorMessage` setter → `recordDiagnostic` | Only errors routed through the Studio error pathway |
| Child LWC failures | `diagramStudio.errorCallback` | Studio diagnostic event | LWC render/lifecycle errors, not arbitrary rejected promises |
| Field Usage settings / scans / schedules | `fieldUsageSettings` | `studioerror` event | In-session UI; background jobs have separate server-side capture |
| MCP Settings | `erMcpSettings` | `studioerror` event | In-session UI |
| Diagnostic Settings | `erDiagnosticSettings` | `studioerror` event | No recursive persistence errors |
| Hosted MCP tools | `ErMcpCore.logCall` | `ErStudioDiagnosticService` for failed outcomes | Existing MCP tool log remains independent |
| Scheduled Field Usage launch | `FieldUsageOrchestrator.startScheduled` | `ErStudioDiagnosticService` | Already-running scan is normal and is not an error |
| Field Usage work-unit failures | `FieldUsageWorkUnitBatch.finish` | Aggregated event per run | Durable work-unit and run checkpoints remain authoritative |
| Snapshot promotion/finalisation | `FieldUsageSnapshotFinalizer` | `ErStudioDiagnosticService` | Roll back before emitting when finalisation fails |

## Delivery and permissions

- Central Apex sink is best-effort and capped per transaction. It writes only when object logging is enabled and the running user can create the configured record in user mode.
- Salesforce does not guarantee that a diagnostic record inserted in a transaction survives an unhandled exception/rollback. Durable Field Usage run checkpoints and Salesforce platform logs are necessary complements.
- The UI buffer is session-scoped; it does not yet read records back from the administrator's chosen logging object.
- The capture contract is not automatic instrumentation of every Apex method or every asynchronous exception. New components must explicitly emit through `studioerror` or `ErStudioDiagnosticService`.
- Do not log secrets, tokens, full request bodies or sensitive record contents. UI diagnostic model redacts common credential patterns; server-side error messages should be pre-sanitised at source.
- No new dedicated error-history object is created by this integration.

## Verification

Run Jest, Salesforce `RunLocalTests`, and perform authenticated browser checks at narrow and wide viewports before calling the entire UX production-ready. Validate both disabled and enabled object-logging configurations using a least-privileged user.
