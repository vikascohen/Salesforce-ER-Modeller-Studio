# Salesforce ER Modeller Studio

**Salesforce Data Architecture Intelligence & ER Modelling**  
**Open source. Free to use. Built for Salesforce architects, developers and platform teams.**

Salesforce ER Modeller Studio is a Salesforce-native workspace for understanding the structure, relationships and dependencies in a Salesforce org before making change. It combines visual ER modelling, a Data Dictionary, Object Intelligence, Architecture Intelligence and, in Version 3, Field Usage Intelligence.

> **Understand the architecture before you change the architecture.**

> **Security boundary:** Analysis is performed within the customer's Salesforce environment. Salesforce metadata and source code used by the Studio are not exported to an external SaaS platform for processing.

## Why this project exists

This project started from a fairly ordinary frustration: **understanding a real Salesforce data model should not be this difficult.**

Salesforce Schema Builder is useful for quickly viewing objects and relationships, but a large or mature Salesforce org often raises questions that go beyond a visual schema.

Architecture work may involve understanding why an object is heavily connected, what sits upstream or downstream from it, how two objects are connected through the model, whether a custom object is behaving like a junction, what fields and relationships make up an object, where a field is referenced before it is changed, and which parts of a large model deserve closer investigation.

The evidence needed to answer those questions is often spread across Salesforce Setup, Schema Builder, Object Manager, source code, Flows, spreadsheets, documentation and existing knowledge of the org.

**ER Modeller Studio brings more of that architectural evidence into one workspace so it can be explored together.**

The project began as an ER modeller. The next logical question was *what can the model tell us?* That led to Architecture Intelligence. Then came another common architecture question: *if this field changes, what might depend on it?* That led to Field Usage Intelligence and Field Change Impact.

The philosophy is deliberately simple: **show useful evidence, make dependencies easier to see, and avoid pretending the tool knows something it cannot prove.**

## The daily problem for Salesforce architects

A mature Salesforce org rarely has one perfect source of architectural truth. Architects and platform teams routinely have to reconstruct the picture themselves.

A seemingly simple request such as *“Can we change this field?”* can turn into a much larger investigation:

**The diagram is only the beginning.** Schema Builder can show relationships, but architecture work can also require context such as topology, relationship paths, highly connected objects, junction patterns, represented external references and change-impact evidence.

**The data dictionary becomes another artefact to maintain.** Teams often end up exporting metadata into spreadsheets or maintaining documentation separately from the org, and those artefacts can become stale.

**Dependencies are distributed.** A field may appear straightforward in Object Manager while also being referenced by Apex, a Trigger, an active Flow, a formula, a Validation Rule, LWC or Aura.

**Large orgs are difficult to reason about visually.** Hundreds of objects and relationships can turn a diagram into noise. Architects need ways to narrow the question rather than simply draw more boxes and lines.

**Architecture knowledge becomes tribal knowledge.** People who have worked in an org for years often know why something exists. New architects and developers may have to rediscover that context.

**Change assessment takes time.** Before changing an object or field, somebody still has to gather evidence from several places and decide what deserves deeper investigation.

ER Modeller Studio does not try to replace architectural judgement. Its job is to make that judgement easier by putting more relevant evidence in front of the architect.

## From diagram to architecture intelligence

The product has evolved around three layers:

**Model → Understand → Investigate change**

`Version 1` provides the modelling foundation.  
`Version 2` asks architectural questions about that model.  
`Version 3` extends the investigation into field dependencies and change impact.

The intention is not to produce a mysterious architecture score or declare that something is automatically *good* or *bad*. A highly connected object may be completely appropriate. A cycle may be intentional. A field with no detected references may still matter elsewhere.

The Studio therefore treats architecture intelligence as **evidence for a human decision**, not a replacement for one.

## Current release

**Version 3** is the current stable release. It includes the modelling foundation from Version 1, the Architecture Intelligence introduced in Version 2, and the Field Usage and change-impact capabilities introduced in Version 3.

Version **3.0.0.2** is released as a Salesforce second-generation unlocked package (2GP). The released package was validated by Salesforce with **91% Apex code coverage**.

## Install

Choose the version you want below. You do **not** need to install an earlier version before installing a later version.

| Version | Release | Package | Production / Developer Edition | Sandbox | Branch |
| --- | --- | --- | --- | --- | --- |
| **Version 3** | **Current stable** | 2GP unlocked | [Install V3](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY) | [Install V3 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000imKHAAY) | [`version-3-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-3-stable) |
| Version 2 | Historical stable | Unmanaged | [Install V2](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000hugT) | [Install V2 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000hugT) | [`version-2-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-2-stable) |
| Version 1 | Historical stable | Unmanaged | [Install V1](https://login.salesforce.com/packaging/installPackage.apexp?p0=04taj000000gRTd) | [Install V1 in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04taj000000gRTd) | [`version-1-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-1-stable) |

### Version 3 package details

**Subscriber Package Version ID:** `04taj000000imKHAAY`  
**Version:** `3.0.0.2`  
**Release status:** Released  
**Apex code coverage:** 91%

### After installing Version 3

1. Assign the **Diagram Studio User** permission set to ER Modeller users.
2. Configure the **Salesforce Tooling API** Named Credential, External Credential and authenticated principal. See the installation/configuration documentation or **Help → Configuration** inside the Studio.
3. Open the **ER Modeller** tab.
4. Run **Diagnostics** to verify the environment before running Field Usage scans.

> **Existing V1/V2 installations:** Versions 1 and 2 were distributed as unmanaged packages, while Version 3 is a new 2GP package lineage. Treat migration from an existing unmanaged installation separately rather than assuming V3 will overwrite the old package as an in-place upgrade.

## Version history

### Version 1: ER modelling foundation

Version 1 established the core Salesforce ER modelling workspace:

- Visual Salesforce ER modelling canvas
- Salesforce schema import
- Lookup, Master-Detail and polymorphic relationship modelling
- Drag-and-drop modelling
- Bidirectional visual ↔ DSL modelling
- DSL import/export and editor assistance
- Data Dictionary
- Basic sharing-model view
- Record-count heatmap
- PNG, Mermaid and Draw.io export
- Multi-file diagram workspace
- Themes and per-user preferences

### Version 2: Architecture Intelligence

Version 2 includes Version 1 and adds architecture-level analysis of the represented Salesforce data model:

- Architecture Overview and structural metrics
- Object hotspots and connectivity analysis
- Connected components and isolated objects
- Relationship Path Finder
- Bounded cycle analysis
- Junction-object intelligence
- Object Map & Impact
- Blast-radius evidence
- Object Usage & Change Readiness
- Relationship Insights
- Expanded Data Dictionary and architecture-oriented metadata exploration

Architecture Intelligence provides evidence for architectural review. Structural signals are prompts for investigation, not automatic declarations of defects.

### Version 3: Field Usage & Change Impact

Version 3 includes Versions 1 and 2 and adds dependency analysis designed to answer a practical question before a Salesforce field is changed: **what could this change affect?**

- Apex Class and Apex Trigger usage evidence through the Salesforce Tooling API
- Active Flow dependency analysis
- Formula-field dependency analysis
- LWC and Aura field-reference analysis
- Validation Rule field-reference analysis
- Field Usage Map with evidence drill-down
- Field Change Impact analysis
- Improved Data Dictionary and Object Intelligence
- Scheduled and manual Field Usage scans
- Running-task monitoring and scan status
- Durable asynchronous work units for larger environments
- Sparse evidence persistence
- Last-known-good snapshot protection: an incomplete or failed scan does not replace the current successful snapshot
- Diagnostics and environment checks
- System information
- In-product configuration guidance and user help
- **ER Modeller** Lightning tab
- **Diagram Studio User** permission set

> **Important:** An empty Field Usage result is not a guarantee that a field is safe to delete. The Studio reports the evidence it can discover within its documented analysis scope.

## What the Studio is — and isn't

ER Modeller Studio is intended to help with **data architecture discovery, visualisation and change investigation**. It is not a general-purpose static-code analyser, runtime observability platform or automated architecture judge.

It deliberately stays close to the Salesforce data model and the dependencies that help an architect understand that model. Where the available evidence has limits, the UI and documentation should make those limits clear.

That boundary matters. Useful architecture tooling should reduce uncertainty without creating false certainty.

## Why open source?

Architecture understanding should not necessarily require another expensive platform before a team can begin investigating its own Salesforce org.

The project is therefore open source and free to use. The aim is to make genuinely useful Salesforce architecture capabilities available to teams that may not need, or may not be able to justify, a separate commercial architecture product.

Free does not mean the engineering standard should be lower. The project is built with enterprise use in mind: permission-based access, Salesforce-native execution, diagnostics, asynchronous processing, test coverage, documented evidence boundaries and a release process.

At the same time, the project does not claim to replace every commercial product. Different tools solve different problems. ER Modeller Studio focuses on doing its particular job well: **helping people understand Salesforce data architecture before they change it.**

See [Business Use Cases](docs/BUSINESS-USE-CASES.md) for practical examples.

## Documentation

The `main` branch represents the current Version 3 release.

| Document | Purpose |
| --- | --- |
| [Installation & Configuration](docs/INSTALLATION.md) | Installation, permissions, Tooling API configuration and verification |
| [Architecture](docs/ARCHITECTURE.md) | Authoritative architecture for ER modelling, Architecture Intelligence and Field Usage Intelligence |
| [DSL Reference](docs/DSL.md) | DSL syntax, examples and language reference |
| [Business Use Cases](docs/BUSINESS-USE-CASES.md) | Practical Salesforce architecture use cases |
| [Security](docs/SECURITY.md) | Security model and Tooling API trust boundary |
| [Version 3 Release Notes](docs/RELEASE-NOTES-V3.md) | Version 3 release scope and capabilities |

Operational guidance and troubleshooting are also available through **Help** inside the Studio.

For documentation corresponding specifically to an older release, use that release's stable branch rather than `main`.

## Stable branches

- [`main`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio) — current release, Version 3
- [`version-3-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-3-stable) — preserved Version 3 stable release line
- [`version-2-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-2-stable) — preserved Version 2 stable release
- [`version-1-stable`](https://github.com/vikascohen/Salesforce-ER-Modeller-Studio/tree/version-1-stable) — preserved Version 1 stable release

## Open Source & Licence

Salesforce ER Modeller Studio is released under the **MIT Licence**. See [LICENSE](LICENSE).

Developed and maintained by **Crius Consulting Architects**.  
**Lead Architect & Author: Vikas Cohen**
