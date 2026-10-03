# Git and Salesforce CLI Development & Deployment Guide

**Author: Vikas Cohen**

This is the practical source-control and Salesforce CLI guide for ER Modeller Studio. The examples below use the current Version 3 beta branch, `v3-beta-testing`, while keeping Version 1 and Version 2 stable branches untouched.

## 1. Prerequisites

Verify Git, Node/npm and Salesforce CLI:

```bash
git --version
node --version
npm --version
sf --version
```

## 2. Clone the repository for the first time

```bash
git clone https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git
cd Salesforce-ER-Modeller-Studio
git fetch origin --prune
git switch --track origin/v3-beta-testing
```

If the repository is already cloned, do not clone it again.

## 3. Everyday start: get the latest V3 Beta

From the repository root:

```bash
git status
git fetch origin --prune
git switch v3-beta-testing
git pull --rebase origin v3-beta-testing
git branch --show-current
git log -1 --oneline
```

`git branch --show-current` should print `v3-beta-testing`.

If `git status` shows local uncommitted work, review, commit or deliberately stash it before rebasing.

## 4. Review changes while developing

```bash
git status
git diff
git diff --check
```

For JavaScript syntax checks when working on a specific file, for example:

```bash
node --check force-app/main/default/lwc/diagramStudio/diagramStudio.js
```

## 5. Run JavaScript/Jest tests

Install dependencies after a fresh clone or dependency change:

```bash
npm ci
```

Run the full LWC Jest suite:

```bash
npm run test:unit -- -- --runInBand
```

Do not push a beta candidate merely because a single Jest test passes; run the complete configured suite before treating the branch as green.

## 6. Authenticate a Salesforce org

Log in and give the org an alias:

```bash
sf org login web --alias <org-alias>
```

List authenticated orgs:

```bash
sf org list
```

Verify the exact target before deployment:

```bash
sf org display --target-org <org-alias>
```

For the existing development org shown during V3 work, the alias has been `ermodel-dev`. Always confirm it with `sf org list` rather than assuming an alias still points to the intended org.

## 7. Deploy V3 Beta to a Salesforce org

From the project root:

```bash
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --wait 30
```

For the known development alias, after verifying it:

```bash
sf project deploy start --source-dir force-app/main/default --target-org ermodel-dev --wait 30
```

The `main` in `force-app/main/default` is a Salesforce DX folder name. It is not the Git `main` branch.

## 8. Validate before deployment

For a beta/release-oriented check:

```bash
sf project deploy validate --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
```

Then deploy only after validation succeeds:

```bash
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
```

The repository CI uses its own specified-test validation strategy. Local `RunLocalTests` is useful when you want a broad org-side check, but remember that unrelated local-org Apex can also affect that result.

## 9. Run Apex tests and coverage

Run local Apex tests with coverage:

```bash
sf apex run test --target-org <org-alias> --test-level RunLocalTests --wait 30 --code-coverage
```

Run one test class while iterating:

```bash
sf apex run test --target-org <org-alias> --tests FieldUsageControllerTest --wait 30 --code-coverage
```

Apex deployment requires Salesforce coverage rules to be satisfied. For this project, the beta goal is stronger than the platform minimum: keep the important project classes well covered and keep CI green.

## 10. Deploy only a changed component during development

Example LWC bundle:

```bash
sf project deploy start --source-dir force-app/main/default/lwc/diagramStudio --target-org <org-alias>
```

Example Apex class:

```bash
sf project deploy start --source-dir force-app/main/default/classes/FieldUsageController.cls --target-org <org-alias>
```

If the change depends on related metadata, deploy the complete related set or `force-app/main/default` instead.

## 11. Commit and push to GitHub

Before committing:

```bash
git status
git diff
git diff --check
```

Stage the intended changes:

```bash
git add .
git diff --cached
```

Commit:

```bash
git commit -m "Describe the change clearly"
```

Push V3 Beta:

```bash
git push origin v3-beta-testing
```

Verify:

```bash
git status
git log -1 --oneline
```

## 12. Complete pull → test → deploy → commit → push workflow

For normal V3 Beta development, this is the practical sequence:

```bash
cd <repository-directory>
git status
git fetch origin --prune
git switch v3-beta-testing
git pull --rebase origin v3-beta-testing
git branch --show-current
git log -1 --oneline
npm ci
npm run test:unit -- -- --runInBand
git diff --check
sf org display --target-org <org-alias>
sf project deploy validate --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
git status
git diff
git add .
git diff --cached
git commit -m "Describe the change clearly"
git push origin v3-beta-testing
```

You can commit before deploying if that better matches the work being done; the essential rule is that you know exactly which branch and source state you are validating and deploying.

## 13. Pull after changes were made directly on GitHub

When documentation or code was committed to GitHub by another contributor/tool, refresh your local V3 Beta branch before making more local edits:

```bash
git switch v3-beta-testing
git fetch origin --prune
git pull --rebase origin v3-beta-testing
```

Then confirm:

```bash
git status
git log -3 --oneline
```

## 14. Named Credential requirement for V3

V3 Field Usage and selected metadata intelligence use authenticated Salesforce Tooling API access. Deploying source code does not by itself configure the target org's authentication relationship.

After installing V3 into a new org:

1. Open ER Modeller Studio.
2. Follow **Help → Configuration**.
3. Configure the `Salesforce_Tooling_API` Named Credential.
4. Configure the required External Credential and principal access.
5. Run diagnostics.
6. Run a Field Usage scan and verify a successful snapshot.

Do not commit credentials, access tokens, session IDs or secrets to Git.

## 15. Clean-org V3 Beta test

For a new beta-test org:

```bash
sf org login web --alias v3-beta-test
sf org display --target-org v3-beta-test
sf project deploy start --source-dir force-app/main/default --target-org v3-beta-test --wait 30
```

Then complete the Named Credential/External Credential setup from **Help → Configuration**, run diagnostics, execute Field Usage, and exercise the V1/V2 regression paths listed in `RELEASE-NOTES-V3.md`.

## 16. Useful Git recovery commands

Discard unstaged changes to one file:

```bash
git restore path/to/file
```

Unstage while keeping edits:

```bash
git restore --staged path/to/file
```

Temporarily stash work:

```bash
git stash push -m "temporary work"
git stash pop
```

Abort a rebase:

```bash
git rebase --abort
```

Inspect recoverable history:

```bash
git reflog
```

## 17. Branch safety for this repository

Active Version 3 beta work belongs on:

```text
v3-beta-testing
```

Do not accidentally develop on or rewrite the historical stable branches:

```text
version-1-stable
version-2-stable
```

Before editing, deploying or pushing, use:

```bash
git branch --show-current
git status
git log -1 --oneline
sf org display --target-org <org-alias>
```

Those four checks answer two critical questions: **which source am I using, and which Salesforce org am I changing?**

## 18. GitHub Deploy button vs Salesforce CLI

The README contains a **Deploy V3 Beta to Salesforce** button targeting `v3-beta-testing`. It is convenient for beta installation.

Salesforce CLI is preferable for development and troubleshooting because it provides direct validation output, test results and deployment diagnostics.

A Git push and a Salesforce deployment are separate operations:

- `git push` updates source history on GitHub.
- `sf project deploy ...` changes metadata in the selected Salesforce org.

One does not automatically replace the other.

## 19. Before calling V3 Beta green

Confirm all of the following:

- `git status` is clean for the intended commit.
- Current branch is `v3-beta-testing`.
- Full Jest suite passes.
- Salesforce CLI validation passes.
- Required Apex tests pass with acceptable coverage.
- Clean-org deployment succeeds.
- Named Credential/External Credential configuration works in the clean org.
- Field Usage produces a successful current snapshot.
- Data Dictionary, Architecture Intelligence, Object Intelligence and core ER modelling regression paths work.
- No credentials or secrets are committed.

---

**Vikas Cohen**  
**Lead Architect & Author**
