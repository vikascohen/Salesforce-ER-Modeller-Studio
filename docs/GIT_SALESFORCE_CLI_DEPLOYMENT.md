# Version 3 Beta — Installation, Configuration & Testing Guide

**Author: Vikas Cohen**

This is the **start-here guide for Version 3 beta testers** of Salesforce ER Modeller Studio. You do not need to contribute code to beta test the product.

The beta branch is `v3-beta-testing`. Version 1 and Version 2 stable branches are not changed by this beta.

## 1. What a beta tester needs to do

A complete V3 beta installation has four parts:

1. Install the metadata from `v3-beta-testing` into a Salesforce test/development org.
2. Assign the **Diagram Studio User** permission set to the user who will run the Studio.
3. Configure the **Salesforce Tooling API** authentication required by V3 Field Usage and selected metadata intelligence.
4. Run Diagnostics and a first Field Usage scan before testing the V3 intelligence features.

**Important:** a successful metadata deployment alone does not complete the V3 setup. Permission assignment and Tooling API configuration are required for the relevant V3 capabilities.

## 2. Installation option A — Deploy V3 Beta button

The repository README contains a **Deploy V3 Beta to Salesforce** button. This is the simplest installation path for testers who do not want to work from Git or Salesforce CLI.

The button targets the `v3-beta-testing` branch.

After the deployment completes, continue with **Section 4 — Required post-install configuration** below. Do not stop after deployment.

## 3. Installation option B — Salesforce CLI

### 3.1 Prerequisites

Verify Git and Salesforce CLI:

```bash
git --version
sf --version
```

Node/npm are also useful if you intend to run the repository's Jest tests:

```bash
node --version
npm --version
```

### 3.2 Clone the V3 Beta branch

```bash
git clone --branch v3-beta-testing https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git
cd Salesforce-ER-Modeller-Studio
```

Verify the source you are about to deploy:

```bash
git branch --show-current
git log -1 --oneline
```

The branch should be:

```text
v3-beta-testing
```

### 3.3 Authenticate the Salesforce beta-test org

Choose your own local alias; for example:

```bash
sf org login web --alias ermodeller-beta
```

Then verify the target org before changing it:

```bash
sf org list
sf org display --target-org ermodeller-beta
```

### 3.4 Deploy V3 Beta

From the Salesforce DX project root:

```bash
sf project deploy start --source-dir force-app/main/default --target-org ermodeller-beta --wait 30
```

The `main` in `force-app/main/default` is a Salesforce DX directory name. It is unrelated to the Git branch named `main`.

## 4. Required post-install configuration

Complete this section regardless of whether you installed with the Deploy button or Salesforce CLI.

### 4.1 Assign the Diagram Studio User permission set

In Salesforce Setup:

1. Open **Permission Sets**.
2. Open the **Diagram Studio User** permission set.
3. Select **Manage Assignments**.
4. Select **Add Assignments**.
5. Choose each user who needs to run/test ER Modeller Studio.
6. Complete the assignment.

At minimum, assign it to the beta-testing user before testing the Studio.

The purpose of the permission set is to give the user the application permissions packaged for Diagram Studio rather than relying on broad profile-level access.

### 4.2 Configure the Salesforce Tooling API

V3 Field Usage Intelligence and selected metadata-intelligence capabilities use authenticated Salesforce Tooling API access.

The application expects the Salesforce Named Credential:

```text
Salesforce_Tooling_API
```

Configure the associated authentication exactly as described by **ER Modeller Studio → Help → Configuration** in the installed application. The configuration includes the required **External Credential / principal relationship and user access to that principal**.

The exact Salesforce Setup screens can vary with Salesforce platform changes, so the in-product Configuration guide is the operational source of truth for the current V3 build.

Do not place passwords, access tokens, session IDs, client secrets or other credentials in Git or application source.

### 4.3 Grant External Credential principal access

Creating a Named Credential is not sufficient if the testing user cannot use its External Credential principal.

Follow **Help → Configuration** and ensure the testing user receives the required principal access through the permission configuration described there.

If the Tooling API diagnostic reports an authentication/permission failure, check this assignment before assuming the scanner itself is broken.

## 5. Verify the installation

After permissions and Tooling API configuration are complete:

1. Open ER Modeller Studio as the beta-testing user.
2. Confirm the Studio loads successfully.
3. Open **Help → Configuration** and compare the org setup with the documented requirements.
4. Open **Diagnostics / System Information**.
5. Run the available diagnostics.
6. Confirm Tooling API connectivity succeeds.
7. Open **Run Usage Scan**.
8. Launch the first Field Usage scan.
9. Allow the asynchronous scan pipeline to finish.
10. Confirm a successful current snapshot is available.
11. Open **Field Usage** and inspect dependency evidence.
12. Open **Architecture Intelligence → Field Change Impact** and test a field that has evidence.

If deployment succeeds but these steps do not, record the exact diagnostic/error message as part of the beta feedback.

## 6. What beta testers should exercise

Please test both the existing product and the new V3 capabilities. V3 is intended to carry forward the V1/V2 functionality while adding the V3 intelligence subsystem.

Recommended areas:

- ER canvas and Salesforce schema loading.
- Relationships and model navigation.
- ER DSL editing and bidirectional modelling.
- Data Dictionary and field detail.
- Data Dictionary Excel export.
- Schema Drift / Compare with Org.
- Sharing View and Heatmap.
- Architecture Intelligence.
- Object Intelligence, including Record Types, Page Layouts, Triggers, Validation Rules and Flows where present.
- Field Usage scanning.
- Field Usage Map and evidence drill-down.
- Field Change Impact.
- Schedule settings and running-task monitoring.
- Diagnostics.
- Theme/UI behaviour.

See `RELEASE-NOTES-V3.md` for the V3 feature and regression-testing checklist.

## 7. Updating an existing local beta checkout

If you already cloned the repository and want the latest beta build:

```bash
git status
git fetch origin --prune
git switch v3-beta-testing
git pull --rebase origin v3-beta-testing
git branch --show-current
git log -1 --oneline
```

Then redeploy:

```bash
sf org display --target-org ermodeller-beta
sf project deploy start --source-dir force-app/main/default --target-org ermodeller-beta --wait 30
```

If you used a different org alias, substitute that alias for `ermodel-dev`/`ermodeler-beta` examples.

## 8. Optional validation from Salesforce CLI

A tester comfortable with Salesforce CLI can validate before deploying:

```bash
sf project deploy validate --source-dir force-app/main/default --target-org ermodeller-beta --test-level RunLocalTests --wait 30
```

Run Apex tests with coverage:

```bash
sf apex run test --target-org ermodeller-beta --test-level RunLocalTests --wait 30 --code-coverage
```

Remember that `RunLocalTests` can include unrelated Apex already present in the target org. A failure in unrelated org code does not automatically identify an ER Modeller Studio defect.

## 9. Optional Jest validation

For contributors or technically inclined testers:

```bash
npm ci
npm run test:unit -- -- --runInBand
```

The repository CI also validates the beta branch.

## 10. Reporting useful beta feedback

When reporting a problem, please include:

- Salesforce org type where relevant (Developer Edition, sandbox, scratch org, etc.).
- Whether the org/application metadata uses a namespace or no namespace where relevant.
- The V3 Beta commit from `git log -1 --oneline` if installed through Git/CLI.
- Which installation method was used: Deploy button or CLI.
- Whether **Diagram Studio User** was assigned.
- Whether Tooling API diagnostics passed.
- The feature being tested.
- Exact error text where available.
- Reproduction steps.
- Screenshot where useful, excluding credentials or sensitive org data.

## 11. Contributor workflow — pull, edit, test and push

Beta testers do not need this section unless they also want to contribute code.

Start from the latest beta:

```bash
git status
git fetch origin --prune
git switch v3-beta-testing
git pull --rebase origin v3-beta-testing
```

Review changes while developing:

```bash
git status
git diff
git diff --check
```

Run Jest:

```bash
npm ci
npm run test:unit -- -- --runInBand
```

Deploy to the contributor's authenticated test org:

```bash
sf org display --target-org <org-alias>
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --wait 30
```

Commit and push intended changes:

```bash
git status
git diff --check
git add .
git diff --cached
git commit -m "Describe the change clearly"
git push origin v3-beta-testing
```

Do not commit credentials or secrets.

## 12. Useful Git recovery commands for contributors

Discard unstaged changes to one file:

```bash
git restore path/to/file
```

Unstage a file while keeping its edits:

```bash
git restore --staged path/to/file
```

Temporarily store work:

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

## 13. Branch safety

Current beta testing belongs on:

```text
v3-beta-testing
```

The historical stable branches are:

```text
version-1-stable
version-2-stable
```

Do not modify the stable branches while beta testing V3.

## 14. Installation checklist

Before calling a beta installation ready for functional testing, confirm:

- V3 Beta metadata deployed successfully.
- **Diagram Studio User** permission set assigned to the tester.
- `Salesforce_Tooling_API` configured.
- Required External Credential/principal access assigned to the tester.
- Studio opens successfully.
- Diagnostics complete successfully.
- Tooling API connectivity passes.
- First Field Usage scan completes successfully.
- A current successful Field Usage snapshot exists.
- Core ER modelling/Data Dictionary functionality works.
- Architecture Intelligence works.
- Field Usage and Field Change Impact work.

## 15. Security reminder

Use a development/test Salesforce org for beta testing unless your organisation has explicitly approved another environment. ER Modeller Studio reads Salesforce schema/metadata and V3 stores Field Usage evidence in Salesforce custom objects. Review `SECURITY.md` for the project's security model and Tooling API trust boundary.

---

**Vikas Cohen**  
**Lead Architect & Author**
