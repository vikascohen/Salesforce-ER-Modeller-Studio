# ER Modeller Studio — Version 1 Release Notes

**Release:** Version 1  
**Phase:** Phase 1  
**Status:** Stable

## Overview

ER Modeller Studio Version 1 provides a Salesforce-native workspace for creating, importing, exploring, validating and sharing entity relationship diagrams. Phase 1 combines a lightweight modelling language with live Salesforce schema metadata so that diagrams can be created manually or generated from an org and then maintained as reusable Salesforce records.

The following capabilities are included in Version 1.

## Phase 1 Features

### 1. ER Modelling DSL and Compiler

ER Modeller Studio includes a purpose-built domain-specific language (DSL) for describing Salesforce entities, fields and relationships. The compiler parses the DSL and converts it into the internal model used to render the diagram.

The DSL supports entity definitions, field definitions, data type annotations, required-field annotations, roll-up summary annotations, relationships, self-relationships and polymorphic relationships. Entity matching is case-insensitive to avoid duplicate entities caused only by casing differences.

### 2. Interactive ER Diagram Canvas

Models are rendered on an interactive canvas where users can visually explore the data model. Entity boxes can be moved and resized, long field lists can be collapsed or restored, and the canvas supports zooming and automatic layout.

Focus mode allows a user to select an entity and temporarily emphasise that entity and its directly related objects while fading unrelated parts of the model.

### 3. Salesforce Org Schema Import

Users can import objects directly from the connected Salesforce org. ER Modeller Studio reads the org schema and generates the corresponding model, including fields, Salesforce data types, required fields and relationships between the selected objects.

This allows an existing Salesforce data model to become the starting point for documentation rather than requiring it to be recreated manually.

### 4. Object Palette

A searchable object palette provides access to Salesforce objects available to the user. Objects can be dragged onto the canvas.

When an added object has relationships to objects already present in the diagram, ER Modeller Studio can automatically add the relevant relationship information.

### 5. DSL Editor Assistance and Relationship Linting

The DSL editor provides modelling assistance while the user works, including autocomplete based on available Salesforce schema information.

A relationship linter identifies relationship fields that reference another entity already present in the diagram but are not yet represented by a relationship line, helping identify incomplete model definitions.

### 6. Salesforce Relationship Visualisation

Version 1 visualises Salesforce relationships directly on the ER diagram, including Lookup and Master-Detail relationships.

The renderer also handles self-referencing relationships, multiple relationships between the same pair of entities and genuinely polymorphic fields that can reference more than one target object.

### 7. Required Field and Field Metadata Visualisation

Fields imported from Salesforce retain useful schema characteristics in the model. Required fields are visibly identified and Salesforce field types are carried through into the diagram.

The modelling syntax also allows these characteristics to be represented manually, enabling imported and hand-authored models to use the same representation.

### 8. Compare Diagram with Org

The **Compare with Org** capability compares entities currently represented in the diagram with the connected Salesforce org.

It identifies fields that exist in the org but are missing from the diagram, as well as fields represented in the diagram that are no longer returned by the org schema. Users can use the comparison results to bring the model back into alignment with the current org structure.

### 9. Sharing View

Sharing View provides an object-level view of Salesforce sharing configuration for entities on the canvas.

It displays internal and, where applicable, external organisation-wide sharing defaults. This provides architectural context about how the represented objects are exposed without requiring the user to navigate separately through Salesforce Setup.

### 10. Sharing Rule and Apex Sharing Indicators

The object summary can inspect runtime sharing information through an object's share table and surface available sharing indicators.

The implementation deliberately distinguishes information that can be determined reliably from information that Salesforce does not expose unambiguously. For example, where Apex Managed Sharing cannot be reliably distinguished from manual sharing on a standard object, the tool reports that limitation rather than inferring an answer.

### 11. Object Activity Heatmap

The optional Heatmap provides a visual indication of object activity for entities currently on the canvas.

It uses aggregate information such as record count and most recent modification date to distinguish empty, recently active and stale objects. This provides an additional architectural view of whether parts of a data model appear actively used.

### 12. Object Summary Hover Card

Hovering over an entity provides a consolidated summary of available information about that object.

The card can include field count, standard/custom status, record activity, sharing defaults and available sharing information. Information from optional views is only shown when it has been retrieved, keeping the behaviour explicit.

### 13. Data Dictionary

Version 1 includes a dedicated Data Dictionary for browsing accessible Salesforce objects and their fields.

For a selected object, the dictionary can display information including field API name, label, description, Salesforce data type, required status, custom status, primary key status, foreign key information and field metadata where available.

Selected columns can be sorted, allowing the dictionary to be used as a practical schema reference alongside the visual ER model.

### 14. Field Usage Percentage

For an individual object, users can optionally calculate the percentage of records in which fields contain values.

Because this operation requires examining record data, it is deliberately user initiated rather than automatically executed when browsing the Data Dictionary.

### 15. Data Dictionary Export

Data Dictionary information can be exported for external documentation and analysis.

Version 1 supports CSV export for the selected object, Excel (.xlsx) export, and an Export All capability that produces a workbook containing multiple objects on separate worksheets.

### 16. PNG Diagram Export

The current ER diagram can be exported to PNG.

Version 1 supports native-size output as well as A4 and A3 landscape formats. The relationship legend is included in the generated image so the exported diagram remains understandable outside ER Modeller Studio.

### 17. Mermaid Export

ER Modeller Studio can generate Mermaid `erDiagram` syntax from the current model.

This allows diagrams to be incorporated into documentation platforms and source-controlled documentation that support Mermaid rendering.

### 18. draw.io / diagrams.net Export

The current model can be exported as a draw.io / diagrams.net file.

The export preserves the diagram's canvas positioning rather than generating an unrelated layout, allowing users to continue editing or incorporating the model into broader architecture diagrams.

### 19. Diagram Persistence in Salesforce

Diagrams can be saved as Salesforce records using the `Diagram_File__c` object.

The stored model includes the diagram name, type and DSL source. Users can reopen saved diagrams and continue working with them in the studio. Diagram names are validated for uniqueness to avoid ambiguous duplicate files.

### 20. Multi-File Workspace

The studio provides a workspace similar to a lightweight development environment, including a tab strip and diagram file list.

Users can work with multiple diagrams, open and switch between them, rename diagrams, duplicate them and delete diagrams without leaving the modelling workspace.

### 21. Read-Only Diagram Viewer

A separate `diagramViewer` Lightning Web Component is included for scenarios where users need to view a saved model without editing it.

The viewer can be placed on supported Lightning pages and configured to display a specific saved diagram. It also supports diagram viewing and PNG export independently of the editor.

### 22. Themes and User Preferences

Version 1 includes multiple workspace themes, including Dark+, Light+, Monokai and Solarized Light.

The selected theme is stored as a Salesforce user preference so it can follow the user across sessions and devices rather than existing only in local browser storage.

### 23. Salesforce-Native Security and Access

The application includes a dedicated permission set for granting access to the ER Modeller Studio components, Apex services and supporting Salesforce data structures.

Server-side functionality is separated into controllers responsible for diagram persistence, schema metadata and user preferences, keeping responsibilities clearly divided.

### 24. Automated Test Coverage

Phase 1 includes automated Apex and Lightning Web Component tests covering the major modelling, rendering, persistence, schema, export and user-interface behaviours.

The test suite includes coverage for the DSL/parser logic, diagram rendering logic, export utilities, editor workflows, viewer behaviour, schema metadata operations, preferences and diagram CRUD operations.

## Version 1 Summary

Version 1 establishes the Phase 1 foundation of ER Modeller Studio as a Salesforce-native modelling and schema exploration tool.

It supports the complete workflow from creating or importing a data model, visualising and validating relationships, examining live org metadata, documenting the model through the Data Dictionary, and exporting or sharing the resulting architecture.

Future capabilities can build on this foundation without changing the purpose of Version 1 documented here.
