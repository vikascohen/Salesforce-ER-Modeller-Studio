# V5 validation record

## Latest Lightning-source and editor-validation checks — 7 November 2026

| Check | Result |
| --- | --- |
| JavaScript suites, workspace and connected desktop | 32 suites; 270 passed; 10 existing skips |
| AppModelController Apex tests | 15/15 passed; no coverage warnings |
| Lightning source/controller deployment | Succeeded: `0Afaj00000qh48sCAA` |
| Final editor-validation/help deployment | Succeeded: `0Afaj00000qijMrCAI` |
| Live standalone Studio root | Existing diagramStudio LWC listed and identity verified; existing V5 snapshot reused |
| Live dependency traversal, automation off | 77 reached components, seven expansion requests, 109 field references before UI platform filtering |
| Logged cause of Customer badge | Prior incomplete `use` and `use cus` statements, not completed `use Customer` |

The selected root was the existing ER Modeller bundle, not a newly created Salesforce app. Live discovery included Studio storage/evidence objects such as Diagram_File__c and Field_Usage_Run__c; it did not infer every Salesforce object the modeller can display. Current-source parsing regressions cover incomplete use prefixes, completion to a valid two-object model, inert definitions, last-valid-canvas preservation, invalid import paths and no diagnostic persistence during normal typing. A separate regression confirms that correcting DSL does not erase a genuine file-load error from recorded history.

Lightning/Aura catalogue and scope fixtures cover source identity/type checks, missing/inaccessible/ambiguous records, required V5 scan and catalogue truncation. UI tests cover source switching, stale catalogue responses, evidenced-fields-only generation, disabled app-specific access discovery in component mode and preserving source when evidence is missing. No scan was started, old diagnostics deleted or Salesforce application created for this change.

## Earlier V5 source-preview checks — 7 November 2026

| Check | Result |
| --- | --- |
| Development workspace JavaScript suite | 32 suites; 266 passed; 10 existing skips |
| Connected Linux desktop JavaScript suite | 32 suites; 266 passed; 10 existing skips |
| Named-access Apex fixture tests | 3/3 passed; no coverage warnings |
| Named-access developer-org deployment | Succeeded: `0Afaj00000qh4FJCAY` |
| Final IntelliSense/help LWC deployment | Succeeded: `0Afaj00000qhACfCAM` |
| Documentation examples | 16 runnable DSL examples passed; one intentionally invalid example rejected |
| Documentation links | Local README/reference/guide links checked |
| V5 manifest | Salesforce CLI source-to-metadata conversion passed; new access/DSL/Omni dependencies included and obsolete V4 package name removed |
| Whitespace/XML/source references | Checked |

The latest suite covers inert exports, explicit use alongside top-level declarations, named imports/from/extends, visibility and cycles, all six component types, labels/JSON escaping, label snippets, saved/imported access-name candidates, keyboard acceptance, identifier/quote replacement, schema/card separation and existing diagram/routing regressions. Empty display-label snippets remain valid while being filled, using their identifier as the interim title. Invalid JSON and conflicting activated labels report source errors.

The desktop run used a 15-second per-test allowance after an earlier existing Relationship Insights test exceeded its default five-second limit on that device. All assertions then passed; the test was not skipped. The final deployment initially failed at network transfer before a Salesforce job was created; retry succeeded with the ID above.

Live read-only access discovery resolved Warden Studio User, Nebula Logger: Admin and Nebula Logger: Log Viewer from app visibility grants. Those permission sets had no explicit licence binding. Permission-set/user licence and installed-package label paths also have fixture coverage; this is not a claim that a live app was found to require those licences. A final live client check serialised these actual names into labelled component DSL, verified that exported definitions alone render nothing, then activated them with `use` and checked exact labels with zero schema entities. Discovery did not read user assignments or modify business records.

Earlier module deployment `0Afaj00000qgspFCAQ` passed 53 selected Apex tests. Its rollback-only live check verified import binding across rename, canonical filename uniqueness, import-only empty rendering, explicit use, top-level field merging and an Apex card. Canvas deployment `0Afaj00000qgzHFCAY` passed 250 JavaScript tests, including arrow clearance in four directions; its Chrome-rendered three-object geometry preview was visually inspected. The latest suite retains those regressions. Browser interaction through every Salesforce feature has not been visually re-exercised.

V5 remains a source preview. The historical checks below are retained with their original scope; their initial test counts and acceptance notes are not the latest totals. Clean-org/package acceptance and a V5 package release remain outstanding. See [V5 release notes](V5_RELEASE_NOTES.md), [DSL reference](DSL.md), [architecture](ARCHITECTURE.md#23-v5-composition-app-models-and-named-access) and [app modelling](V5_APP_MODELLING.md).

## Initial validation baseline — 6 November 2026

Validated on 6 November 2026. Implementation commit: `8f4e57210fd25c2b38f3ee0aeb3a0c8a19d807af` (tree `41b992ac084dae74180d292d42a97839962db426`).

| Check | Result |
| --- | --- |
| Baseline V4 Jest run | 30 suites, 184 passed, 10 pre-existing skipped |
| Initial V5 Jest run in development workspace | 31 suites, 195 passed, 10 pre-existing skipped |
| Initial V5 Jest run on connected Linux desktop | 31 suites, 195 passed, 10 pre-existing skipped |
| Salesforce full-source dry-run deployment | Succeeded; checkOnly=true; 156/156 metadata components accepted |
| Salesforce RunLocalTests | 196/196 Apex tests passed; zero failures |
| Coverage in returned class-coverage entries | 85.19%; no coverage warnings |
| Metadata XML parsing and git whitespace check | Passed |
| Published GitHub tree vs development workspace | Exact tree match |

Salesforce validation job: `0Afaj00000qZc9KCAS`, run through Salesforce CLI on the connected desktop against the existing development org. This was a check-only validation, not an installation or deployment. It did not change the installed application or released V4 package.

The initial dry run found a permission-set XML element-order error, which was corrected. A targeted run then exposed a new test-fixture callout/DML boundary issue, which was corrected. The selected-test validation subsequently passed all 47 tests but could not satisfy coverage for the entire submitted application; the final full RunLocalTests validation above passed the deployment gate.

Regression checks include preserving unsaved work, preserving edits during asynchronous discovery, handling failed discovery, paging and cycle detection, schema chunking, object-only Apex/Flow/LWC references, excluding comments, source-specific evidence and object-triggered automation. The org worker test verifies that object evidence is persisted alongside unchanged field evidence.

## Remaining release acceptance

- Install/deploy in an isolated test org and run a real V5 org scan with the configured Named Credential.
- Interactively generate models from representative custom, standard and console apps, including custom tabs, utility pages, nested LWC, invocable Apex and active record-triggered flows.
- Check app/page assignments and inaccessible managed-package source coverage using the visible coverage notes.
- Run existing diagram save/open/export and field-usage acceptance checks in that installed org.
- Create and validate a V5 package before providing an installation link. No V5 package has been built or published by this change.

Passing compilation and automated tests does not replace these interactive acceptance steps. See [V5 app modelling](V5_APP_MODELLING.md) for behavior, setup and limits.

## Development-org deployment

On 6 November 2026, the user requested installation into the validated development org. Quick deployment `0Afaj00000qZX4pCAG` succeeded with `checkOnly=false`; 156/156 metadata components were accepted.

The first live app-list check exposed missing external-credential principal access for the operator. A separate org-specific permission set, `ER_Studio_Tooling_Access`, was deployed and assigned to that operator. It grants access only to the existing `Salesforce_Tooling_API-ToolingAPIPrincipal` principal. It is separate from the reusable application permission set, so application source deployments do not remove the org-specific mapping. No OAuth secrets were changed.

Post-deployment live Apex smoke checks passed: Studio version 5, object-evidence schema present, 24 apps returned by the configured API principal, and Service app navigation scope resolved. A fresh V5 org scan and interactive generation acceptance remain required; no new scan was started as part of deployment.
