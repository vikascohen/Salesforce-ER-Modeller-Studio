# ER DSL Reference

**Author: Vikas Cohen**

For the V5 compiler overview, activation model and implementation links, see [Compiler.md](../Compiler.md).

The ER DSL is a small, line-based format for describing Salesforce objects, fields and relationships. You normally do **not** need to write it by hand: Diagram Studio can generate DSL from Salesforce metadata, drag-and-drop modelling and editor assistance. See [Generating DSL instead of writing it](#generating-dsl-instead-of-writing-it).

V5 accepts entities, relationships, named component cards, module blocks, imports, `use`, comments and blank lines. Unrecognised active input produces a parse error; composed models retain source filenames and line numbers. Existing flat DSL remains supported.

## 1. Entity declarations

```text
entity <ObjectApiName> : <field1>, <field2>, <field3>
```

Examples:

```text
entity Account : Name, Industry, Phone
entity Contact : LastName[Required], FirstName, Email
entity Order__c : Order_Date__c, Status__c
```

The field list is optional:

```text
entity Account
```

Every entity receives an `Id` field automatically, so it does not need to be declared explicitly.

Entity names are matched case-insensitively by the current model while the first display casing is preserved. Salesforce API names, including namespaced API names, are represented as ordinary identifiers rather than through separate namespace syntax.

## 2. Optional field metadata

A field can be written as a bare API name:

```text
AnnualRevenue
```

or with optional metadata:

```text
AnnualRevenue[Currency]
LastName[Required]
TotalAmount__c[rollup, Required]
```

The bracket suffix can record a display type and the `rollup` and `Required` markers. These markers are case-insensitive. A bare field means that the DSL has not recorded type information; it does not mean the field is Text.

In normal org-import workflows Diagram Studio generates this metadata from Salesforce, so hand-authoring brackets is optional.

### Type labels containing commas

Salesforce-style type labels can themselves contain commas, for example:

```text
Amount__c[Number(16, 2), Required]
```

The current DSL should be treated as a compact human-readable format rather than a general-purpose type-expression language. Parenthesised type text belongs to the type label; top-level bracket markers such as `Required` and `rollup` are metadata markers. When in doubt, prefer DSL generated from org metadata rather than manually constructing complex type labels.

## 3. Relationships

```text
<ChildEntity>.<ChildField> <arrow> <ParentEntity>
```

| Arrow | Meaning | Visual treatment |
|---|---|---|
| `=>` | Master-Detail | Thick purple line, filled diamond, `N` to `1` |
| `->` | Lookup | Thin blue directional arrow, `N` to `1` |
| `~>` | Polymorphic lookup | Dashed red line, open diamond, `N` to `?` |

Examples:

```text
Contact.AccountId => Account
Contact.OwnerId -> User
Task.WhoId ~> Contact
```

The relationship field is added to the child entity automatically. A referenced parent can be declared before or after the relationship. If it has no explicit entity declaration, the model can create an implicit entity so the relationship has a target.

Exact duplicate relationships are normalised rather than rendered twice. Self-relationships are supported.

### Polymorphic relationships

A genuinely polymorphic field is represented by repeating the same child field with different targets:

```text
Task.WhoId ~> Contact
Task.WhoId ~> Lead

Task.WhatId ~> Account
Task.WhatId ~> Opportunity
```

This makes the multiple targets explicit in the source rather than hiding them behind special syntax. Use the polymorphic `~>` operator consistently for the same polymorphic field.

## 4. Comments

Comments occupy their own line and begin with `#`:

```text
# Sales objects
```

Inline or trailing comments are not part of the current language.

## 5. Full example

```text
# Sales objects
entity Account : Name, Industry, Phone, Website, Type
entity Contact : LastName, FirstName, Email, Phone, Title
entity Opportunity : Name, StageName, Amount, CloseDate

Contact.AccountId => Account
Opportunity.AccountId => Account
Opportunity.OwnerId -> User

# Activities can have polymorphic parents
Task.WhoId ~> Contact
Task.WhoId ~> Lead
Task.WhatId ~> Account
Task.WhatId ~> Opportunity
```

The example demonstrates explicit entities, an implicit `User` target, ordinary relationships and multi-target polymorphic fields.

## 6. Parse errors

The parser reports the source line when it cannot recognise a declaration. For example, this is not valid DSL:

```text
entity Account : Name
Account.OwnerId --> User
```

`-->` is not a supported relationship operator. The error identifies the offending line so the source can be corrected to:

```text
Account.OwnerId -> User
```

### Live editor validation

While typing, incomplete statements such as `use` or `use cus` can temporarily be invalid. Their current validation message appears beside the DSL editor; the last valid canvas remains visible. Finishing `use Customer` clears the message. These transient authoring errors do not create persistent diagnostic events or an unread-error badge. Explicit operation/API failures still use Error Log, and old persisted events are retained. The toolbar badge represents recorded history, not the current compiler status.

## 7. Diagram Studio behaviour around the DSL

Some behaviours belong to Diagram Studio rather than to the language grammar itself:

- Import from Org can populate type, required and roll-up metadata from Salesforce.
- Required fields may be ordered ahead of other fields when generated from org metadata.
- Relationship fields can remain visible as ordinary fields when their target object is not currently represented on the canvas.
- Drag-and-drop and schema import can generate relationship lines when both ends are available to the modelling workflow.
- Multiple relationships between the same objects are visually separated by the renderer.
- Self-relationships are rendered as loops.
- Object header styling is presentation logic, not DSL semantics. The DSL itself does not classify every Salesforce object suffix into a colour category.
- Saved canvas coordinates are presentation state. They are not part of the DSL language.

These behaviours can evolve without changing the core language contract.

## 8. Generating DSL instead of writing it

Diagram Studio provides several ways to generate or assist DSL:

- **DSL editor IntelliSense** suggests keywords, object names, fields, relationship operators and targets, exported modules, import filenames, `from`, `extends`, all component types, readable component/access names and `label` strings. See the V5 completion reference below.
- **Import from Org** describes Salesforce objects and generates corresponding DSL.
- **Palette drag-and-drop** adds objects through the visual modelling experience.
- **Relationship suggestions** can identify missing connections between objects already represented in the model.
- **Compare with Org** can compare a saved model with current Salesforce schema and help reconcile field differences.

Generated DSL remains plain text and can be edited afterwards.

## 9. V5 modules and saved-file imports

Save this file as **customer.dsl** before importing it:

```text
export module Customer {
    entity Account : Name, Description
    entity Contact : Name, Email
    Contact.AccountId -> Account
}
```

An exported definition draws **nothing** until `use` activates it. Save a separate **sales.dsl**:

```text
import customer.dsl
use Customer
entity Opportunity : Name, Amount, CloseDate
Opportunity.AccountId -> Account
```

This renders Account, Contact and Opportunity. Top-level declarations always participate; same-named entities merge case-insensitively. Imports make exported symbols available without drawing imported top-level models. Only exported modules can be used, whether defined locally or imported. An alternative named import is `import Customer from customer.dsl`.

Use plain filenames without `./`, directory paths or quotes. Saved names are unique across the org ignoring case and an optional `.dsl` suffix. Simple names such as `customer.dsl` are recommended. Existing saved imports retain their record-ID binding if the source file is renamed. New imports must use its new filename. Imports read the latest saved source; **Refresh imports** reloads it. They are not version-pinned copies.

```text
import Customer from customer.dsl
export module Sales extends Customer {
    entity Opportunity : Name, Amount
    Opportunity.AccountId -> Account
}
use Sales
entity Account : Industry
```

`extends` composes the base before the child; it does not create Salesforce object inheritance. Definitions remain inactive until used. Repeated use of the same module is deduplicated. Conflicting field types, relationship definitions and component display labels in activated modules fail rather than silently overriding one another. Private `module` declarations are not eligible for `use` or inheritance.

Circular imports, circular use/inheritance, missing/inaccessible files, unexported names and ambiguous symbols produce errors. Composition is bounded to 32 files including the root, 16 import levels and 1,048,576 source characters. Canvas schema deletion/field reconciliation is guarded for modular files: edit the module definition in the DSL. Layout and ordinary flat-model editing remain available. See [DSL-MODULES.md](DSL-MODULES.md).

## 10. Named component and access cards

```text
component ApexClass CustomerService
component Flow Save_Customer
component PermissionSet LoggerAdmin label "Nebula Logger: Admin"
component PermissionSetLicense LoggerLicence label "Example CRM Licence"
component UserLicense SalesforceLicence label "Salesforce"
component PackageLicense ExamplePackage label "Example Package"
```

Each component has a type, a stable identifier and an optional display label. It is a card, **not an sObject**: it receives no synthetic Id or schema fields, and is excluded from schema heatmap/sharing/relationship analysis. The same identifier can exist under different component types without collision. Labels do not alter identity.

`label` takes a JSON string. Empty/whitespace labels use the identifier while the label snippet is being filled. Escape embedded quotes and backslashes with JSON rules:

```text
component PermissionSet CoreAdmin label "Admin \"Core\" {Team}"
```

Braces and brackets inside labels are display text. These declarations work inside exported modules and draw only when those modules are used. They persist in saved DSL, imported modules, the viewer and canvas/draw.io exports. Mermaid exports the ER model and lists card names in comments; access cards do not become ER tables. Generated models allow at most 300 combined component/access cards.

App generation resolves named permission sets and licences using explicit metadata relationships. It does not list every licence in the org, infer assignments or use generic PermissionSet/UserLicense schema tables as a substitute for names. See [APP-ACCESS-CARDS.md](APP-ACCESS-CARDS.md) for coverage.

## 11. IntelliSense and stable editing

| Context | Suggestions and behaviour |
| --- | --- |
| Partial keyword | `entity`, `export module`, `module`, `use`, `import`, `component` |
| `export m` / `module Sales ex` | `module` / `extends` |
| `use` or `extends` argument | Exported modules visible in the current file or direct imports |
| `import` / `import Customer from` | Accessible saved filenames already listed by Studio |
| `import Customer f` | `from` |
| Indented entity/relationship | Existing object, field, operator and target assistance |
| `component` type | ApexClass, Flow, PermissionSet, PermissionSetLicense, UserLicense, PackageLicense |
| ApexClass / Flow name | Lazy org metadata lookup plus names declared in source |
| Access card name | Current/imported DSL declarations and the selected app’s resolved access cards |
| Component identifier followed by `l` | `label ""`, with the caret between quotes |
| Partial quoted label | Saved matching display labels, inserted with JSON escaping |

Use Up/Down to select and Enter/Tab to accept; Escape dismisses the list. Access-name completion does not query an unrelated org-wide list. Incomplete text is tolerated by the completion index; invalid active DSL still needs correction before a new model renders. Suggestions assist authoring, not proof that a manually named metadata component exists or that its access is required. Missing metadata cannot be invented by completion.

## 12. Compact grammar

```text
program       ::= statement*
statement     ::= blank | comment | entity | relationship | component
                | import | use | module
comment       ::= "#" text
entity        ::= "entity" identifier (":" field-list)?
field-list    ::= field ("," field)*
field         ::= identifier field-metadata?
field-metadata ::= "[" metadata-text "]"
relationship  ::= identifier "." identifier operator identifier
operator      ::= "->" | "=>" | "~>"
component     ::= "component" component-type identifier ("label" json-string)?
component-type ::= "ApexClass" | "Flow" | "PermissionSet"
                 | "PermissionSetLicense" | "UserLicense" | "PackageLicense"
import        ::= "import" filename | "import" identifier "from" filename
use           ::= "use" identifier
module        ::= ("export")? "module" identifier ("extends" identifier)?
                  "{" module-statement* "}"
module-statement ::= blank | comment | entity | relationship | component | use
```

Imports belong at file level; modules cannot nest. Keywords and module/entity matching are case-insensitive. Component identifiers use letters/underscores followed by letters, digits or underscores. Use one declaration per line inside blocks; braces may share a line with a declaration. Field metadata remains compact display text, not a general expression language. There are no stored procedures or executable SQL statements.

For compiler design and semantic-model architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).
