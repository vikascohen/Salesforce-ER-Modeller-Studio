# ER DSL Reference

**Author: Vikas Cohen**

The ER DSL is a small, line-based format for describing Salesforce objects, fields and relationships. You normally do **not** need to write it by hand: Diagram Studio can generate DSL from Salesforce metadata, drag-and-drop modelling and editor assistance. See [Generating DSL instead of writing it](#generating-dsl-instead-of-writing-it).

Every source line is an entity declaration, relationship, comment or blank line. Unrecognised input produces a parse error with the source line number.

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
| `->` | Lookup | Thin blue line, open arrowhead, `N` to `1` |
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

- **DSL editor autocomplete** suggests keywords, object names, fields, relationship operators and targets.
- **Import from Org** describes Salesforce objects and generates corresponding DSL.
- **Palette drag-and-drop** adds objects through the visual modelling experience.
- **Relationship suggestions** can identify missing connections between objects already represented in the model.
- **Compare with Org** can compare a saved model with current Salesforce schema and help reconcile field differences.

Generated DSL remains plain text and can be edited afterwards.

## 9. Compact grammar

The current language is intentionally flat and line-oriented:

```text
program       ::= line*
line          ::= blank | comment | entity | relationship
comment       ::= "#" text
entity        ::= "entity" identifier (":" field-list)?
field-list    ::= field ("," field)*
field         ::= identifier field-metadata?
field-metadata ::= "[" metadata-text "]"
relationship  ::= identifier "." identifier operator identifier
operator      ::= "->" | "=>" | "~>"
```

`metadata-text` is intentionally documented at a higher level rather than as a fully general expression grammar. The DSL is designed to remain small and readable. If future language features introduce nested expressions, blocks or more complex type syntax, the compiler architecture allows the grammar and semantic layer to evolve without making canvas geometry the source of truth.

For compiler design and semantic-model architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).
