# Reusable DSL modules

See [Compiler.md](../Compiler.md) for the complete V5 compiler overview and implementation links.

An exported module is a definition. Its entities, relationships and component cards stay off the canvas until activated with `use`. Keywords and module names are case insensitive. Existing flat DSL still works.

```text
export module Customer {
    entity Account : Name
    entity Contact : Name, Email
    Contact.AccountId -> Account
    component ApexClass CustomerService
}

use Customer
entity Opportunity : Name
Opportunity.AccountId -> Account
```

Remove `use Customer` and only the top-level Opportunity declaration and relationship render. Relationships retain the existing DSL operator meanings. Definitions alone produce an empty, valid canvas. Only exported modules can be used.

Save shared definitions with a unique filename, such as `customer.dsl`. Another saved file can contain:

```text
import customer.dsl
use Customer
entity Case : Subject
Case.AccountId -> Account
```

Imports load exported symbols, not the imported file’s top-level model. Named imports are supported: `import Customer from customer.dsl`. Use plain filenames, without `./` or directories. Filenames are unique across the org, ignoring case and the optional `.dsl` suffix. Access to imported records is still required. Saved imports bind to record IDs so renaming a library file does not break existing references. New imports use its new name. Imports use the latest saved source; Refresh imports reloads it.

```text
import customer.dsl
export module Sales extends Customer {
    entity Opportunity : Name, Amount
    Opportunity.AccountId -> Account
}
use Sales
```

Inheritance is additive: it includes the base before the child. Conflicting field types, relationship definitions or component display labels fail rather than silently override. Circular imports, module cycles, missing exports and ambiguous symbols produce errors with source filenames and line numbers. Graphs are limited to 32 files, 16 import levels and 1 MB of text.

IntelliSense covers keywords, filenames, exported modules, named-import `from`, inheritance `extends`, entity/field references, all six component types and optional `label` JSON strings. Apex/Flow names use the tooling connection. PermissionSet, PermissionSetLicense, UserLicense and PackageLicense suggestions come from local/imported declarations and the selected app’s resolved cards, including after saved DSL is reopened. Display labels are inserted with JSON escaping. Incomplete text does not crash the completion index.

Canvas, viewer, architecture analysis and exports use the activated model. For modular files, edit entity deletion and field changes in the DSL definition; canvas schema editing is guarded to preserve shared definitions. Dragging, layout and existing flat-model editing remain available. No org scan is needed to write modules.


Named cards may be exported and reused like entities:

```text
export module LoggerAccess {
    component PermissionSet LoggerAdmin label "Nebula Logger: Admin"
    component UserLicense SalesforceLicence label "Salesforce"
}
use LoggerAccess
```

The example declares a model; writing a licence card manually does not prove the app requires that licence. App-generated access cards require actual metadata evidence. See [DSL.md](DSL.md) and [APP-ACCESS-CARDS.md](APP-ACCESS-CARDS.md).


During editing, `use` and `use cus` are incomplete/unknown references. Their inline validation disappears when `use Customer` becomes valid; they are not persisted as unread Error Log events. The last valid canvas remains until correction. Existing historical diagnostics and real operation failures are preserved.
