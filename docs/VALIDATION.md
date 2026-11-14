# V5 validation

**Crius Consulting · Updated: 14 November 2026**

This page records current results. Detailed earlier runs remain in Git history; installer and source validation are distinct.

## Production release 5.0.0.4

| Check | Verified result |
| --- | --- |
| Dev Hub | Released, 91% package Apex coverage, coverage gate passed |
| Build / subscriber version | `08caj000000JavpAAC` / `04taj000000qN5NAAU` |
| Clean Developer scratch org | Installed successfully. Assigned Diagram Studio User, verified the System Information version, saved and reopened a diagram through the installed Apex controllers. |
| UI regressions | 36 suites and 293 tests passed, 10 skipped, with a 30-second per-test timeout. Earlier runs timed out at five seconds. |
| PSS source scan before packaging | Manual and verification scans each processed 104 work units, recorded 405 evidence rows and finished with zero scan errors. |

## Beta 5.0.0.2

Salesforce built and validated the unlocked beta with 91% package Apex coverage. Build request `08caj000000JanlAAC`, subscriber version `04taj000000qMHNAA2`. Source deployment tests in the two existing orgs are listed below. Clean-org installation of this build is unverified.

## Illustrated Help validation

| Check | Result |
| --- | --- |
| UI regression suite | 36 suites passed, 293 tests passed, 10 existing skips |
| New diagram reference component | 100% measured JavaScript line, statement, function and branch coverage |
| Worked examples | Tested with the Studio parser and module compiler, including a two-file import and inheritance |
| Final PSS deployment | 215 Apex tests passed · `0AfQE00000BMm9J0AT` |
| Final Crius deployment | 257 Apex tests passed · `0Afaj00000rX6svCAC` |

## Earlier installer 5.0.0.1

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

## Earlier validation of app-page field discovery

| Check | Result |
| --- | --- |
| Initial Apex deployment | `0Afaj00000qmUAjCAM`, 24/24 tests passed |
| Final service/frontend/help deployment in Crius | `0Afaj00000qmQzyCAE`, succeeded; 24/24 Apex tests passed |
| New AppPageFieldService executable-line coverage | 100% in targeted tests |
| AppModelController executable-line coverage | 92.31% in targeted tests |
| JavaScript runs | Workspace and Ubuntu desktop: 32 suites, 277 passed, 10 existing skips |
| Live Sales configuration before filtering | 199 field references across eight navigation objects |
| Live Sales model pipeline after filtering | Latest file-table exclusion: 9 objects, 8 relationships, 181 retained fields, 4,441 DSL characters |
| Evidence check | Every non-Id model field matched evidence; no full-schema fallback |
| Metadata inventory | New service/test classes included in the complete V5 manifest |

The live pipeline ran production `collectAppScope`, `selectAppObjects`, `prepareAppSchema`, `buildErSource` and `parseEr` against Crius metadata. It did not change saved diagrams or business records. The tests cover UI-only generation, option-off preservation, source/page merging, assigned Dynamic Forms fixtures, unreadable/ambiguous configuration and bounds. The live Sales org exercised default navigation layouts; unsupported layouts returned warnings.

Class coverage above is not a new package-wide coverage measurement. Current source needs a new beta build before installed subscriber orgs receive the app-page option. Manual visual acceptance and real profile/record-type assignment variants remain separate checks.

## Generated-model file table exclusion

ContentDocument, ContentVersion and ContentDocumentLink are excluded by the app-generation scope filter. Custom objects with similar names remain eligible. A regression test confirms file and platform objects are still searchable in the unchanged drag palette, including after the initial display limit. Existing saved diagrams, typed DSL and manual import/search sources are not rewritten or filtered. The Ubuntu live Sales model pipeline retained only evidenced fields after file-table exclusion. This frontend change does not change Apex coverage.

## Requested component/access card results

The live Sales scope in Crius returned no verified Apex/Flow references and no explicit named permission-set/licence cards. Its AppMenuItem lookup also returned no matching entry. Added a verified selected-app UI metadata/TabSet fallback, rejecting mismatched identities instead of guessing by label. After the fix, Sales still correctly resolved no explicit grants, with the identity lookup gap removed.

A Warden Studio control resolved eight Apex names and the **Warden Studio User** permission set. That set had no explicit licence binding; no licence card was invented. Positive Apex/Flow/licence card rendering remains covered by frontend fixtures.

Access deployment `0Afaj00000qmbYnCAI` passed **4/4 Apex tests** with **100% AppAccessService executable-line coverage** and no coverage warnings. Frontend deployment `0Afaj00000qmP4cCAE` succeeded with zero component errors. The frontend shows requested-card counts/zero-result explanations after generation and persists them in DSL comments and Model Details. Tests cover empty results, real cards, deduplication, no invented licences and banner dismissal. Workspace and desktop suites passed **277 tests**, with 10 existing skips. This is a source enhancement requiring a subsequent installer build.

## Scanner regression

The earlier LWC failure was reproduced as `Regex too complicated`, including the large Studio bundle on its own. Candidate-based anchored matching and isolated UI work units replaced full-source regex searches. Eighteen targeted Apex tests passed; a live replay of all twelve affected bundles completed with zero platform errors. OmniStudio runtime discovery skipped safely because no readable standard runtime objects existed in that org. A subsequent fresh scan was reported successful after storage cleanup.

## Remaining acceptance

- Install a newly built app-page version in a clean subscriber test org and verify save/open, modules/imports, generation, exports and permissions there.
- Exercise app-assigned Dynamic Forms and principal/profile/record-type variation with real configured pages.
- Test actual standard OmniStudio definitions in an org exposing those objects; absent-capability skips do not establish installed-Omni acceptance.
- Complete authenticated external MCP discovery/read/scan checks if distributing that integration.
- Validate migration/component ownership separately before installing alongside an older package or promoting for production.

See [setup](SETUP.md), [architecture](ARCHITECTURE.md) and [release notes](V5_RELEASE_NOTES.md).

## Sales activity layout API fix

Live Crius checks reproduced `UNSUPPORTED_API_VERSION` for Task/Event at UI API v60.0. Both returned valid View/Large layouts at v66.0, also verified through the app's Salesforce_Tooling_API Named Credential. The service now uses v66.0 for UI layout reads while retaining v60.0 Tooling metadata queries. Live layout responses contained 12 distinct Task field references and 13 Event field references; these are configuration evidence, not a new complete generated-model acceptance result.

CollaborationGroup and Dashboard returned INVALID_TYPE (unsupported UI API objects), while Report returned INVALID_TYPE (not layoutable). Known API error codes now produce capability/version explanations instead of a bare HTTP failure; raw error-body details are not exposed. No schema fallback or manual search exclusion was added.

Crius deployment `0Afaj00000qo0bZCAQ` succeeded with 25/25 targeted Apex tests and zero component errors. Tests verify the layout API version and safe unsupported/version diagnostics. The unchanged JavaScript baseline passed 32 suites, 277 tests, with 10 existing skips. Installed beta 5.0.0.1 does not include this source fix.

## Parallel Crius / PSS source deployment

The compact generation banner keeps counts and explanations in Model Details and saved DSL comments. Inclusion reasons now open expanded, with visible disclosure indicators. The previously blank-looking section was collapsed, not missing evidence.

| Target | Full-source deployment | Apex result |
| --- | --- | --- |
| Original Crius Developer Edition | `0Afaj00000qo6vVCAQ` | 194/194 passed; 168 components; no coverage warnings |
| Crius Consulting Limited PSS Enterprise trial | `0AfQE00000BKFz30AH` | 194/194 passed; 168 components; no coverage warnings |

Both deployments ran in parallel from the same source. JavaScript: 32 suites, 277 passed, 10 existing skips. Earlier failed deployment attempts rolled back. Clean-org validation exposed user-mode import test setup requirements, inaccessible PSS field metadata, and an empty exclusion setting returning null. Tests now execute imports as a dedicated user assigned Diagram_Studio_User; runtime user-mode security is unchanged. Schema relationship enumeration skips individual SObjectException failures on inaccessible licensed fields. Empty saved exclusions normalize to an empty string/set. Settings tests exercise exclusions and bounded MCP-only history filtering.

PSS preflight found only the Sales Insights installed package, no matching core Studio classes, and ample storage. Standard OmniProcess, OmniDataTransform and OmniUiCard objects were queryable but each had zero records; installed-Omni content acceptance therefore remains pending. There were 334 permission-set licence records; that inventory is not evidence of selected-app licence use. PSS had no Named Credential and requires its own Tooling API OAuth configuration before scanning. No package was promoted and no branch was merged.

## Readable access inclusion evidence

Access explanations are now assembled after resolving permission-set labels/API names. Grants are grouped under the named permission set, identify the selected app or reached Apex class, and explain why the access card was included. App display labels come from verified AppDefinition identity; class names come from the reached component scope. ID keys normalize 15/18-character forms. Unresolved names are explicitly labelled unavailable, with an ID only as fallback; names are never guessed.

Parallel targeted deployments succeeded in original Crius (`0Afaj00000qo9VBCAY`) and PSS (`0AfQE00000BKG0f0AH`): 5/5 AppAccessService tests in each, no component errors or coverage warnings. A live Crius call confirmed Warden Studio User [Warden_Studio_User], Apex class WardenAccess and Warden Studio [Warden_Studio] appear in the evidence without opaque IDs. PSS live credential-backed discovery still awaits its OAuth configuration. Regeneration refreshes explanations; saved diagrams are not rewritten.

## Compact inclusion summaries

Permission-set evidence now uses separate short lines for the named set, app visibility and a sorted, deduplicated Apex class list with its count. Repeated per-class app explanations were removed; detailed coverage limitations remain in their own section. The UI preserves line breaks in compact reason blocks and moves metadata dependency references into a collapsed, counted Component references section without discarding them.

Parallel deployments succeeded in Crius (`0Afaj00000qoD0vCAE`) and PSS (`0AfQE00000BKF300AH`), each with 5/5 access tests and no component errors or coverage warnings. JavaScript passed 32 suites and 277 tests, with 10 existing skips. No scan restart or scan-data mutation was performed.

## PSS metadata resilience and Health Check

Parallel full-source deployments succeeded: Crius `0Afaj00000qpLcLCAU` and PSS `0AfQE00000BKJkv0AH`, each with **200/200 Apex tests**, no component errors or coverage warnings. A final unknown-detection wording correction passed 5/5 diagnostics tests in each org: Crius `0Afaj00000qpM29CAE`, PSS `0AfQE00000BKJmX0AX`. JavaScript passed all 32 suites, 277 tests, with 10 existing skips. Two initial five-second timeouts passed on the full rerun with a fifteen-second timeout; there were no initial assertion failures.

Live metadata-only Health Check under the CLI-connected PSS user detected Public Sector licensing and reported 92 gaps across 50 objects and 938 fields, explicitly marked partial. BenefitDisbursement StartDate, EndDate and ApprovalStatus were reported as metadata unavailable; other fields were identified as missing Read. Original Crius reported PSS not applicable. These results are scoped to the tested user and bounded check, not whole-org access certification.

A live replay of the discovery path for BenefitDisbursement, Account and a nonexistent industry object completed in both orgs. Unavailable fields produced schema-coverage warnings instead of aborting discovery. Temporary Studio run records were rolled back; business records and saved diagrams were untouched. No complete replacement org scan has been accepted yet.

The Tooling connection check passed in Crius. The CLI-connected PSS user could not access the Salesforce_Tooling_API credential; its credential/principal access must be verified separately before a full scan. This does not establish whether another user has configured or authenticated that credential. No permissions were granted automatically, package promoted or branch merged.

## Health Check permission-path wording review

Message-only deployments on 9 November 2026 (New Zealand time) succeeded in Crius (`0Afaj00000qrNGfCAM`) and PSS (`0AfQE00000BKOO10AP`), with 7/7 targeted tests each. Instructions now identify Setup > Permission Sets > Diagram Studio User > Object Settings > the affected object, then Object Permissions > Read or Field Permissions > the affected field > Read Access. Unavailable metadata retains a licence/availability qualification. Only the two diagnostic Apex classes were deployed; neither org's permission set was modified. PSS permission changes await the user's review of the wording. Non-PSS detection behaviour is unchanged.

## Industry access review and scan error handling

The comparison tests use two permission sets. A field already readable by the administrator and explicitly granted by a second permission set still appears as missing on the target. Applying its fix adds only object Read and field Read to the target. The tests also exercise non-administrator denial, unsupported fields, existing permissions and non-industry orgs.

The operational console tests cover launch failures, persisted run errors, session log details, configured logger routing and duplicate polling. The JavaScript suite passed 283 tests across 34 suites with 10 existing skips.

PSS deployment 0AfQE00000BLkpV0AT passed 205 local Apex tests. A live read-only Health Check compared 21 objects and 450 fields against Diagram Studio User and found 121 missing Read permissions. For BenefitDisbursement the live preview reported missing Object Read, seven configurable missing field grants and three unavailable fields. Each proposed field was checked against the target set's stored grants. Both live checks performed zero DML statements.

### Latest-scan field coverage

The original Crius deployment `0Afaj00000rDhrqCAC` passed 248 Apex tests. The PSS deployment `0AfQE00000BLrUP0A1` passed 206. All 34 Jest suites passed (285 tests passed, 10 skipped).

A rolled-back PSS discovery sample processed BenefitDisbursement and Account, recorded a SCAN_SKIP run marker, skipped BenefitDisbursement.StartDate and confirmed Account.Phone remained readable. This sample did not run a full org scan or change any permission sets.
