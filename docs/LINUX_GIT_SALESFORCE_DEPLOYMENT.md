# Linux Git and Salesforce Deployment Guide

This guide documents a practical command-line workflow for working with Salesforce ER Modeller Studio on Linux: cloning the repository, switching branches, pulling and pushing changes, rebasing safely, resolving conflicts, authenticating a Salesforce org, validating deployments, deploying metadata, running tests, and recovering from common mistakes.

> **Important:** Commands that rewrite Git history, especially `rebase` and `push --force-with-lease`, should be used deliberately. Never rewrite a shared stable branch unless that is explicitly intended.

## 1. Prerequisites

Install and verify Git, Node.js/npm, and Salesforce CLI (`sf`).

```bash
git --version
node --version
npm --version
sf --version
```

Configure Git identity if required:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. Clone the repository

```bash
git clone https://github.com/vikascohen/Salesforce-ER-Modeller-Studio.git
cd Salesforce-ER-Modeller-Studio
```

Inspect the repository:

```bash
git status
git branch -a
git remote -v
```

`origin` is normally the GitHub repository from which the project was cloned.

## 3. Refresh remote branch information

Before switching branches or rebasing, fetch the latest remote state:

```bash
git fetch origin --prune
```

`fetch` downloads remote branch/commit information but does not modify your current working branch. `--prune` removes stale remote-tracking references for branches deleted from GitHub.

## 4. Switch branches

Show local branches:

```bash
git branch
```

Show local and remote branches:

```bash
git branch -a
```

Switch to an existing local branch:

```bash
git switch architecture-intelligence-refactor
```

Older Git versions can use:

```bash
git checkout architecture-intelligence-refactor
```

Create a local branch that tracks an existing remote branch:

```bash
git switch --track origin/architecture-intelligence-refactor
```

Create a new feature branch from the current branch:

```bash
git switch -c my-feature
```

A good habit after switching is:

```bash
git status
git log -1 --oneline
```

This confirms both the active branch and its current commit.

## 5. Pull the latest changes

For a normal update of the current branch:

```bash
git pull
```

A cleaner development workflow is often:

```bash
git fetch origin
git rebase origin/architecture-intelligence-refactor
```

This replays your local commits on top of the latest remote branch rather than introducing an unnecessary merge commit.

Do not start a rebase with uncommitted work unless you understand how that work will be handled. Check first:

```bash
git status
```

## 6. Make and review changes

Inspect changed files:

```bash
git status
git diff
```

Stage selected files:

```bash
git add force-app/main/default/classes/MyClass.cls
```

Or stage all intended changes:

```bash
git add .
```

Review what is staged:

```bash
git diff --cached
```

Commit:

```bash
git commit -m "Describe the change clearly"
```

Inspect recent history:

```bash
git log --oneline --decorate -10
```

## 7. Push changes to GitHub

Push an already tracked branch:

```bash
git push
```

For a new branch:

```bash
git push -u origin my-feature
```

The `-u` establishes the upstream branch, so subsequent `git pull` and `git push` commands can normally omit the remote and branch name.

## 8. Rebase a development branch onto main

Assume you are working on `architecture-intelligence-refactor` and want the latest `main` underneath your work.

First make sure your work is committed, then:

```bash
git fetch origin --prune
git switch architecture-intelligence-refactor
git rebase origin/main
```

Conceptually, Git temporarily removes your branch-only commits, moves the branch base to the latest `origin/main`, and then reapplies your commits in order.

### Resolve a rebase conflict

Check the conflicted files:

```bash
git status
```

Edit each conflicted file and remove conflict markers such as:

```text
<<<<<<< HEAD
...
=======
...
>>>>>>> commit
```

After resolving a file:

```bash
git add path/to/resolved-file
```

Continue:

```bash
git rebase --continue
```

Repeat until the rebase completes.

If the rebase was a mistake:

```bash
git rebase --abort
```

### Push after rebasing

A rebase changes commit IDs. If the branch had already been pushed, a normal push may be rejected. Use:

```bash
git push --force-with-lease
```

Prefer `--force-with-lease` over `--force`. It adds protection against overwriting remote work that you have not fetched.

Do not force-push `main`, `version-1-stable`, or `version-2-stable` as part of ordinary development.

## 9. Keep stable branches isolated

Stable branches should remain stable unless a deliberate maintenance fix is required.

Before making changes, confirm the branch:

```bash
git branch --show-current
```

For Version 3 or experimental work, switch to the intended development branch before editing:

```bash
git switch architecture-intelligence-refactor
```

A useful safety check is:

```bash
git status
git log -1 --oneline
```

Do this before committing or deploying if there is any doubt about which branch is active.

## 10. Authenticate a Salesforce org

Authenticate through the browser and assign a convenient alias:

```bash
sf org login web --alias ermodel-dev
```

A browser opens. Sign into the intended Salesforce org and approve access.

List authenticated orgs:

```bash
sf org list
```

Display the target org:

```bash
sf org display --target-org ermodel-dev
```

Be certain that the alias points to the intended development/sandbox org before deploying.

## 11. Deploy to Salesforce

From the repository root, deploy the Salesforce metadata under `force-app/main/default`:

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org ermodel-dev
```

For a longer deployment, provide an explicit wait period:

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org ermodel-dev \
  --wait 30
```

## 12. Validate before deploying

For a release-oriented workflow, validate first:

```bash
sf project deploy validate \
  --source-dir force-app/main/default \
  --target-org ermodel-dev \
  --test-level RunLocalTests \
  --wait 30
```

Validation checks whether the metadata can be deployed without committing the deployment to the org.

After a successful validation, perform the real deployment:

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org ermodel-dev \
  --test-level RunLocalTests \
  --wait 30
```

## 13. Deploy only selected metadata

During development it is often faster to deploy only the component being changed.

Example Apex class:

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/FieldUsageController.cls \
  --target-org ermodel-dev
```

Example LWC bundle:

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/fieldUsageIntelligence \
  --target-org ermodel-dev
```

When components have dependencies, deploy the complete related set or the complete `force-app/main/default` tree.

## 14. Run Apex tests

Run local Apex tests:

```bash
sf apex run test \
  --target-org ermodel-dev \
  --test-level RunLocalTests \
  --wait 30 \
  --code-coverage
```

Run named tests when iterating on a particular subsystem:

```bash
sf apex run test \
  --target-org ermodel-dev \
  --tests FieldUsageControllerTest \
  --wait 30 \
  --code-coverage
```

## 15. Run JavaScript/Jest tests

Install project dependencies if necessary:

```bash
npm install
```

Then run the project's configured test command, commonly:

```bash
npm test
```

If the repository provides specific Jest scripts in `package.json`, use those scripts rather than inventing a separate command.

## 16. Recommended daily development workflow

A safe Linux workflow is:

```bash
# 1. Enter repository
cd Salesforce-ER-Modeller-Studio

# 2. Refresh GitHub state
git fetch origin --prune

# 3. Select development branch
git switch architecture-intelligence-refactor

# 4. Bring branch up to date
git pull --rebase

# 5. Confirm where you are
git status
git log -1 --oneline

# 6. Make changes and run tests
npm test

# 7. Review changes
git diff
git status

# 8. Commit
git add .
git diff --cached
git commit -m "Describe the change"

# 9. Push
git push

# 10. Validate Salesforce deployment
sf project deploy validate \
  --source-dir force-app/main/default \
  --target-org ermodel-dev \
  --test-level RunLocalTests \
  --wait 30

# 11. Deploy after validation
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org ermodel-dev \
  --test-level RunLocalTests \
  --wait 30
```

## 17. Moving completed development into main

Do not casually copy files between branches. Prefer Git history.

First update the development branch against the latest main:

```bash
git fetch origin
git switch architecture-intelligence-refactor
git rebase origin/main
```

Run tests and validate the Salesforce deployment again after the rebase.

Push the rebased development branch if appropriate:

```bash
git push --force-with-lease
```

Then merge through the repository's normal pull-request/review process. This provides an auditable boundary between development work and `main`.

After the merge, update local main:

```bash
git switch main
git pull --ff-only origin main
```

`--ff-only` prevents Git from unexpectedly creating a local merge commit while updating main.

## 18. Useful recovery commands

### Discard unstaged changes to one file

```bash
git restore path/to/file
```

### Unstage a file but keep its edits

```bash
git restore --staged path/to/file
```

### Temporarily store uncommitted work

```bash
git stash push -m "temporary work"
```

Restore it later:

```bash
git stash pop
```

### Inspect reflog

If a branch appears to have lost a commit after a reset/rebase:

```bash
git reflog
```

The reflog often makes the previous commit reachable for recovery.

### Abort a merge

```bash
git merge --abort
```

### Abort a rebase

```bash
git rebase --abort
```

## 19. Git pull strategies

Three common approaches are:

```bash
git pull --ff-only
```

Updates only when the remote can be fast-forwarded cleanly. This is a good conservative choice for `main` and stable branches.

```bash
git pull --rebase
```

Replays local development commits over the latest remote commits. Useful for feature/development branches when a linear history is desired.

```bash
git pull --no-rebase
```

Allows Git to merge divergent histories. Use when an explicit merge commit is intended.

## 20. Deployment troubleshooting

### `REQUEST_LIMIT_EXCEEDED` in a third-party GitHub deployment website

That can be a limit of the external deployment service rather than a failure in the repository. Salesforce CLI avoids depending on that website and gives direct deployment diagnostics.

### Dependent class is invalid and needs recompilation

Read the deepest/root compiler error first. One invalid Apex class can cause many dependent classes and tests to be reported as invalid.

### Wrong org

Before deploying, verify:

```bash
sf org display --target-org ermodel-dev
```

Never assume an alias still refers to the org you intended.

### Wrong branch

Verify:

```bash
git branch --show-current
git log -1 --oneline
```

### Deployment succeeds but Lightning still looks old

Hard-refresh the browser and, where appropriate, clear browser/session cache. Also verify that the expected metadata actually exists in the deployed commit.

## 21. Release checklist

Before moving a development branch into `main`:

- Working tree is clean (`git status`).
- Branch is rebased/updated against current `main`.
- Apex tests pass.
- Jest tests pass.
- Salesforce validation succeeds.
- Manual smoke tests pass in the intended development/sandbox org.
- No development-only metadata or credentials are committed.
- Security/privacy documentation matches actual runtime behaviour.
- Stable Version 1/Version 2 branches have not been unintentionally modified.
- Diff against `main` has been reviewed before merge.

Useful final comparison:

```bash
git fetch origin
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

## 22. Core principle

Treat GitHub and Salesforce as two separate destinations:

1. **Git** controls source history and branches.
2. **Salesforce CLI** validates and deploys a selected source state into an org.

A deployment does not replace Git discipline, and pushing to GitHub does not deploy Salesforce metadata. Always know **which Git branch/commit** you are on and **which Salesforce org alias** you are targeting before running a deployment.