# ER Modeller Studio Architecture

**Author: Vikas Cohen**  
**Lead Architect and System Designer**

This is the authoritative technical architecture document for ER Modeller Studio. It describes the product as one system: visual ER modelling, the ER DSL compiler, Salesforce metadata acquisition, Data Dictionary, Architecture Intelligence, Object Intelligence, Version 3 Field Usage Intelligence, persistence, security boundaries, testing and extension principles.

The product philosophy is simple: **understand the Salesforce data architecture before changing it**.

## 1. Architectural philosophy

ER Modeller Studio separates four responsibilities:

1. **Acquisition**: obtain schema, metadata and dependency evidence from Salesforce.
2. **Model**: represent objects, fields, relationships and evidence in stable forms.
3. **Intelligence**: derive structural and dependency-oriented insight from those models.
4. **Experience**: let a human explore, compare, visualise and export the result.

The implementation layers in the next section are how those responsibilities are realised. They are not four competing classifications. Acquisition is primarily implemented by the Salesforce service/evidence layers; Model and Intelligence span the client model, analysis modules and persisted evidence; Experience is the user-facing layer.

The system follows several rules:

- Evidence before opinion.
- Structural signals are review prompts, not automatic defects.
- Heavy org-wide work is asynchronous; interactive reads should remain bounded.
- The last successful dependency snapshot remains trusted until a replacement completes successfully.
- Meaning is separated from presentation.
- Acquisition, parsing, persistence, analysis and visualisation are separate concerns.
- New capability should normally become a focused module rather than another monolithic block.
- Absence of detected evidence is not proof of absence of dependency.

## 2. Whole-system architecture — V4

This diagram combines the interactive Studio, V4 Hosted MCP actions, persisted intelligence, asynchronous scans and shared diagnostics. **The Hosted MCP server activation and external invocation remain unverified.** The shared Diagram Studio entitlement gate is a required security enhancement, not yet implemented across all four actions. Teams is future state.

```mermaid
flowchart TB
    User["Architect / Developer"] --> Studio["Diagram Studio LWC"]
    Caller["Postman / AI Agent / External MCP Client"] --> OAuth["Salesforce OAuth and MCP server access"]
    OAuth --> Hosted["Salesforce Hosted MCP custom server"]
    Hosted --> Gate["Required Diagram Studio entitlement gate<br/>OPEN SECURITY GAP"]
    Gate --> Actions["Four ER Modeller Invocable Apex Actions"]

    subgraph Experience["Interactive experience"]
      Canvas["ER Canvas / Explorer"]
      Dictionary["Data Dictionary"]
      Intelligence["Architecture / Object Intelligence"]
      Usage["Field Usage Intelligence"]
      Settings["Settings / Help / Diagnostics"]
    end
    Studio --> Canvas
    Studio --> Dictionary
    Studio --> Intelligence
    Studio --> Usage
    Studio --> Settings

    subgraph Client["Client modelling and analysis"]
      DSL["ER DSL Compiler / Semantic Model"]
      Graph["Diagram and Architecture Graph Logic"]
      Maps["Field Usage Map Logic"]
      Export["Export Utilities"]
    end
    Canvas <--> DSL
    Canvas --> Graph
    Intelligence --> Graph
    Usage --> Maps
    Canvas --> Export

    subgraph Services["Salesforce application services"]
      Schema["SchemaMetadataController"]
      Detail["DataDictionaryFieldDetailController"]
      ObjectIntel["ObjectIntelligenceController"]
      FieldSvc["FieldUsageController and Services"]
      Files["Diagram File / Preferences"]
      McpCore["ErMcpCore / ErMcpFieldUsageService"]
      Scan["Scan Orchestrator / Batch / Finaliser"]
    end
    Studio --> Schema
    Dictionary --> Detail
    Intelligence --> ObjectIntel
    Usage --> FieldSvc
    Studio --> Files
    Actions --> McpCore
    McpCore --> FieldSvc
    McpCore -->|Run Scan| Scan
    FieldSvc --> Scan

    subgraph Persistence["Salesforce evidence and persistence"]
      Describe["Describe / Org Schema"]
      Tooling["Tooling API via Named Credential"]
      Org["Org Metadata / Diagram Records"]
      Snapshot[("Current Successful Snapshot / Evidence")]
      Checkpoint[("Durable Scan Run / Work Units")]
    end
    Schema --> Describe
    Detail --> Describe
    ObjectIntel --> Describe
    ObjectIntel --> Tooling
    ObjectIntel --> Snapshot
    Files --> Org
    FieldSvc --> Snapshot
    Scan --> Tooling
    Scan --> Snapshot
    Scan --> Checkpoint
    McpCore --> Snapshot

    subgraph Diagnostics["Studio-scoped best-effort diagnostics"]
      Sink["ErStudioDiagnosticService"]
      Config["ErDiagnosticConfigController / Configuration"]
      Log[("Admin-selected Salesforce Log Object")]
      Buffer["Session-only UI Buffer"]
    end
    Studio -.-> Buffer
    Studio -.-> Sink
    Actions -.-> Sink
    Scan -.-> Sink
    Settings --> Config
    Sink --> Config
    Config -->|Enabled, valid and permitted| Log
```

**Trust boundaries:** External MCP consumers require Salesforce OAuth and Hosted MCP tool access. Every MCP action must additionally enforce the caller's Diagram Studio entitlement, with separate scan-operator authorisation for Run Scan. This shared entitlement guard is not yet complete. The internal Tooling API Named Credential is not an external MCP authentication mechanism.

**Operational boundaries:** Heavy evidence acquisition is asynchronous; only successful snapshots become current. Durable run/work-unit checkpoints remain separate from optional, best-effort diagnostic records. The logger is Studio-scoped, validates configured simple or parent/child Salesforce objects, and must never persist tokens or raw evidence.

**Future state:** A Teams headless adapter can consume the same MCP tools through an authorised Salesforce identity, but must never use a privileged service identity to bypass per-user Diagram Studio access. Teams is not shipped in V4. See Sections 19–22 for the detailed MCP, security and logging architecture.

`diagramStudio` remains the interactive shell and cross-feature orchestrator; specialist behaviour belongs in focused components and services.

## 3. Core modelling path

```mermaid
flowchart LR
    A[Salesforce Describe or User-authored DSL] --> B[Normalised Semantic Model]
    B --> C[Relationship Model]
    C --> D[ER Canvas]
    D --> E[Semantic User Edits]
    E --> B
    B <--> F[DSL Text]
    D --> P[Presentation State / Coordinates]
    P --> D
    B --> G[Save Diagram]
    P --> G
    B --> H[Exports]
    B --> I[Architecture Intelligence]
```

Salesforce schema import and DSL authoring converge on the same conceptual model. Visual edits that change meaning can update the model. Coordinates and layout remain presentation state and do not become source semantics merely because they are persisted with a diagram.

## 4. ER DSL compiler architecture

The ER DSL is declarative. It describes entities, fields and relationships rather than an execution sequence. The compiler follows this invariant:

```text
source text -> semantic model -> optional geometry IR -> target artifact
```

The **semantic model is authoritative**. Canvas geometry, SVG, Mermaid, draw.io XML and PNG are derived representations.

```mermaid
flowchart TD
    A[DSL Source Text] --> B[Line Classifier / Recognition]
    B --> C[Grammar Dispatch]
    C --> D[Semantic Normalisation]
    D --> E[Entities / Fields / Relationships]
    E --> F[Geometry IR]
    E --> G[Mermaid Generator]
    F --> H[Canvas / SVG]
    F --> I[draw.io Generator]
    H --> J[PNG Rasterisation]
```

### Compiler responsibilities

`erDiagramLogic.js` owns the core compiler-style logic: parsing, semantic construction, relationship normalisation, geometry generation and target generation. `diagramStudio.js` owns editor state, persisted positions, interaction and compiler invocation.

The grammar is intentionally line-oriented and flat. A parser generator or full AST would add ceremony without improving the current language. If the language later gains nesting, expressions, aliases, blocks or multiline declarations, an AST can be introduced without changing the semantic-model contract.

A compact grammar is:

```text
program        ::= line*
line           ::= blank | comment | entity | relationship
entity         ::= "entity" identifier (":" field-list)?
field-list     ::= field ("," field)*
field          ::= identifier field-metadata?
field-metadata ::= "[" metadata-text "]"
relationship   ::= identifier "." identifier operator identifier
operator       ::= "->" | "=>" | "~>"
```

Entity identity is case-insensitive while display casing is preserved. Relationship targets may be referenced before declaration. Exact duplicate relationships are normalised. Field bracket metadata belongs to the semantic field representation; saved coordinates do not.

The compiler deliberately does not calculate Salesforce access, execute business logic or query Salesforce. Those concerns belong to other boundaries.

### Compiler extension rule

A language feature is not complete merely because the parser recognises it. Extend from the semantic model outward: syntax, recognition, semantic model, geometry, every relevant backend, diagnostics/tests and documentation.

The language syntax and examples remain in [DSL.md](DSL.md). This document owns the compiler architecture.

## 5. Schema and metadata acquisition

`SchemaMetadataController` is the main server-side schema boundary for modelling. Other controllers remain deliberately narrower:

- `DataDictionaryFieldDetailController`: field-oriented detail.
- `ObjectIntelligenceController`: selected-object intelligence such as record types, layouts, triggers, validation rules, Flows and related evidence.
- `StudioDiagnosticsController`: runtime and configuration checks.
- `DiagramFileController` / `DiagramPreferenceController`: Studio persistence rather than architecture analysis.
- `FieldUsageController`: current Field Usage snapshot, status, schedules, summaries and bounded evidence detail.

This prevents every UI feature from independently implementing Salesforce metadata access.

## 6. Architecture Intelligence

Architecture Intelligence consumes the model rather than raw UI markup.

```mermaid
flowchart LR
    M[Current ER Model] --> S[Model Scope]
    S --> F[Architecture Graph]
    F --> T[Topology and Metrics]
    F --> P[Relationship Paths]
    F --> I[Object Impact / Neighbourhood]
    T --> R[Review Signals]
    P --> UI[Architecture Intelligence UI]
    I --> UI
    R --> UI
    E[Field Usage Evidence] --> CI[Field Change Impact]
    CI --> UI
```

Structural impact and field dependency impact are related but different. Structural analysis derives from the ER graph. Field-level dependency impact derives from persisted scanner evidence. The UI must not present an inferred structural relationship as if it were source dependency evidence.

Architecture Intelligence includes architecture overview, topology/complexity metrics, hotspots, isolated objects, connected components, bounded-cycle analysis, relationship paths, object impact, review findings and field-change exploration backed by Field Usage evidence.

## 7. Object Intelligence and Data Dictionary

The Data Dictionary provides object/field metadata browsing, filtering, detail and export. Object Intelligence adds selected-object context such as custom-field review signals, relationships and metadata/dependency evidence.

Counts such as page layouts or record types are evidence, not defects by themselves. Potential custom-to-standard overlap is presented for human review rather than asserted as a guaranteed duplicate.

Record population percentage and dependency usage are separate concepts and remain separately labelled.

## 8. Version 3 Field Usage architecture

Field Usage is an asynchronous evidence pipeline. Discovery, scanning, persistence, querying and visualisation are separate concerns.

```mermaid
flowchart TD
    UI[Diagram Studio / Settings] --> ORCH[FieldUsageOrchestrator]
    ORCH --> DISC[FieldUsageDiscoveryBatch]
    DISC --> FORMULA[Formula Work Units]
    DISC --> TOOLING[FieldUsageToolingDiscoveryBatch]
    TOOLING --> APEX[Apex Work Units]
    TOOLING --> FLOW[Flow Work Units]
    TOOLING --> LWC[LWC Work Units]
    TOOLING --> AURA[Aura Work Units]
    TOOLING --> VALID[Validation Rule Work Units]
    FORMULA --> WORK[FieldUsageWorkUnitBatch]
    APEX --> WORK
    FLOW --> WORK
    LWC --> WORK
    AURA --> WORK
    VALID --> WORK
    WORK --> SCAN[Specialised Scanners]
    SCAN --> EV[Field_Usage_Evidence__c]
    WORK --> FIN[FieldUsageSnapshotFinalizer]
    FIN --> CUR[Current Successful Snapshot]
    CUR --> CTRL[FieldUsageController]
    CTRL --> SUM[Compact Evidence Summary]
    SUM --> MAP[Field Usage Map]
    MAP -->|expand branch| DETAIL[Lazy Paginated Detail]
```

### Main Field Usage responsibilities

- `FieldUsageOrchestrator` starts scans and prevents conflicting runs.
- `FieldUsageDiscoveryBatch` performs schema-oriented discovery and formula work discovery.
- `FieldUsageToolingDiscoveryBatch` discovers source/metadata work for Apex, Flow, LWC, Aura and supported metadata scanners.
- `FieldUsageWorkUnitBatch` routes bounded durable work and maintains progress.
- Source scanners detect evidence for one artefact family.
- Tooling API client classes own authenticated transport rather than duplicating HTTP/authentication logic in scanners.
- `FieldUsageSnapshotFinalizer` promotes only a successful replacement snapshot.
- `FieldUsageController` provides the LWC-facing read/operation boundary.

### Scanner contract and matching model

A scanner receives bounded source work plus scan context. It retrieves only the source required for its artefact family, applies source-specific detection, resolves candidate field references against Salesforce schema where applicable, emits normalised evidence and reports meaningful failures.

This is **not a universal semantic compiler for Salesforce source**. Different artefact families require different detection strategies. The design therefore keeps parsing/detection inside specialised scanners rather than claiming one text-matching rule understands Apex, Flow XML, Lightning source, formulas and validation rules equally.

Schema resolution reduces ambiguity by grounding candidate names in Salesforce object/field metadata and by persisting canonical API names. It does not turn inherently dynamic source into statically provable dependency information. Dynamically constructed names, runtime indirection and unsupported artefact families can escape static detection. Conversely, source text can contain syntactically plausible names that require scanner-specific context to avoid false matches. The architecture treats scanner output as evidence, not mathematical proof of complete dependency closure.

Supported evidence families in V3 are Apex Classes, Apex Triggers, active Flows, LWC, Aura, Formula Fields and Validation Rules where supported by the current pipeline.

### Why source-specific scanners

The V3 architecture deliberately owns a normalised evidence pipeline rather than treating a single platform dependency feed as the whole product contract. This allows each supported artefact family to preserve provenance, scanner identity, component detail and snapshot semantics behind one query model.

This document does **not** claim that Salesforce dependency metadata is useless or interchangeable with the current scanners. A formal comparison with Salesforce dependency APIs, including `MetadataComponentDependency`, has not yet been established here as a measured design decision. If that source is introduced later, it should enter through the acquisition/scanner boundary and be reconciled with the same evidence contract rather than bypassing snapshot semantics.

### Canonical field identity

Matching may be case-insensitive internally, but persisted field identity uses the canonical API name returned by Salesforce Describe. This keeps evidence stable across standard fields, custom fields and namespaced/non-namespaced environments.

## 9. Evidence boundaries and safe interpretation

**An empty Field Usage result is not a safe-to-delete signal.** It means the supported scanners did not persist dependency evidence for that field in the current successful snapshot.

The V3 scanner contract currently covers the evidence families listed above. It does not claim complete dependency coverage for every Salesforce feature or every possible runtime reference. In particular, users should not infer coverage for artefact families that are not listed as supported scanners, such as reports, dashboards, list views, email templates or arbitrary external systems. Page Layout information can appear in Object Intelligence, but that does not make Page Layouts part of the Field Usage source-scanner contract.

Managed-package implementation source may not be available to the running org/tooling context. Inactive Flows are outside the stated active-Flow scanner scope. Dynamic references assembled from strings or resolved only at runtime may not be statically discoverable.

Therefore:

```text
no evidence found != field is unused
```

Field Usage should be one input into change analysis alongside Salesforce configuration review, package/vendor knowledge, integration knowledge, runtime testing and the organisation's normal release controls.

## 10. Field Usage runtime sequence

```mermaid
sequenceDiagram
    participant User
    participant LWC as Studio LWC
    participant C as FieldUsageController
    participant O as Orchestrator
    participant D as Discovery
    participant W as Work Unit Batch
    participant S as Scanner
    participant DB as Snapshot / Evidence

    User->>LWC: Run scan
    LWC->>C: runNow()
    C->>O: start
    O->>D: discover bounded work
    D->>DB: create durable work units
    D->>W: process work
    W->>S: route source work
    S->>DB: persist normalised evidence
    W->>DB: update progress / finalise
    Note over LWC,DB: Previous successful snapshot remains usable
    LWC->>C: poll status
    User->>LWC: select object + field
    LWC->>C: getEvidenceSummary()
    C-->>LWC: compact current-snapshot summary
    User->>LWC: expand source branch
    LWC->>C: getEvidenceDetail()
    C-->>LWC: bounded / paginated detail
```

The initial map must not hydrate every evidence row. Summary data builds the first graph; detail is loaded progressively and may be cached only within the current snapshot/context identity.

## 11. Persistence model

```mermaid
flowchart TB
    DF[Diagram_File__c] --> A[Saved Diagram / DSL Source]
    DP[Diagram_Studio_Pref__c] --> B[User Studio Preferences]
    RUN[Field_Usage_Run__c] --> C[Scan Lifecycle / Snapshot Identity]
    WU[Field_Usage_Work_Unit__c] --> D[Durable Bounded Work]
    EV[Field_Usage_Evidence__c] --> E[Normalised Dependency Evidence]
    SCH[Field_Usage_Schedule__c] --> F[Configured Scan Schedules]
```

Diagram persistence, operational scan state and dependency evidence are intentionally separate.

## 12. Snapshot and recovery semantics

```mermaid
stateDiagram-v2
    [*] --> Building
    Building --> Successful: required work finalised
    Building --> Failed: required work cannot complete
    Building --> Interrupted: aborted or interrupted work
    Interrupted --> Failed: run cannot be resumed/completed
    Successful --> Current: finalizer promotes snapshot
    Failed --> ArchivedFailed
    Current --> PreviousSuccessful: later successful snapshot promoted
```

**Only a successfully finalised snapshot can become current.** Starting a new scan does not remove the last good state. Failed, partial, aborted or otherwise incomplete work must not masquerade as complete intelligence or replace the last successful snapshot.

Work units are durable checkpoints with Pending, Processing, Completed and Failed semantics. Retry/recovery behaviour is intentionally bounded. Operational monitoring and administrative controls exist so incomplete work remains visible rather than silently becoming trusted evidence.

## 13. Performance and governor-limit architecture

Salesforce governor limits are architectural constraints. The project therefore prefers:

- bounded Batch Apex scopes;
- durable work units instead of giant transaction state;
- collection-based SOQL/DML;
- batched API retrieval where safe;
- aggregation instead of unnecessary hydration;
- paginated/lazy interactive detail;
- `Map`/`Set` indexes rather than repeated large-array scans;
- snapshot-scoped client caching;
- separate measurement of scan throughput and interactive map latency.

The architecture does not publish a universal scan-duration, org-size ceiling, evidence-growth rate or retention guarantee because those have not been established here as controlled benchmarks. They depend on org composition, source volume, API behaviour and the evidence produced. Such numbers should be published only from repeatable measurements, not inferred from design intent.

An optimisation is unacceptable if it weakens evidence correctness, provenance or snapshot consistency.

## 14. UI modularity

Important UI/component boundaries include:

- `diagramStudio`: application shell and cross-feature orchestration.
- `architectureIntelligence`: architecture workspace and analysis modules.
- `objectArchitectureHealth`: selected-object intelligence.
- `fieldUsageIntelligence`: field dependency exploration.
- `fieldUsageSettings`: schedules and operational controls.
- `fieldUsageScannerCoverage`: scanner coverage/status.
- `dataDictionaryFieldDetail`: field-detail intelligence.
- `studioHelp` / `toolingApiConfigurationHelp`: embedded user/configuration guidance.
- `diagramViewer`, `diagramExportUtils`, `fieldUsageMapLogic`, `fieldUsageMapExport`, `erDiagramLogic`: reusable focused logic.

Extraction is preferred over copying. A method that begins owning acquisition, parsing, persistence and presentation at once is a refactoring signal.

## 15. Security, access and trust boundaries

The Studio runs inside Salesforce and relies on the running user's Salesforce access plus configured authenticated callouts for Tooling API operations. Credentials are not embedded in client code. The Named Credential / External Credential configuration is a deliberate trust boundary for source and metadata retrieval.

Field Usage evidence is persisted in Salesforce custom objects. Access to that persisted evidence is therefore part of the application's Salesforce permission model, not a substitute for Salesforce source-authoring permissions. A user being able to read evidence should not be interpreted as that user having `Author Apex`, edit access to the underlying component, or independent permission to retrieve arbitrary source outside the application's configured boundaries.

Beta testers must receive the packaged **Diagram Studio User** permission set and the required External Credential principal access as described in the installation guide and in-product Help. Organisations should review those permissions and the evidence stored in their org before broader deployment.

Dynamic metadata identifiers must be validated. Unsafe dynamic SOQL, credential logging and persistence of session identifiers/secrets are prohibited.

Detailed guidance remains in [SECURITY.md](SECURITY.md) and **Help > Configuration**.

## 16. Testing architecture

The repository uses Apex and Jest tests.

Apex tests cover controllers, scanner behaviour, orchestration, durable work, snapshot finalisation, Tooling API boundaries and persistence/service behaviour. Jest covers LWC behaviour, map logic, architecture-analysis modules, exports, progress, performance and interaction behaviour.

The split mirrors the product: server-side evidence acquisition is tested server-side; client-side analysis and interaction are tested in JavaScript.

A beta candidate should be considered green only when Salesforce CLI validation and the full Jest suite both pass.

## 17. Extension rules

1. Do not duplicate metadata acquisition.
2. Do not duplicate graph algorithms inside UI event handlers.
3. Do not make scanners responsible for orchestration.
4. Do not let the UI invent evidence that was not returned.
5. Do not mix presentation state with dependency evidence.
6. Preserve current-successful-snapshot semantics.
7. Keep exporters downstream of the semantic/intelligence layer.
8. Keep source-specific parsing inside the appropriate scanner.
9. Preserve canonical Salesforce API identity at persistence boundaries.
10. Extend the DSL from semantic model outward, not renderer inward.
11. Prefer focused modules over expanding monolithic files.
12. Treat diagnostics, failure visibility and limitations as part of the product contract.

## 18. Architectural principle

The architecture can be reduced to one flow:

```text
Salesforce schema / metadata / supported source
              |
              v
       acquisition boundaries
              |
              v
 semantic model + durable evidence
              |
              v
 modelling / compiler / intelligence
              |
              v
 human-readable maps, review signals and exports
```

The visual modeller and DSL share one semantic meaning. Architecture Intelligence reasons over the ER model. Field Usage gathers durable source evidence asynchronously. Object Intelligence combines selected-object metadata with appropriate dependency context. The UI progressively discloses detail without pretending that structural signals or missing evidence are definitive conclusions.

That separation of **meaning, evidence, analysis and presentation** is the core architectural principle of ER Modeller Studio.

## 19. Version 4 — Salesforce Hosted MCP architecture

**Implementation status:** Four ER Modeller Apex invocable actions exist in V4; activation of a Salesforce custom Hosted MCP server and external client execution are not yet independently verified. The MCP transport and OAuth boundary belong to Salesforce, not an ER Modeller-hosted web server. See [V4_MCP_SETUP.md](V4_MCP_SETUP.md).

```mermaid
flowchart TB
    Client["Authorised external MCP client<br/>Postman / agent / future Teams adapter"]
    OAuth["Salesforce OAuth<br/>External Client App + mcp_api scope"]
    Hosted["Salesforce custom Hosted MCP server<br/>tool discovery and invocation"]
    Gate{"ER Modeller authorisation<br/>deny by default"}
    Tools["Invocable Apex actions<br/>Snapshot Status | Field Usage<br/>Changed Fields | Run Scan"]
    Core["ErMcpCore and ErMcpFieldUsageService"]
    Store[("Field Usage runs<br/>snapshots and evidence")]
    Orchestrator["Existing scan orchestrator<br/>asynchronous workers"]
    Diagnostic["ErStudioDiagnosticService<br/>best-effort diagnostic sink"]
    Client --> OAuth --> Hosted --> Gate
    Gate -->|authorised| Tools --> Core
    Gate -->|denied| Denied["No evidence returned"]
    Core --> Store
    Core -->|Run Scan only| Orchestrator --> Store
    Tools -.-> Diagnostic
```

The four actions are `ErMcpGetSnapshotStatus`, `ErMcpGetFieldUsage`, `ErMcpGetChangedFields`, and `ErMcpRunScan`. They consume existing V3 intelligence and scan orchestration; no second scanner or external metadata database is introduced. Field Usage uses snapshot-bound cursor pagination; Changed Fields is bounded by its implemented synchronous evidence limit. The `Salesforce_Tooling_API` Named Credential is for *internal acquisition* and is never an external MCP client's credential.

### 19.1 Authorisation contract and current gap

**Mandatory target policy:** An authenticated Salesforce user without explicit Diagram Studio entitlement must be denied **every** ER Modeller MCP action, regardless of whether the request originates from Postman, an agent or Teams. Salesforce login, OAuth scope, server visibility and generic object access are necessary but not sufficient. Add a dedicated `ER_Diagram_Studio_Access` custom permission (proposed name), granted by the `Diagram_Studio_User` permission set, and check it in a shared Apex guard before any evidence query, tool response or scan launch. Additional least-privilege tool-specific permission is required for Run Scan; existing `ER_MCP_Scan_Operator` must remain enforced. Do not rely on checking a permission-set name in Apex.

**Not yet implemented:** The three read-only actions currently check their tool-enable settings but do not explicitly enforce a Diagram Studio entitlement custom permission. Run Scan checks `ER_MCP_Scan_Operator`, but must also pass the common entitlement gate. This is an open release-blocking security gap; this document does not claim that it has been fixed.

```mermaid
flowchart TD
    A["MCP tools/call"] --> B{"Valid Salesforce identity<br/>and MCP tool access?"}
    B -->|No| X["Deny; return no evidence"]
    B -->|Yes| C{"Diagram Studio entitlement?"}
    C -->|No| X
    C -->|Yes| D{"Tool enabled?"}
    D -->|No| X
    D -->|Yes| E{"Run Scan?"}
    E -->|No| F["Authorised read-only tool"]
    E -->|Yes| G{"Scan operator permission<br/>and operational guards?"}
    G -->|No| X
    G -->|Yes| H["Queue existing scan"]
```

The guard must run in the *effective invoking user's* security context. A privileged integration identity must never be used as a blanket bypass for arbitrary Teams users. Test revoked permissions, least-privileged users, object/field access, disabled tools and identity propagation end-to-end before exposing the server externally. A `with sharing` declaration alone is not a substitute for explicit entitlement, CRUD/FLS and tool-level authorisation.

### 19.2 Invocation sequence and verification

```mermaid
sequenceDiagram
    participant C as External MCP client
    participant S as Salesforce Hosted MCP
    participant A as ER Modeller Apex
    participant D as Snapshot store
    participant L as Diagnostic sink
    C->>S: OAuth-authorised MCP initialize
    C->>S: tools/list
    S-->>C: Registered ER Modeller tools
    C->>S: tools/call Get Snapshot Status
    S->>A: Invoke action as authorised identity
    Note over A: Required shared entitlement guard<br/>not yet implemented for all actions
    A->>D: Query current snapshot
    D-->>A: Snapshot context
    A-->>S: Bounded tool result
    A-->>L: Best-effort outcome / duration
    S-->>C: MCP tool response
```

External acceptance testing must demonstrate a live Salesforce Hosted MCP endpoint, OAuth, discovery, real tool execution, denial for non-Diagram-Studio users, and read/write separation. An Apex deployment or unit-test pass alone does not prove the Hosted MCP endpoint is active.

## 20. Version 4 — Studio diagnostics and logger architecture

The logger is **Studio-scoped**, not an org-wide exception monitor. Its central sink is `ErStudioDiagnosticService`; configuration, validation and persistence are provided by `ErDiagnosticConfigController` and `ER_Diagnostic_Config__c`. Supported sources are explicitly allowlisted. This is a best-effort telemetry path, never the source of truth for scan completion or evidence consistency.

```mermaid
flowchart TB
    UI["Studio LWC errors<br/>diagram / settings / import / export"]
    Batch["Field Usage orchestrator<br/>work-unit / finaliser failures"]
    MCP["Hosted MCP actions<br/>outcome and elapsed time"]
    Sink["ErStudioDiagnosticService<br/>source allowlist / event cap"]
    Config{"Configured logging enabled?<br/>Valid object, fields, mappings and access?"}
    Store[("Administrator-selected Salesforce log object<br/>simple or parent/child structure")]
    Buffer["Session-only UI diagnostic buffer"]
    Checkpoints[("Durable Field Usage run<br/>and work-unit checkpoints")]
    UI --> Buffer
    UI --> Sink
    Batch --> Sink
    Batch --> Checkpoints
    MCP --> Sink
    Sink --> Config
    Config -->|Yes, best effort| Store
    Config -->|No / failure| Drop["Do not block business operation"]
```

### 20.1 Configuration and persistence

The administrator configures either a simple Salesforce logging object or a custom parent/child logging structure. Configuration must validate the selected object and fields, the child lookup/master-detail relationship to the selected parent, writable message/severity fields, required-value mappings and effective create access **before** attempting log DML. The settings path requires `ER_MCP_Admin`. No dedicated MCP history object is installed.

The sink accepts INFO, WARN and ERROR, enforces a Studio-source allowlist and caps attempts at ten events per transaction. It is best effort: a failed log write must not break the originating business operation. The existing implementation uses an administrator-configured Salesforce object and user-mode write checks; it is not guaranteed to persist when the enclosing transaction rolls back. The latest-five MCP invocation view depends on configured accessible persisted records, not on a guaranteed durable independent event stream. The UI's broader diagnostic buffer is session-scoped.

### 20.2 Logging semantics and privacy

MCP events are marked `ER_STUDIO_MODELLER_MCP`; other Studio diagnostics use `ER_STUDIO_MODELLER`. MCP logging captures a sanitised tool identifier, outcome, duration and presence indicators, **not** field names, request bodies, access tokens, credentials, session IDs or raw evidence. Do not use logging as a second data-exfiltration channel. Error payloads must be sanitised before emission. Logging must not grant a caller access to diagnostics that the caller could not otherwise read.

```mermaid
sequenceDiagram
    participant T as MCP tool / Studio operation
    participant L as Shared diagnostic service
    participant C as Validated logging configuration
    participant O as Chosen Salesforce log object
    T->>L: event(source, operation, severity, sanitised message)
    L->>L: Validate allowlist and transaction cap
    L->>C: Resolve opt-in configuration
    alt Enabled and permitted
        C->>O: User-mode best-effort insert
        O-->>L: Result
    else Disabled, invalid or inaccessible
        C-->>L: No record
    end
    L-->>T: Continue without propagating logging failure
```

Durable scan state remains in Field Usage run/work-unit records. The system cannot guarantee logging of every exception, unhandled rollback or async failure; Salesforce platform logs and durable checkpoints complement it. For precise capture scope see [DIAGNOSTIC_COVERAGE.md](DIAGNOSTIC_COVERAGE.md).

## 21. Future extension — headless Microsoft Teams adapter (not implemented)

The planned Teams integration is an **adapter** over the same Salesforce Hosted MCP tools, not a separate architecture-intelligence service. It may offer an explicit **Connect Salesforce Org** experience and headless invocation after authorisation, without opening Studio. Headless does **not** mean anonymous or permission-free.

```mermaid
flowchart LR
    Person["Teams user"] --> Bot["Future Teams bot / adapter"]
    Bot --> Identity["Delegated Salesforce identity<br/>and entitlement mapping"]
    Identity --> MCP["Salesforce Hosted MCP"]
    MCP --> Guard["Diagram Studio entitlement<br/>plus per-tool permissions"]
    Guard --> Evidence["Existing snapshot intelligence"]
    Guard -->|Denied| Block["No disclosure"]
```

Do not use a single privileged bot service account to expose snapshot evidence to users who lack Diagram Studio entitlement. Require identity binding, least privilege, token protection, revocation handling, auditability and negative permission tests. No Teams code or configuration is claimed to exist in V4 today.

## 22. V4 release gates and engineering follow-up

1. Implement and test the shared Diagram Studio entitlement guard in **all four** Apex actions before external MCP enablement.
2. Verify Salesforce Hosted MCP custom server activation and authorised Postman MCP discovery/invocation in `warden-dev`.
3. Test unauthorised user, revoked access, disabled tool, CRUD/FLS, scan cooldown and active-scan rejection.
4. Verify both simple and parent/child diagnostic mappings, least-privileged log writes, missing/invalid configuration and rollback limitations.
5. Preserve no-secrets/no-raw-request logging and bounded query/pagination behaviour.
6. Keep Teams integration explicitly future-state until separately designed, secured and tested.
