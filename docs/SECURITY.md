# Security overview

This document is for anyone reviewing this app before granting access to
it in an org — what it touches, what it doesn't, and one deliberate
design decision that needs to be understood, not just accepted on faith.

## Summary

- **No Salesforce record data is ever read, stored, transmitted, or
  displayed by this tool.** It works entirely with schema *metadata* —
  object names, field names, field types, relationships — never the
  values inside your records.
- **Nothing leaves the org.** There are no external HTTP callouts
  anywhere in this codebase. Every read and write happens inside
  standard Salesforce Apex, LWC, and the Salesforce Files (ContentVersion)
  mechanism.


## What this tool actually reads

| Feature | What it reads | What it never reads |
|---|---|---|
| Canvas / DSL editor / import | Object and field names, labels, data types, relationships (via Apex `Schema` describe and `EntityDefinition`/`FieldDefinition`) | Any record, any field value |
| Data Dictionary | Same, plus field descriptions and last-modified dates (`FieldDefinition`) | Any record, any field value |
| Sharing View | Each object's org-wide default sharing setting (`EntityDefinition.InternalSharingModel`/`ExternalSharingModel`) | Any record, any field value, any individual's actual access |
| Heatmap | A `COUNT()` of records per object — a single number, nothing else | Any field value, any individual record |
| % Used (Data Dictionary) | A count of non-blank values for one field at a time, expressed as a percentage | The values themselves — never displayed, never stored |
| Mermaid / draw.io / PNG export | The same schema metadata above, rendered as text or an image | Any record, any field value |
| Saved diagrams (`Diagram_File__c`) | The DSL text a user typed (entity/field/relationship *names*), stored as a normal Salesforce record | Nothing beyond what the user typed — this is not a copy of anything, it's the user's own notation |


## Where this app runs, and where it doesn't

This is a native Lightning Web Component + Apex application. It runs
entirely inside the installing org. There is no external server, no
middleware, no third-party API this app calls out to, and no telemetry
sent anywhere. Reading the Apex classes confirms this directly: there is
no `Http`/`HttpRequest` usage anywhere in this codebase, which is the
only mechanism Apex has for making an external call at all.

## Technical measures in place

- **`with sharing` is declared on every Apex controller class**
  (`DiagramFileController`, `SchemaMetadataController`,
  `DiagramPreferenceController`) — record-level sharing and CRUD/FLS
  enforcement apply to every query and DML statement by default, not
  as an opt-in.
- **No dynamic SOQL is built from unvalidated input.** Object and field
  API names that get concatenated into dynamic SOQL (required in a
  handful of places, since Apex doesn't support bind variables for
  object/field names) are validated against a strict
  letters-digits-underscore pattern (`isSafeIdentifier()`) before ever
  reaching a query — anything else is rejected before it can be executed.
- **CRUD permission checks gate every write** to `Diagram_File__c` and
  to `ContentVersion`/`ContentDocumentLink` (`isCreateable()`/
  `isUpdateable()`/`isDeletable()`), independent of the sharing-model
  enforcement described above.
- **Metadata catalog queries** (`EntityDefinition`, `FieldDefinition`)
  use `WITH USER_MODE` where applicable — this affects catalog access,
  not the schema-visibility design decision described above, which is
  deliberate rather than something USER_MODE would or should change.
  Viewing this catalog generally requires **View Setup and
  Configuration** (most System Administrator-type profiles have it by
  default). A user who lacks it isn't blocked from the tool — Sharing
  View and the Data Dictionary's description/last-modified columns just
  degrade gracefully (badges don't show, those columns show blank)
  rather than erroring.
- **No hardcoded credentials, no stored secrets, no external callouts**
  anywhere in the codebase.


