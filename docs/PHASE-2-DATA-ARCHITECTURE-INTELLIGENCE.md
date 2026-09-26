# Phase 2 — Data Architecture Intelligence

Phase 2 extends ER Modeller Studio from visual modelling into **data-architecture intelligence** while keeping the product deliberately focused.

## Product boundary

ER Modeller Studio analyses the structure of a Salesforce data model: objects, fields, relationships, graph topology, coupling and model evolution. It does **not** evaluate CRUD/FLS, permission sets, vulnerabilities, code security or security posture. Those concerns belong to Warden Studio.

## First Phase 2 capability

**View → Architecture Intelligence** opens a compact architecture panel for the diagram currently on the canvas. Analysis is local and deterministic over the parsed ER model; it does not require another API call.

It reports:
- object, field and relationship totals;
- Lookup, Master-Detail and Polymorphic relationship counts;
- custom-object count;
- incoming/outgoing relationship degree per object;
- structural hubs and isolated objects;
- connected-component count;
- maximum relationship depth;
- detected relationship cycles.

These are descriptive graph metrics, not an arbitrary health score. The intent is to give architects evidence they can interpret rather than label an architecture “good” or “bad”.

## Phase 2 direction

Later Phase 2 work can add schema snapshots/drift history, domain grouping and cross-domain coupling, path/blast-radius exploration, documentation coverage and model-growth trends. Security analysis remains outside this product.

## Branching

- `main` — untouched Phase 1 production line.
- `phase-1-stable` — preserved copy of Phase 1.
- `phase-2-data-architecture-intelligence` — all Phase 2 development.

## Performance principles

Architecture Intelligence is designed for interactive use on large Salesforce models. Analysis is performed locally over the already-parsed diagram, with no additional server round-trip. Graph depth uses bounded breadth-first traversal rather than exponential longest-simple-path enumeration; cycle discovery is depth- and result-limited; and the LWC caches analysis for an unchanged DSL source so reactive getters do not repeatedly recompute the graph.

The feature should continue to prefer deterministic O(V+E) / polynomial graph operations, bounded result sets and lazy/on-open computation as new intelligence capabilities are added.
