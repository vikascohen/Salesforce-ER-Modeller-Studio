# ER DSL Reference

*Author: Vikas Cohen*

The ER modeller is driven by a small line-based text format. Every line is
either an **entity declaration**, a **relationship**, a **comment**, or
blank — nothing else is understood, and an unrecognised line will raise a
parse error naming the line number.

## Entity declaration

```
entity <Name> : <field1>, <field2>, <field3>
```

- `<Name>` is the object's API name (e.g. `Account`, `My_Custom__c`).
- The `: <fields>` part is optional — `entity Account` on its own declares
  an entity with no plain fields yet.
- Field names are a comma-separated list; whitespace around commas is
  ignored.
- Every entity automatically gets an `Id` field at the top of its box —
  don't declare it yourself.
- An entity whose API name ends in `__c` is drawn with a purple header
  (custom object); everything else gets the standard blue header
  (standard object). This is purely visual, not something you configure.

```
entity Account : Name, Industry, Phone, Website, Type
entity Order__c : Order_Date__c, Status__c
```

## Relationships

```
<ChildEntity>.<ChildField> <arrow> <ParentEntity>
```

Three arrows, matching the three ways a Salesforce lookup field can
relate two objects:

| Arrow | Meaning | Rendered as |
|---|---|---|
| `=>` | Master-Detail | Thick purple line, filled diamond, cardinality `N` → `1` |
| `->` | Lookup | Thin blue line, open arrowhead, cardinality `N` → `1` |
| `~>` | Polymorphic lookup | Dashed red line, open diamond, cardinality `N` → `?` |

```
Contact.AccountId => Account
Contact.OwnerId   -> User
Task.WhoId        ~> Contact
```

A few things worth knowing:

- The child field is added to the child entity's box automatically and
  labelled with its target and relationship type — you don't need to also
  list it in the entity's field list.
- If the parent entity hasn't been declared with its own `entity` line,
  it's created implicitly (with no fields other than `Id`) so the
  connector still has something to point at.
- Order doesn't matter — you can write relationship lines before or after
  the entities they reference.
- Entity names are matched case-insensitively, so `Account` and `account`
  referenced on different lines resolve to the same box rather than
  creating a duplicate — whichever casing you used first is what's shown.
- **Self-relationships** work — `Account.ParentId -> Account` draws as a
  small loop on the box instead of collapsing to nothing. If an entity has
  more than one self-relationship, each gets a progressively larger loop
  so they stay distinguishable.
- **A single field can point at more than one target** — declare the same
  child field with two separate relationship lines to two different
  parents (this is the correct way to model a field that's genuinely
  polymorphic across more than one object) and its row shows every target,
  e.g. `WhoId  → Contact / Lead (Polymorphic Lookup)`.
- If the same relationship line is declared twice, the duplicate is
  ignored rather than drawing an identical connector on top of itself. If
  two *different* relationships connect the same pair of entities (e.g.
  two separate lookups from Opportunity to Account), their lines are
  automatically fanned out so they don't overlap.

## Comments

```
# anything after a hash on its own line is ignored
```

Comments must be on their own line starting with `#` — there's no
inline/trailing comment support.

## Full example

```
# Sales objects
entity Account : Name, Industry, Phone, Website, Type
entity Contact : LastName, FirstName, Email, Phone, Title
entity Opportunity : Name, StageName, Amount, CloseDate

Contact.AccountId     => Account
Opportunity.AccountId => Account
Opportunity.OwnerId   -> User

# Activities can point at more than one kind of parent
Task.WhoId ~> Contact
Task.WhatId ~> Opportunity
```

This renders five entities (`Account`, `Contact`, `Opportunity`, `Task`,
plus an implicit `User` box since it's referenced but never declared) with
Master-Detail, Lookup, and Polymorphic connectors between them.

## Generating the DSL instead of writing it

You don't have to write this by hand:

- **DSL editor autocomplete** — the editor panel suggests the next token as
  you type: the `entity` keyword, object names from your org, field names
  for whichever entity you just named, relationship fields on an entity
  once you type its name and a dot (picking one auto-appends the correct
  arrow and target for you), the arrow itself, and finally the target
  entity. Suggestions appear in a panel below the editor — arrow up/down
  then Enter or Tab to accept, Esc to dismiss.
- **Import panel** — give it a comma-separated list of object API names
  and it describes them from the org's real schema (fields + relationship
  types) and writes out the equivalent DSL for you.
- **Palette drag-and-drop** — dragging an object onto the canvas does the
  same thing for one object at a time, and automatically adds relationship
  lines to any entity already on the canvas that it's connected to.
- **Smart relationship linter** — if you add entities without wiring
  relationships between them (by typing, or because you added them one at
  a time), the editor scans their real schema and suggests any missing
  connections between entities already on the canvas — click "+ Add" on a
  suggestion (or "Add all") to insert the line and redraw.
- **Schema drift check** — for diagrams that have been sitting around a
  while, click **Check Drift** in the toolbar to re-describe every entity
  that maps to a real org object and diff it against the diagram: new
  fields the org has that the diagram doesn't, and fields the diagram
  still lists that the org no longer has. Each is individually addable or
  removable, right from the results.

All of these only ever produce DSL using the constructs described
above, so anything generated this way is still just plain text you can
hand-edit afterwards.
