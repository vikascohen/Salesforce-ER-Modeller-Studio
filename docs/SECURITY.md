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
- **Every user of this tool sees the full org schema — every object and
  every field the tool can describe — regardless of that user's own
  object or field-level permissions elsewhere in the org.** This is a
  deliberate design decision, not an oversight, and it's covered in
  detail below because it's the one thing in this document that a
  reviewer should actually stop and think about, rather than skim past.

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

Two feature categories are worth calling out explicitly since they're
the ones that come closest to touching real data, and both stop short of
it:

- **Heatmap and % Used** run real SOQL against your actual objects, but
  only ever as `COUNT()` — a single aggregate number per object or
  field, never a `SELECT <field> FROM <object>` that would return any
  actual value. Both features fail closed per-object/per-field (wrapped
  in `try/catch`) rather than surfacing a partial or malformed read on
  error.
- **PNG exports** are stored as Salesforce Files (`ContentVersion`)
  inside the *same* org the diagram was built in. They never leave
  Salesforce, and they're pictures of schema structure, not data.

## Where this app runs, and where it doesn't

This is a native Lightning Web Component + Apex application. It runs
entirely inside the installing org. There is no external server, no
middleware, no third-party API this app calls out to, and no telemetry
sent anywhere. Reading the Apex classes confirms this directly: there is
no `Http`/`HttpRequest` usage anywhere in this codebase, which is the
only mechanism Apex has for making an external call at all.

## The schema-visibility design decision

**Every user granted access to this tool sees every object and every
field it can describe, regardless of that specific user's own
object-level and field-level security (FLS) elsewhere in the org.**

This is deliberate. The tool's entire purpose is to show the shape of
the org's data model — what an ER diagram or a data dictionary is *for*.
Gating that view by each individual viewer's own FLS would mean two
people looking at the same diagram could see two different, incomplete
pictures of the same objects, which defeats the purpose of a shared
modeling and documentation tool. So object and field *metadata*
(existence, name, label, type, relationships, descriptions) is treated
as something anyone with access to the tool can see in full, independent
of what that person can otherwise do with the underlying object in the
rest of the org.

**What this means concretely, stated plainly rather than left implicit:**
a user with the tool's permission set but zero access to, say, a
sensitive custom object elsewhere in the org will still see that
object's name, its field names, its field descriptions, and its
relationships to other objects, through this tool. That is a real form
of metadata exposure, distinct from data exposure. An object or field
*name* can itself convey something — this document isn't going to
pretend otherwise. What it does not expose is any record, any field
value, or anything about who has access to what data in practice.

**The actual gate is the permission set, not per-field security.** A
user has no access to any of this — no schema, no diagrams, nothing —
unless an admin has explicitly assigned them the `Diagram_Studio_User`
permission set. Whoever controls that assignment controls who can see
the org's schema through this tool. That's the control point to manage
deliberately, not field-level security within the tool itself, which
this app does not attempt to enforce.

If this tradeoff isn't the right one for a given org — for example, if
certain objects' *existence* or *field names* are themselves considered
sensitive and shouldn't be visible to every permission-set holder — the
right lever is restricting who gets the permission set, or raising this
as a scoping change before rollout, not assuming per-user filtering is
happening somewhere in the tool. It isn't.

## Saved diagrams (`Diagram_File__c`)

This is a separate concern from schema visibility above — it's about
who can open, edit, or delete a specific *saved diagram record*, not
about what schema data appears inside one.

As of this document, `Diagram_File__c`'s org-wide default is **Public
Read Only**: any user with the permission set can open and view any
saved diagram, but only the record's owner can edit, rename, or delete
it. `DiagramFileController` is declared `with sharing`, so this is
enforced by the platform's own sharing engine on every query and every
DML statement Apex performs, not just in the standard UI — an attempt
by a non-owner to update or delete another user's diagram is rejected
by Salesforce itself before this app's own code runs.

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
- **No hardcoded credentials, no stored secrets, no external callouts**
  anywhere in the codebase.

## What this document deliberately does not claim

- It does not claim per-user field-level filtering of schema metadata —
  it explicitly does the opposite, by design, as described above.
- It does not claim this app has been through Salesforce's AppExchange
  Security Review or any formal third-party security audit. Nothing
  here is a substitute for that process if this is ever distributed
  beyond a single org.
- It does not make claims about org-wide settings this app doesn't
  control — session security, IP restrictions, MFA, and similar are
  the installing org's own configuration, unaffected by this app either
  way.
