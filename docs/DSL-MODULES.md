# Reusable DSL modules

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

Inheritance is additive: it includes the base before the child. Conflicting field types or relationship definitions fail rather than silently override. Circular imports, module cycles, missing exports and ambiguous symbols produce errors with source filenames and line numbers. Graphs are limited to 32 files, 16 import levels and 1 MB of text.

Autocomplete covers keywords, filenames, exported modules, inheritance, entity/field references, component types, and readable Apex/Flow names from the org. Apex/Flow name suggestions require the existing tooling connection.

Canvas, viewer, architecture analysis and exports use the activated model. For modular files, edit entity deletion and field changes in the DSL definition; canvas schema editing is guarded to preserve shared definitions. Dragging, layout and existing flat-model editing remain available. No org scan is needed to write modules.
