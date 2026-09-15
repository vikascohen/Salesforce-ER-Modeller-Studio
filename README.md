# Salesforce ER Modeller

A native Lightning Web Component app for building Entity-Relationship diagrams
of your Salesforce data model.
Diagrams are stored as records (`Diagram_File__c`) inside your org, so they
live alongside the metadata they describe and can be opened, edited, or
pinned to a page by anyone with access.

## One-click deploy

<a href="https://githubsfdeploy.herokuapp.com/app/githubdeploy/vikascohen/SalesforceERModeller?ref=main">
  <img alt="Deploy to Salesforce" 
  src="https://raw.githubusercontent.com/afawcett/githubsfdeploy/master/src/main/webapp/resources/img/deploy.png">
</a>
&nbsp;&nbsp;
<a href="https://githubsfdeploy-sandbox.herokuapp.com/app/githubdeploy/vikascohen/SalesforceERModeller?ref=main">
  <img alt="Deploy to Sandbox" src="https://raw.githubusercontent.com/afawcett/githubsfdeploy/master/src/main/webapp/resources/img/deploy.png">
</a>

Left button logs you into Production/Developer Edition, right button logs
you into a Sandbox, and either way you land on a page listing every
component in this repo with checkboxes — review what's about to deploy,
then click Deploy.

This uses [githubsfdeploy](https://github.com/afawcett/githubsfdeploy), a
well-known community tool (not an official Salesforce or Anthropic
product) that reads a GitHub repo over OAuth and pushes it straight into
an org via the Metadata API — no local `sf` CLI or clone required. It
understands this repo's Salesforce DX source format directly. Since it's
a third-party OAuth flow, only use it with orgs and repos you trust, and
if you'd rather not grant a third party OAuth access at all, use the
`sf project deploy start` route in the section below instead — same
result, nothing leaves your machine.

## What it does

- **Live DSL editor** — a resizable, collapsible code panel next to the file
  explorer where you type entity/relationship lines directly and watch the
  canvas render as you type. Includes context-aware autocomplete (entity
  names, field names, relationship arrows, target entities) that suggests
  from your org's real schema — see [docs/DSL.md](docs/DSL.md) for the full
  syntax.
- **Import from your org** — pull in real objects (standard or custom) by
  API name and auto-generate the DSL from their actual fields and
  relationships, including Master-Detail, Lookup, and Polymorphic Lookup.
- **Object palette** — a searchable list of every object you can access;
  drag one onto the canvas to add it (and auto-wire any relationships it
  has to entities already on the canvas).
- **Freeform canvas** — drag boxes to reposition them, resize the height
  or width of a box, collapse long field lists, zoom in/out, or hit
  **Auto Layout** to snap everything back to an automatic grid. Click any
  entity's header to enter **Focus mode** — everything except that entity
  and its direct relationships fades out, so a dense diagram instantly
  becomes readable; click it again (or click empty canvas) to release.
- **Sharing view** — toggle **Sharing View** from the **View** menu to
  badge each object with its org-wide default sharing model, sourced from
  `EntityDefinition` (the same data Setup shows under Object Manager >
  Sharing Settings, not otherwise available via the describe API). Shows
  both **internal** (regular org users — solid badge) and **external**
  (Experience Cloud / community / guest users — hollow badge, when the org
  has one configured) side by side. A Master-Detail child's internal badge
  naturally comes back as *Controlled by Parent*, which is exactly what
  shows its sharing is inherited rather than independently configured —
  reasoning that's normally done in your head across several Setup pages,
  now visible directly on the diagram. Scope is deliberately narrow: OWD
  only, not sharing rules or role hierarchy.
- **Heatmap** — toggle **Heatmap** from the **View** menu to color each
  box by relative record volume among whatever's on the canvas right now
  (cool blue → yellow → hot red), with the actual count badged at the top
  (e.g. `1.2K`, `45`). A plain `COUNT()` per object, nothing about the
  records themselves is read. Scoped to the canvas, never the whole org at
  once, and only fetched when you turn it on.
- **Data Dictionary** — a full-screen tab (toggle **Data Dictionary**
  from the **View** menu separate from the canvas, for browsing every accessible
  object in the org: search or scroll the list on the left, and the right
  shows a full field-level table — label, description, data type,
  required, custom, primary key, foreign key (and which object it points
  to), and when Setup shows it. **Data type** shows Setup's actual field-type
  labels (Text, Number, Formula (Number), Master-Detail Relationship,
  Lookup Relationship, Text Area (Long)...), not the raw Apex describe enum
  name. **Description** and **last-modified date**
  come from `FieldDefinition`, metadata the regular describe API doesn't
  expose at all. Field **% Used** (how many existing records have a
  non-blank value) is a genuine data scan, so it's opt-in per object via
  a **Calculate Usage %** button rather than automatic — deliberately, to
  keep browsing the dictionary instant. Export the current object to CSV
  or a real `.xlsx`, or **Export All** as one workbook with every object
  on its own tab (bulk export skips % Used, to stay fast and safely inside
  governor limits across potentially hundreds of objects). The dictionary
  always re-fetches live — nothing about it is cached beyond the object
  *name* list, which barely changes and is already loaded for the palette
  anyway. A **← Back to Diagram** button (or click the × close) returns you to the canvas
  exactly as you left it — the dictionary is an overlay, not a page change,
  so your zoom, position, and open tabs are untouched either way.
- **Themes** — a theme selector in the toolbar switches between four real
  VS Code themes: **Dark+** and **Light+** (VS Code's own defaults, blue
  accent), **Monokai**, and **Solarized Light**. Applies across the whole
  app, Data Dictionary included, instantly, no reload. Status colors
  (error red, success green) and the Master-Detail/Lookup/Polymorphic
  relationship colors on the canvas are deliberately left out of theming —
  they're semantic, not decorative, and the relationship colors
  specifically have to stay identical to what gets baked into PNG/Mermaid/
  draw.io exports, or the on-screen diagram and the exported file would
  disagree with each other.
- **Multi-file workspace** — a VS Code–style tab strip and sidebar file
  list; open several diagrams at once, rename, duplicate, or delete them.
- **Export** — render the current diagram to PNG at native size, A4
  landscape, or A3 landscape, with the relationship legend baked into the
  image. Exports are saved as a Salesforce File and downloaded from there
  (no client-side blob tricks, so it works under Lightning Web Security).
  The export modal can also give you the diagram as **Mermaid `erDiagram`
  syntax** (paste into a GitHub README, Confluence, or Notion page — it
  renders live there) or as a **draw.io / diagrams.net file** — the
  draw.io export is laid out using your diagram's *actual* canvas
  positions, not auto-arranged from scratch, so it opens up looking like
  what you built here.
- **Smart relationship linter** — after you drop a couple of related
  objects on the canvas, the DSL editor notices relationship fields
  (from the org's real schema) that point at another entity already on
  the canvas but aren't wired up as a DSL line yet, and suggests them —
  one click adds the line and redraws.
- **Compare with org schema** — re-describes every entity on the canvas
  that maps to a real org object and diffs it against the diagram: fields
  the org has that your diagram doesn't (added since you built it, or
  just never included), and fields your diagram lists that the org didn't
  return (renamed, deleted — or hidden from you by field-level security,
  so worth checking before removing). One click adds or removes each.
  Entities with no matching object in the org are skipped.
- **Read-only viewer** — a companion component for Record/App/Home pages
  that pins a saved diagram somewhere for people who just need to look at
  it, with its own PNG export button and legend.

Relationship handling has a few deliberate refinements worth knowing about:
entity names are matched case-insensitively so a typo like `account` vs
`Account` merges into one box instead of silently duplicating it; a field
that's genuinely polymorphic to more than one object (declared with two
separate relationship lines) shows every target on its row; a relationship
from an entity to itself (e.g. `Account.ParentId -> Account`) draws as a
loop instead of collapsing to nothing; and multiple relationships between
the same two entities fan out instead of drawing directly on top of each
other.

## Components

| Type | Name | Purpose |
|---|---|---|
| LWC | `diagramStudio` | The main editor — canvas, sidebar, DSL editor with intellisense, tabs, palette, import panel, export modal, zoom, Data Dictionary. Deployable to an App Page, Record Page, Home Page, or its own Tab. |
| LWC | `diagramViewer` | Read-only, drop it on any page and point it at a saved diagram's Id. |
| LWC | `erDiagramLogic` | Pure JS: parses the DSL, lays out boxes/connectors, builds the export legend, and generates Mermaid `erDiagram` / draw.io XML. No UI, no dependencies — imported by both components above. |
| LWC | `diagramExportUtils` | Pure JS: renders an SVG diagram to a PNG (canvas-based). Shared by both components. |
| Apex | `DiagramFileController` | CRUD for `Diagram_File__c` records, plus saving a PNG export as a Salesforce File. |
| Apex | `SchemaMetadataController` | Read-only schema introspection — object/field describe for the import panel/palette/autocomplete, internal + external sharing model for Sharing View, per-object record counts for the Heatmap, and the Data Dictionary's field descriptions, last-modified dates, and on-demand usage percentages. |
| Object | `Diagram_File__c` | Stores each diagram: `Name`, `Diagram_Type__c`, `Source_Code__c` (the DSL text). |
| Static Resource | `sheetjs` | [SheetJS](https://www.npmjs.com/package/xlsx) (Apache-2.0), bundled for real client-side `.xlsx` generation — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Only loaded on first use of an Excel export. |

## Architecture

```mermaid
graph TD
    subgraph UI["Lightning Pages"]
        DS["diagramStudio<br/>editor LWC"]
        DV["diagramViewer<br/>read-only LWC"]
    end

    subgraph Logic["Pure JS — no dependencies"]
        ERL["erDiagramLogic<br/>parse DSL · lay out boxes/connectors ·<br/>build legend · export Mermaid / draw.io"]
        EXP["diagramExportUtils<br/>SVG → PNG"]
    end

    subgraph ThirdParty["Bundled Static Resource"]
        XLSX["sheetjs<br/>client-side .xlsx generation<br/>lazy-loaded on first Excel export"]
    end

    subgraph Apex["Apex (with sharing)"]
        DFC["DiagramFileController"]
        SMC["SchemaMetadataController"]
    end

    subgraph Data["Salesforce Data"]
        OBJ["Diagram_File__c<br/>Name · Diagram_Type__c · Source_Code__c"]
        FILES["ContentVersion<br/>PNG exports"]
        SCHEMA["Org Schema<br/>describe API"]
        CATALOG["Metadata Catalog<br/>EntityDefinition · FieldDefinition"]
        RECORDS["Object Records<br/>COUNT() aggregates only —<br/>Heatmap counts, Dictionary usage %"]
    end

    DS -- "parse / render" --> ERL
    DS -- "export" --> EXP
    DS -- "Excel export" --> XLSX
    DS -- "CRUD, save PNG" --> DFC
    DS -- "describe objects,<br/>autocomplete, linter,<br/>schema compare, sharing,<br/>heatmap, data dictionary" --> SMC

    DV -- "render" --> ERL
    DV -- "export" --> EXP
    DV -- "get file, save PNG" --> DFC

    DFC --> OBJ
    DFC --> FILES
    SMC --> SCHEMA
    SMC --> CATALOG
    SMC --> RECORDS
```

`diagramStudio` and `diagramViewer` never talk to each other or duplicate logic between themselves — both are thin UI shells over the same two pure-JS modules, so a DSL parsing or rendering fix in `erDiagramLogic` applies identically whether you're editing or just viewing a diagram. `SchemaMetadataController` is the only Apex class that ever reads live *record data* (`RECORDS`, for the Data Dictionary's opt-in usage-percentage feature) — everything else it does is metadata-only.

## Deploying to an org

This is a standard Salesforce DX project.

```bash
sf project deploy start --source-dir force-app
```

Then assign the permission set so users can access the object, fields, and
Apex classes:

```bash
sf org assign permset --name Diagram_Studio_User
```

## Setting it up in the org

1. In Setup, create a **Lightning App** (or use an existing one) and add a
   new tab, or drop the `diagramStudio` component straight onto an App
   Page / Home Page via Lightning App Builder.
2. Assign the `Diagram Studio User` permission set to anyone who needs to
   create or edit diagrams.
3. Open the page — it starts with a blank "Untitled ER Diagram" tab and a
   sample entity to get you oriented.

To pin a specific saved diagram somewhere read-only (e.g. on an app's
landing page), drop `diagramViewer` on a page instead and set its
**Diagram Id** property in App Builder to the record's Id (use the "Copy
Id" button in the studio's sidebar to grab it).

## Quick start

1. Type directly into the **DSL editor** panel next to the file explorer
   (click the `</>` toolbar button if it's collapsed, or drag its right
   edge to resize it):

   ```
   entity Account : Name, Industry, Phone
   entity Contact : LastName, FirstName, Email

   Contact.AccountId => Account
   ```

   The canvas updates as you type, and autocomplete suggestions appear in
   a panel below the editor as you go — arrow up/down then Enter or Tab to
   accept, Esc to dismiss. See [docs/DSL.md](docs/DSL.md) for the full
   syntax (relationship arrows, comments, self-relationships, etc).

2. Or click **File > Import from Org**, type in object API names (e.g. `Account, Contact,
   Opportunity`), and the tool describes them from your org's actual
   schema and generates the DSL for you — including any relationships
   between the objects you listed.

3. Or open the **object palette** on the side, search for an object, and
   drag it onto the canvas. Dropping an object that already has a
   relationship to something on the canvas wires it up automatically.

4. Drag boxes around to lay them out the way you want; drag the bottom or
   right edge of a box to resize it; use the zoom controls (top-left of
   the canvas) to zoom in/out, or **Diagram > Auto Layout** to reset
   everything to an automatic grid.

5.  **File > Save**, writes the diagram back to its
   `Diagram_File__c` record. Use **File > Export** to render a PNG — the
   relationship legend is baked into the exported image — or to copy/download
   the diagram as **Mermaid** or **draw.io** for pasting into a README, wiki
   page, or editing further in draw.io.

## Notes

- Only objects you have access to (readable/queryable) show up in the
  palette or can be imported — the Apex layer respects field- and
  object-level security throughout.
- Diagrams are plain text under the hood (`Source_Code__c`), so they diff
  and version cleanly if you ever want to track them outside Salesforce
  too.
- Sharing View and the Data Dictionary's description/last-modified
  columns read from `EntityDefinition`/`FieldDefinition` — Salesforce's
  metadata catalog, not the regular describe API. Visibility into these
  generally requires **View Setup and Configuration** (most System
  Administrator-type profiles have it by default). If a user lacks it,
  both features degrade gracefully — sharing badges just won't show, and
  those two columns show blank — rather than erroring.

## Author

Vikas Cohen- Passionate transhumanist and a programmer when get extremely bored.

## License

MIT — see [LICENSE](LICENSE). Free to use, modify, and distribute; just keep the copyright notice. Bundles one third-party library (SheetJS, Apache-2.0) — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the project is laid out, what to check before opening a PR, and known gaps (there's currently no Apex test coverage — a good first contribution if you're looking for one).
