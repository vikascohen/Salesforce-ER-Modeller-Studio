# V5 DSL compiler

**Crius Consulting · Maintainer: Vikas Cohen · Updated: 8 November 2026**

The compiler turns saved DSL into the active ER model used by the canvas, viewer, analysis and exports. It composes files/modules, validates active declarations and preserves source locations for errors. It does not deploy Salesforce metadata or execute database procedures. Existing flat DSL remains supported.

This is the consolidated V5 language reference. For installation and modelling workflows, see [Setup](docs/SETUP.md). The [V5 release notes](docs/V5_RELEASE_NOTES.md) list the complete feature set.

## Entities and fields

```text
entity Account : Name, Description
entity Contact : LastName[Required], Email
Contact.AccountId -> Account
```

`Id` is added automatically. Field lists are optional. Optional bracket metadata records display types, `Required` and `rollup` markers. Entity names are matched case-insensitively, preserving first display casing. A relationship adds its child field and can create an implicit entity for an undeclared endpoint. Exact duplicate relationships are normalised; self-relationships and multiple polymorphic targets are supported.

| Operator | Meaning | Direction |
| --- | --- | --- |
| `->` | Lookup, blue | Child field to referenced parent |
| `=>` | Master-detail, purple | Detail field to master |
| `~>` | Polymorphic lookup, dashed red | Child field to each declared target |

The operator declares model semantics; typing it does not change the Salesforce relationship. A manual declaration is not proof of actual org metadata. Use `#` for a whole-line comment. Inline comments and semicolon statement separators are not part of this syntax.

## Field metadata and relationship examples

```text
entity Opportunity : Name[Required], Amount[Currency], CloseDate[Date]
entity Invoice__c : Total__c[Number(16, 2), Required], Sum__c[rollup]
Opportunity.AccountId -> Account
Task.WhoId ~> Contact
Task.WhoId ~> Lead
```

Commas inside field brackets do not split the field list. `Required` and `rollup` are markers; other bracket text records the display type. A bare field does not imply Text. Repeating a polymorphic child field with different `~>` targets makes each target explicit. Unknown arrows such as `-->` are errors. Id-only entities and exact duplicate relationship declarations are supported.

Saved coordinates, section colours and generated field ordering are presentation behaviour, not compiler keywords. A reference field whose parent is absent can remain a plain field with its relationship-type label; adding a parent does not silently rewrite shared source. Use the editor to make an intended relationship explicit.

## Exported modules are definitions

Save this as **customer.dsl**:

```text
export module Customer {
    entity Account : Name, Description
    entity Contact : LastName, Email
    Contact.AccountId -> Account
    component ApexClass CustomerService label "Customer service"
}
```

This definition alone renders no cards or entities. Add `use Customer` in the same file to activate it, or import it from another file. Only exported modules can be activated or inherited. Nested module definitions are not supported. Keywords and module names are case-insensitive.

## Imports and activation

Save a second file as **sales.dsl**:

```text
import customer.dsl
use Customer
entity Opportunity : Name, Amount
Opportunity.AccountId -> Account
```

The active model contains Account, Contact, Opportunity and the CustomerService card. Top-level declarations render alongside activated modules. Importing a file exposes its exported modules; it does not draw that file's top-level declarations or automatically activate its modules.

Use plain filenames, without quotes, `./` or directory paths. Filenames are unique across the org, ignoring case and the optional `.dsl` suffix. The server enforces the filename constraint; it does not silently rename a duplicate file. Imported records must be readable by the current user.

A named import selects one exported module:

```text
import Customer from customer.dsl
use Customer
```

Saved bindings retain target record IDs across library renames. Existing saved imports can continue resolving the renamed record; new imports use its new filename. Imports read the latest saved source, not a pinned revision. Save library edits and use **Refresh imports** to reload them. Unsaved edits in another tab are not an imported version.

## Additive inheritance

```text
import Customer from customer.dsl
export module Sales extends Customer {
    entity Opportunity : Name, Amount, CloseDate
    Opportunity.AccountId -> Account
}
use Sales
```

`extends` activates the exported base before the child. It adds declarations rather than overriding them. Conflicting active field types, non-polymorphic relationship targets/kinds or component display labels are errors. Repeated activation of the same module is deduplicated. A module body can also activate another exported module with `use`; use/inheritance cycles are rejected.

## Named component and access cards

```text
component ApexClass CustomerService label "Customer service"
component Flow Customer_Onboarding label "Customer onboarding"
component PermissionSet Customer_Admin label "Customer Admin"
component PermissionSetLicense Customer_Feature label "Customer feature licence"
component UserLicense Salesforce_User label "Salesforce"
component PackageLicense Customer_Package label "Customer package"
```

These are the six supported card types. Names use identifier syntax; labels are optional JSON double-quoted strings with JSON escaping. A label changes display text, not identity. These examples are manual declarations, not evidence of installed components or required licences.

Cards can appear at top level or inside an exported module and round-trip through saved DSL and exports. They are not sObject tables or ordinary ER relationship endpoints. Platform events (`__e`) and custom metadata (`__mdt`) remain **entities**, grouped into their own canvas sections; they are not extra component types. LWC/Aura are generation roots and scan evidence sources, not additional DSL card types in V5.

## Compilation and diagnostics

1. Resolve readable saved imports and index exported symbols.
2. Expand the root file's top-level statements and explicitly activated modules; include inherited bases first.
3. Parse the active entities, fields, relationships and component declarations, checking composition conflicts.
4. Render the resulting model. Errors from composed statements include their source filename and line.

Imports and module block structure are checked during composition. Inert module bodies are not rendered; active declarations are parsed when emitted. Unknown exports, ambiguous names, missing/inaccessible files, malformed labels and cycles produce errors. Composition is bounded to **32 files including the root**, **16 import levels**, and **1,048,576 characters** of source. The server also bounds fetched imports; the client compiler reports composition cycles.

During editing, incomplete `use` statements show current validation beside the editor. Correcting the text clears that validation; typing errors do not become persistent error-history events. The last valid canvas remains during invalid edits. Genuine operation diagnostics and previously recorded history remain separate. An export-only document is a valid empty model.

## IntelliSense and editing

Completion covers DSL keywords, saved filenames, exported module names, named-import `from`, inheritance `extends`, entity/field references, the six card types, component identities and JSON-escaped labels. Apex/Flow name lookup uses the tooling connection; access names come from declarations/imports and the selected app's resolved cards. Completion tolerates incomplete source and does not guarantee that every suggested reference will resolve or be readable.

For modular files, edit shared entity/field definitions in the DSL; canvas schema deletion and field reconciliation are guarded to avoid rewriting reusable definitions. Layout and dragging remain available. Ordinary flat-model editing continues to work. No org scan is required to author modules. App generation separately requires a successful suitable scan and writes the generated model back to the DSL before rendering. The newer app-page option can also contribute readable UI configuration fields, with live provenance separate from the scan. It never adds the entire object schema.

## Implementation references

- [dslModules.js](force-app/main/default/lwc/dslModules/dslModules.js): module/import composition and completion indexing.
- [erDiagramLogic.js](force-app/main/default/lwc/erDiagramLogic/erDiagramLogic.js): ER parsing, conflict checks and layout.
- [DslFileService.cls](force-app/main/default/classes/DslFileService.cls): sharing-aware import resolution and saved bindings.
- [DiagramFileController.cls](force-app/main/default/classes/DiagramFileController.cls): saved-file operations.
- [Module compiler tests](force-app/main/default/lwc/dslModules/__tests__/dslModules.test.js) and [ER parser tests](force-app/main/default/lwc/erDiagramLogic/__tests__/erDiagramLogic.test.js).

V5 does not implement stored procedures, runtime execution, destructive inheritance overrides or automatic Data Cloud model discovery.
