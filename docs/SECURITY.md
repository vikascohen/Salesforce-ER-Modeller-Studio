# Security overview

This document is for anyone reviewing this app before granting access to
it in an org — what it touches, what it doesn't, and one deliberate
design decision that needs to be understood, not just accepted on faith.

## Summary

- **The Studio does not display, persist, export, or transmit Salesforce record values.** Its primary purpose is schema and architecture analysis using metadata such as object names, field names, field types, descriptions, relationships, and sharing-model information.
- **Two opt-in features perform aggregate record-data reads inside the org:** the record-count heatmap uses aggregate record queries, and Data Dictionary `% Used` calculates aggregate non-blank usage for a selected field. These features return counts/percentages only; individual record values are not displayed, stored, exported, or sent anywhere.
- **Nothing is sent to an external application server or telemetry service.** Version 2 Stable runs inside Salesforce and does not make outbound HTTP callouts.

## What this tool actually reads

| Feature | What it reads | What it never exposes or persists |
|---|---|---|
| Canvas / DSL editor / import | Object and field names, labels, data types, relationships (via Apex `Schema` describe and `EntityDefinition`/`FieldDefinition`) | Record values |
| Data Dictionary | Same, plus field descriptions and last-modified dates (`FieldDefinition`) | Record values |
| Sharing View | Each object's org-wide default sharing setting (`EntityDefinition.InternalSharingModel`/`ExternalSharingModel`) | Individual records or a user's effective record access |
| Heatmap | Aggregate record count/activity information for represented objects | Individual records or field values |
| % Used (Data Dictionary) | Aggregate counts used to calculate the percentage of non-blank values for one field at a time | The field values themselves; values are never displayed or stored |
| Mermaid / draw.io / PNG export | Schema and architecture metadata already represented in the Studio | Record values |
| Saved diagrams (`Diagram_File__c`) | The DSL text a user typed (entity/field/relationship names), stored as a normal Salesforce record | A copy of Salesforce business-record data |

## Deliberate schema-visibility design decision

The Studio is an architecture and schema-analysis tool, so authorised users need to be able to inspect the Salesforce schema visible to the running Apex context. The application therefore treats **schema metadata visibility separately from business-record visibility**.

Schema describe information such as object names, field names, field types and relationships is used to build the model even when a user would not necessarily have access to every business record represented by that schema. This is intentional: the product is designed to explain the structure of the org, not to expose record contents.

That decision does **not** bypass Salesforce record sharing for business-record queries, and it does not grant users additional CRUD or field-level permissions. Features that perform aggregate record queries still run in Salesforce and must satisfy the explicit permission checks implemented for those paths.

Metadata catalog features that rely on `EntityDefinition` or `FieldDefinition` may additionally require **View Setup and Configuration**. Where that permission is absent, affected metadata enhancements degrade gracefully rather than exposing additional information.

## Where this app runs, and where it doesn't

Version 2 Stable is a native Lightning Web Component + Apex application. It runs inside the installing Salesforce org and does not use an external application server or telemetry service. Saved diagrams use normal Salesforce storage. The Version 2 Stable code does not make outbound HTTP callouts.

## Technical measures in place

- **Apex controllers use `with sharing` where record-sharing enforcement is required.** `with sharing` enforces Salesforce record-level sharing rules. It does **not** automatically enforce object CRUD or field-level security, so those controls are handled separately where the application reads or writes protected data.
- **CRUD permission checks gate writes** to application-owned records such as `Diagram_File__c` and to Salesforce Files objects (`ContentVersion` / `ContentDocumentLink`) using the appropriate describe checks such as `isCreateable()`, `isUpdateable()`, and `isDeletable()`.
- **Field- and object-level access is not assumed to come from `with sharing`.** Where user-mode queries or explicit describe checks are appropriate, they are used independently of record-sharing enforcement.
- **No dynamic SOQL is built from unvalidated object or field identifiers.** API names concatenated into dynamic SOQL are validated against a strict letters-digits-underscore identifier pattern before execution; invalid identifiers are rejected.
- **Metadata catalog queries** (`EntityDefinition`, `FieldDefinition`) use `WITH USER_MODE` where applicable. This governs the catalog query's execution context but does not replace the deliberate schema-visibility model described above.
- **Aggregate record-data features are intentionally narrow.** Heatmap and `% Used` return aggregate counts/percentages only. They do not surface the underlying record values to the browser or persist those values in the application.
- **No hardcoded credentials, stored secrets, external telemetry, or outbound callouts** are present in Version 2 Stable.
