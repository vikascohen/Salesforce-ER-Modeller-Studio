# V5 validation record

Validated on 6 November 2026. Implementation commit: `8f4e57210fd25c2b38f3ee0aeb3a0c8a19d807af` (tree `41b992ac084dae74180d292d42a97839962db426`).

| Check | Result |
| --- | --- |
| Baseline V4 Jest run | 30 suites, 184 passed, 10 pre-existing skipped |
| Final V5 Jest run in development workspace | 31 suites, 195 passed, 10 pre-existing skipped |
| Final V5 Jest run on connected Linux desktop | 31 suites, 195 passed, 10 pre-existing skipped |
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
