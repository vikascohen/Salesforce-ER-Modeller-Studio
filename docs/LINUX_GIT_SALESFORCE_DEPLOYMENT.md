# Linux Git and Salesforce Deployment Guide

This guide documents a practical, branch-agnostic command-line workflow for working with a Salesforce DX project on Linux: cloning a repository, switching branches, pulling and pushing changes, rebasing safely, resolving conflicts, authenticating a Salesforce org, validating deployments, deploying metadata, running tests, and recovering from common mistakes.

> **Important:** Replace placeholders such as `<development-branch>`, `<feature-branch>`, `<org-alias>`, and `<repository-directory>` with values appropriate to your environment. Commands that rewrite Git history, especially `rebase` and `push --force-with-lease`, should be used deliberately. Never rewrite a shared stable branch unless that is explicitly intended.

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
git clone <repository-url>
cd <repository-directory>
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

`fetch` downloads remote branch and commit information but does not modify your current working branch. `--prune` removes stale remote-tracking references for branches deleted from GitHub.

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
git switch <development-branch>
```

Older Git versions can use:

```bash
git checkout <development-branch>
```

Create a local branch that tracks an existing remote branch:

```bash
git switch --track origin/<development-branch>
```

Create a new feature branch from the current branch:

```bash
git switch -c <feature-branch>
```

After switching, verify the active branch and commit:

```bash
git status
git branch --show-current
git log -1 --oneline
```

## 5. Pull the latest changes

For a normal update of the current tracked branch:

```bash
git pull
```

For a linear-history development workflow:

```bash
git fetch origin
git rebase origin/<development-branch>
```

Or, when the current branch already tracks its remote branch:

```bash
git pull --rebase
```

Do not begin a rebase with uncommitted work unless you deliberately intend to stash or otherwise manage that work. Check first:

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
git add path/to/file
```

Or stage all intended changes:

```bash
git add .
```

Review staged changes:

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
git push -u origin <feature-branch>
```

The `-u` establishes the upstream branch, so subsequent `git pull` and `git push` commands can normally omit the remote and branch name.

## 8. Rebase a development branch onto main

Assume you are working on a generic development or feature branch and want the latest `main` underneath your work.

First commit or deliberately stash your work, then:

```bash
git fetch origin --prune
git switch <development-branch>
git rebase origin/main
```

Conceptually, Git temporarily removes your branch-only commits, moves the branch base to the latest `origin/main`, and reapplies your commits in order.

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

After resolving each file:

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

A rebase changes commit IDs. If the branch had already been pushed, a normal push may be rejected. For a development branch where history rewriting is acceptable, use:

```bash
git push --force-with-lease
```

Prefer `--force-with-lease` over `--force`; it protects against overwriting remote work you have not fetched.

Do not force-push `main` or shared/stable/release branches as part of ordinary development.

## 9. Keep stable and release branches isolated

Stable/release branches should remain stable unless a deliberate maintenance fix is required.

Before making changes, confirm the branch:

```bash
git branch --show-current
```

For active development, switch to the intended development or feature branch before editing:

```bash
git switch <development-branch>
```

A useful safety check before committing or deploying is:

```bash
git status
git branch --show-current
git log -1 --oneline
```

## 10. Authenticate a Salesforce org

Authenticate through the browser and assign a convenient alias:

```bash
sf org login web --alias <org-alias>
```

A browser opens. Sign into the intended Salesforce org and approve access.

List authenticated orgs:

```bash
sf org list
```

Display the target org:

```bash
sf org display --target-org <org-alias>
```

Always verify that the alias points to the intended development, scratch, sandbox, or other target org before deploying.

## 11. Deploy to Salesforce

From the Salesforce DX project root, deploy the metadata under the standard source directory:

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org <org-alias>
```

For a longer deployment, provide an explicit wait period:

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org <org-alias> \
  --wait 30
```

## 12. Validate before deploying

For a release-oriented workflow, validate first:

```bash
sf project deploy validate \
  --source-dir force-app/main/default \
  --target-org <org-alias> \
  --test-level RunLocalTests \
  --wait 30
```

Validation checks whether the metadata can be deployed without committing the deployment to the org.

After successful validation, perform the real deployment:

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org <org-alias> \
  --test-level RunLocalTests \
  --wait 30
```

## 13. Deploy only selected metadata

During development it is often faster to deploy only the component being changed.

Example Apex class:

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/MyClass.cls \
  --target-org <org-alias>
```

Example LWC bundle:

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/myComponent \
  --target-org <org-alias>
```

When components have dependencies, deploy the complete related set or the complete source tree.

## 14. Run Apex tests

Run local Apex tests:

```bash
sf apex run test \
  --target-org <org-alias> \
  --test-level RunLocalTests \
  --wait 30 \
  --code-coverage
```

Run named tests when iterating on a subsystem:

```bash
sf apex run test \
  --target-org <org-alias> \
  --tests MyClassTest \
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

A generic Linux workflow is:

```bash
# 1. Enter repository
cd <repository-directory>

# 2. Refresh remote state
git fetch origin --prune

# 3. Select the branch you are actually developing on
git switch <development-branch>

# 4. Bring the tracked branch up to date
git pull --rebase

# 5. Confirm branch and commit
git status
git branch --show-current
git log -1 --oneline

# 6. Make changes and run project tests
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

# 10. Verify the Salesforce target
sf org display --target-org <org-alias>

# 11. Validate Salesforce deployment
sf project deploy validate \
  --source-dir force-app/main/default \
  --target-org <org-alias> \
  --test-level RunLocalTests \
  --wait 30

# 12. Deploy after validation
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org <org-alias> \
  --test-level RunLocalTests \
  --wait 30
```

## 17. Moving completed development into main

Do not casually copy files between branches. Prefer Git history and the repository's normal review/merge process.

First update the development branch against the latest main:

```bash
git fetch origin --prune
git switch <development-branch>
git rebase origin/main
```

Run tests and validate the Salesforce deployment again after the rebase.

If the rebased development branch was already published and history rewriting is permitted for that branch:

```bash
git push --force-with-lease
```

Then merge through the repository's normal pull-request/review process.

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

If a branch appears to have lost a commit after a reset or rebase:

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

Updates only when the remote can be fast-forwarded cleanly. This is a conservative choice for `main` and stable/release branches.

```bash
git pull --rebase
```

Replays local development commits over the latest remote commits. Useful for development/feature branches when a linear history is desired.

```bash
git pull --no-rebase
```

Allows Git to merge divergent histories. Use when an explicit merge commit is intended.

## 20. Deployment troubleshooting

### `REQUEST_LIMIT_EXCEEDED` in a third-party deployment website

This can be a limit of the external deployment service rather than a failure in the repository or Salesforce project. Salesforce CLI avoids depending on that website and provides direct deployment diagnostics.

### Dependent class is invalid and needs recompilation

Read the deepest/root compiler error first. One invalid Apex class can cause many dependent classes and tests to be reported as invalid.

### Wrong org

Before deploying, verify:

```bash
sf org display --target-org <org-alias>
```

Never assume an alias still refers to the org you intended.

### Wrong branch

Verify:

```bash
git branch --show-current
git log -1 --oneline
```

### Deployment succeeds but Lightning still looks old

Hard-refresh the browser and, where appropriate, clear browser/session cache. Also verify that the expected metadata exists in the commit you actually deployed.

## 21. Release checklist

Before moving development into `main` or another release branch:

- Working tree is clean (`git status`).
- Development branch is updated/rebased against the intended base branch.
- Apex tests pass.
- JavaScript/Jest tests pass where applicable.
- Salesforce validation succeeds.
- Manual smoke tests pass in the intended development/sandbox org.
- No development-only metadata, secrets, tokens, or credentials are committed.
- Security/privacy documentation matches actual runtime behaviour.
- Stable/release branches have not been unintentionally modified.
- The final diff against the intended base branch has been reviewed.

Useful final comparison:

```bash
git fetch origin
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

If the target branch is not `main`, replace `origin/main` with the appropriate base branch.

## 22. Core principle

Treat GitHub and Salesforce as two separate destinations:

1. **Git** controls source history, branches, commits, merges, and collaboration.
2. **Salesforce CLI** validates and deploys a selected source state into a Salesforce org.

A deployment does not replace Git discipline, and pushing to GitHub does not deploy Salesforce metadata. Before deployment, always know **which Git branch/commit** you are on and **which Salesforce org alias** you are targeting.