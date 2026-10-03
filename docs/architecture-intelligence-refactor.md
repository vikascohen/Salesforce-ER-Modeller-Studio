# Architecture Intelligence Refactor

**Author: Vikas Cohen**

Architecture Intelligence analyses the current or selected ER model and provides progressively deeper evidence for change decisions. It is decision support, not an automatic compliance scanner.

## Primary experiences

1. **Architecture Overview** — What does this model look like and what deserves attention?
2. **Object Impact** — If this object changes, what structural areas should be investigated?
3. **Relationship Insights / Finder** — How is the model connected and how are two objects related?
4. **Field Usage** — Where is a selected field actually referenced in the Salesforce implementation?
5. **Architecture Findings** — What structural patterns deserve architectural review, why do they matter, and what can be improved?

Architecture Findings are part of the Architecture Intelligence story rather than a duplicate overview. The former duplicate **Field Change Impact** experience is not a separate product surface: detailed field-level blast-radius analysis belongs to **Field Usage**.

## Field Usage ownership

Field Usage has one analysis experience and one operational control centre.

### Architecture Intelligence → Field Usage

This is the consumption experience. It answers: **“Before I change this field, where is it used and what implementation dependencies should I inspect?”**

The dependency map is the primary view. It consumes the latest successful persisted snapshot and supports Apex Class, Apex Trigger, Flow, LWC, Aura, Validation Rule and Formula Field evidence. Detailed evidence is loaded on demand so large snapshots do not need to be hydrated into the browser.

Field Usage is org-wide dependency intelligence. The ER model provides architectural context, but dependencies outside the selected diagram must not be hidden if they reference the selected field.

Formula evidence includes reverse dependencies. A formula owned by another object should be reported against the referenced field, for example `Contact.FirstName ← Case.Customer_Display_Name__c`, where Salesforce relationship metadata can resolve the reference reliably.

### Settings → Field Usage

This is the collection and maintenance experience. It owns:

- **Snapshot Status** — latest successful scan, age and dependency/evidence counts.
- **Run Scan Now** — explicit refresh with transparent processing state.
- **Automatic Scans** — scheduling and enable/disable controls.
- **Scan Jobs / History** — durable run/job status and failures.
- **Scanner Coverage** — Apex Class, Apex Trigger, Flow, LWC, Aura, Validation Rule and Formula Field status/capability.

A partial scanner failure must be visible rather than presenting the whole snapshot as unqualified success. The previous successful snapshot remains usable while a new scan is running.

## Finding contract

Every actionable finding must provide: what was found, why it matters, evidence, recommendation, modelling actions, trade-offs and limitations. Structural observations must not be presented as guaranteed business/runtime impact.

## Performance contract

The selected ER model is normalised/analyzed once and deterministic results may be cached by model fingerprint. Large graphs use progressive or clustered rendering rather than creating the full graph DOM at once. Field Usage scanning is asynchronous and persisted; switching between summary, map and evidence views must not trigger an org-wide rescan.

Formula scanning parses each formula once and emits dependency evidence for references it contains. It must not compare every formula against every field.

## Processing UX

When analysis is not effectively immediate, expose real stages: Preparing model; Mapping relationships; Analysing architecture patterns; Evaluating architecture guidance; Building recommendations; Preparing visualisations. Do not display fabricated percentages.

Field Usage scan progress must similarly expose real durable state so the user knows whether work is queued, running, completed, partially failed or failed.

## Visual UX

Maps are primary evidence. Shared interaction behaviour should include fit, zoom, pan, scroll, maximise/restore, resize, collapse/expand, outer padding and complete export without clipping. Text explains the visual; technical graph terminology is progressive disclosure.

The interface should tell its own story to Salesforce and non-Salesforce audiences. Headings and summaries should explain the architectural question being answered before exposing platform-specific terminology.

## Navigation contract

- **View** is for things the user looks at, not maintenance operations.
- **Architecture Intelligence** is for analysis, including Field Usage.
- **Settings** is for configuration, diagnostics and Field Usage snapshot maintenance.
- Do not maintain a second standalone Field Usage workflow or duplicate Field Change Impact workspace.

Help, user-manual text, empty states, tooltips and README material must use this navigation consistently.
