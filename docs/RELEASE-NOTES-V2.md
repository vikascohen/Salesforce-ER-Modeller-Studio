# Version 2 Release Notes

**Salesforce ER Modeller Studio**  
**Version:** 2  
**Branch:** `version-2-stable`  
**Release status:** Semi-stable  
**Author:** Vikas Cohen

## Overview

Version 2 extends Salesforce ER Modeller Studio from visual ER modelling into **Data Architecture Intelligence**. The Phase 1 DSL compiler, modelling workflow and visual canvas remain the foundation. Version 2 adds architecture analysis over the ER model currently loaded in the Studio.

The intelligence is deliberately evidence based. It analyses the current ER source and parsed model rather than pretending to know live Salesforce record volumes, runtime usage, Apex, Flow, reports, integrations or other metadata that is not present in the model.

No Apex classes were changed as part of Version 2. The Phase 2 additions are implemented in the LWC and JavaScript architecture layer.

## New Features

### 1. Data Architecture Intelligence

A dedicated architecture workspace has been added for analysing the structure represented by the current ER model.

The workspace identifies the active ER file and derives architecture information from the same model already rendered on the canvas. It does not maintain a second independent model or parser.

### 2. Architecture Overview

Architecture Overview provides a structural summary of the current model, including model size, relationships and architectural characteristics derived from the graph.

It is intended to help an architect quickly understand the shape of an unfamiliar model and identify areas worth investigating further.

### 3. Object Map & Impact

Object Map provides a one-object architectural view.

For a selected object it can show:

* architectural role and structural position
* incoming and outgoing dependencies
* parent and target objects
* child and dependant objects
* field information available in the model
* structural reach through the relationship graph
* change impact and blast-radius information

Object Impact is intentionally integrated into Object Map rather than exposed as a duplicate feature.

### 4. Relationship Path Finder

Relationship Path Finder answers a different question from Object Map: **how are two objects connected?**

An architect can select a source and target object and inspect the shortest relationship path found in the current architecture graph.

This makes indirect dependencies easier to understand without manually tracing relationships across a large ER diagram.

### 5. Object Usage & Change Readiness

Object Usage & Change Readiness provides an evidence-based assessment of a custom object's structural role before an architect considers changing or removing it.

The view separates dependencies into:

* **Depends on** — objects referenced by the selected object
* **Depended on by** — objects that reference the selected object

Only custom objects are selectable as change or removal candidates. Standard Salesforce objects can still appear as dependencies but are not presented as removal candidates.

The assessment is intentionally conservative. An isolated object in the ER model is not described as unused or safe to delete because the Studio does not have evidence of live records or runtime usage.

### 6. Explicit External Reference Detection

Version 2 distinguishes between objects explicitly declared in the ER source and relationship targets that are referenced but not declared in that diagram.

These are surfaced as **Referenced objects outside the declared diagram**.

This is useful for models that deliberately show only part of a Salesforce data architecture. It does not imply that all external dependencies in the Salesforce org have been discovered.

### 7. Relationship Insights

Relationship Insights provides architecture-level analysis of the relationships in the current model.

It includes:

* a relationship dependency diagram
* relationship direction
* Lookup, Master Detail and Polymorphic relationship semantics
* relationship detail
* record deletion considerations
* schema and change-impact considerations
* per-object dependency summaries
* declared versus externally referenced targets

Relationship type is communicated through the diagram legend and connector styling rather than repeated as text on every graph edge.

### 8. Improved Relationship Graph Layout

The Relationship Insights graph now uses a dependency-oriented layered layout rather than the earlier generic grid arrangement.

The layout is designed to reduce unnecessary crossing and make child-to-parent dependency direction easier to follow.

Self relationships are intentionally omitted from Relationship Insights because they add visual noise to a dependency map. They remain part of the underlying ER model and are not removed from the source.

### 9. Junction Object Intelligence

Version 2 can identify junction-object patterns from relationship evidence in the current model.

Strong junction patterns can be recognised from multiple custom Master Detail relationships to distinct parent objects. The implementation uses the parsed relationship graph and does not require a separate metadata engine.

### 10. Architecture Graph Engine

A reusable graph index underpins the Phase 2 intelligence features.

The engine supports:

* graph metrics
* inbound and outbound relationship indexes
* object-level analysis
* shortest relationship paths
* blast-radius analysis
* structural reach
* junction detection
* cycle-aware architecture analysis

The graph index is reused across architecture operations to avoid repeatedly rebuilding the same relationship information.

### 11. Clear / Refresh Architecture Analysis

A persistent **Clear / Refresh** action resets Architecture Intelligence and rebuilds the analysis from the ER source currently loaded in the Studio.

It clears architecture selections and cached analysis state so architects can deliberately start again from the current model.

### 12. Active File Visibility

Architecture Intelligence now displays the name of the ER file being analysed.

This makes the evidence boundary explicit and reduces the risk of assuming that architecture findings represent something other than the model currently loaded on the canvas.

## Architecture and Scope

Version 2 does **not** introduce AI-generated architecture recommendations. The architecture intelligence is deterministic and based on the ER model.

Version 2 also does not introduce Tooling API based object-usage analysis. Therefore the Studio does not claim to know:

* live record counts
* whether an object is genuinely unused
* last-used dates
* Apex dependencies not represented by the ER model
* Flow dependencies not represented by the ER model
* report or dashboard dependencies
* integration dependencies
* complete Salesforce org metadata dependencies

Where evidence is unavailable, the UI states that limitation rather than inventing a conclusion.

## Phase 1 Compatibility

The Phase 1 modelling foundation remains intact, including the DSL compiler and the existing ER modelling workflow.

Version 2 builds architecture intelligence on top of the parsed ER model rather than changing the purpose of the DSL compiler.

No Apex production class or Apex test class was modified between `version-1-stable` and `version-2-stable` as part of the Phase 2 work.

## LWC Structure

The current Version 2 branch contains five LWC bundles:

* `architectureIntelligence`
* `diagramExportUtils`
* `diagramStudio`
* `diagramViewer`
* `erDiagramLogic`

The architecture engine is kept reusable so the UI does not need to duplicate relationship-analysis logic.

## Testing and Reliability

Phase 2 includes expanded Jest coverage for the architecture engine and Architecture Intelligence UI.

The automated suite currently validates areas including:

* graph construction and metrics
* malformed-model handling
* path finding
* blast radius
* junction detection
* graph-index reuse and performance behaviour
* custom-only Object Usage selection
* standard-object dependency visibility
* explicit external references
* active filename display
* Clear / Refresh behaviour
* Object Map and Relationship Path Finder separation
* Relationship Insights dependency direction
* self-relationship omission from Relationship Insights
* prevention of visible relationship-type text on individual graph connectors

The full LWC Jest suite was executed through GitHub Actions on the Phase 2 semi-stable branch with **109 tests passing, 0 failing across 5 test suites**.

## Version 2 Principle

Version 2 is intended to help Salesforce architects move from:

**“What does this ER diagram contain?”**

to:

**“What does this model tell me about the architecture, dependencies and potential impact of change?”**

The Studio remains an architecture and design tool. Its findings should be combined with Salesforce metadata, runtime evidence, business knowledge and normal engineering review before production changes are made.
