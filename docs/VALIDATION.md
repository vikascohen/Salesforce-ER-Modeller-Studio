# V5 validation

**Crius Consulting · Updated: 8 November 2026**

This page records current results. Detailed earlier runs remain in Git history; installer and source validation are distinct.

## Installer 5.0.0.1

| Check | Result |
| --- | --- |
| Package name | Crius Consulting - Salesforce ER Modeller Studio V5 |
| Type / status | 2GP unlocked, beta, not promoted |
| Subscriber version | `04taj000000pMsvAAE` |
| Build request | `08caj000000JMEXAA4` |
| Packaged Apex coverage | 91%, coverage gate passed |
| Metadata files | 268 |
| Packaging errors | None |
| Installation in another Developer Edition org | Reported successful by the maintainer; Tooling API configuration completed |

The packaging test user is assigned `Diagram_Studio_User` through `apexTestAccess`. The initial two user-mode import test failures were resolved without removing tests or bypassing field security. This installer predates the app-page enhancement below.

## Current source: app-page field discovery

| Check | Result |
| --- | --- |
| Initial Apex deployment | `0Afaj00000qmUAjCAM`, 24/24 tests passed |
| Final service/frontend/help deployment in Crius | `0Afaj00000qmQzyCAE`, succeeded; 24/24 Apex tests passed |
| New AppPageFieldService executable-line coverage | 100% in targeted tests |
| AppModelController executable-line coverage | 92.31% in targeted tests |
| JavaScript workspace and Ubuntu desktop runs | 32 suites, 273 passed, 10 existing skips |
| Live Sales configuration before filtering | 199 field references across eight navigation objects |
| Live Sales model pipeline after filtering | 10 objects, 8 relationships, 185 retained fields, 4,562 DSL characters |
| Evidence check | Every non-Id model field matched evidence; no full-schema fallback |
| Metadata inventory | New service/test classes included in the complete V5 manifest |

The live pipeline ran production `collectAppScope`, `selectAppObjects`, `prepareAppSchema`, `buildErSource` and `parseEr` against Crius metadata. It did not change saved diagrams or business records. The tests cover UI-only generation, option-off preservation, source/page merging, assigned Dynamic Forms fixtures, unreadable/ambiguous configuration and bounds. The live Sales org exercised default navigation layouts; unsupported layouts returned warnings.

Class coverage above is not a new package-wide coverage measurement. Current source needs a new beta build before installed subscriber orgs receive the app-page option. Manual visual acceptance and real profile/record-type assignment variants remain separate checks.

## Scanner regression

The earlier LWC failure was reproduced as `Regex too complicated`, including the large Studio bundle on its own. Candidate-based anchored matching and isolated UI work units replaced full-source regex searches. Eighteen targeted Apex tests passed; a live replay of all twelve affected bundles completed with zero platform errors. OmniStudio runtime discovery skipped safely because no readable standard runtime objects existed in that org. A subsequent fresh scan was reported successful after storage cleanup.

## Remaining acceptance

- Install a newly built app-page version in a clean subscriber test org and verify save/open, modules/imports, generation, exports and permissions there.
- Exercise app-assigned Dynamic Forms and principal/profile/record-type variation with real configured pages.
- Test actual standard OmniStudio definitions in an org exposing those objects; absent-capability skips do not establish installed-Omni acceptance.
- Complete authenticated external MCP discovery/read/scan checks if distributing that integration.
- Validate migration/component ownership separately before installing alongside an older package or promoting for production.

See [setup](SETUP.md), [architecture](ARCHITECTURE.md) and [release notes](V5_RELEASE_NOTES.md).
