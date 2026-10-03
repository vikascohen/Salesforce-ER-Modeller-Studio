# Git and Salesforce CLI Development & Deployment Guide

This guide documents a practical, branch-agnostic workflow for working with a Salesforce DX project using Git and Salesforce CLI on **Linux, Windows, and macOS**.

It covers cloning a repository, switching branches, pulling and pushing changes, rebasing safely, resolving conflicts, authenticating Salesforce orgs, validating deployments, deploying metadata, running tests, and recovering from common Git mistakes.

> **Cross-platform note:** Git, Salesforce CLI (`sf`), Node.js, and npm commands are fundamentally the same across Linux, Windows, and macOS. To keep examples portable, commands are shown as single-line commands where practical. Shell-specific path syntax and multiline continuation characters can differ between Bash/Zsh, PowerShell, and Windows Command Prompt.

> **Placeholders:** Replace values such as `<development-branch>`, `<feature-branch>`, `<org-alias>`, `<repository-url>`, and `<repository-directory>` with values appropriate to your environment.

> **Git safety:** Commands that rewrite history, especially `rebase` and `push --force-with-lease`, should be used deliberately. Never rewrite a shared stable or release branch unless that is explicitly intended.

## 1. Prerequisites

Install Git, Node.js/npm, and Salesforce CLI (`sf`). Verify them from your terminal or shell:

```text
git --version
node --version
npm --version
sf --version
```

Configure Git identity if required:

```text
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. Clone a repository

```text
git clone <repository-url>
cd <repository-directory>
```

Inspect the repository:

```text
git status
git branch -a
git remote -v
```

`origin` is normally the remote repository from which the project was cloned.

## 3. Refresh remote branch information

Before switching branches, comparing remote work, or rebasing, refresh the remote state:

```text
git fetch origin --prune
```

`fetch` downloads remote branch and commit information without changing your current working branch. `--prune` removes stale remote-tracking references for branches that no longer exist remotely.

## 4. Switch and create branches

Show the current branch:

```text
git branch --show-current
```

Show local branches:

```text
git branch
```

Show local and remote branches:

```text
git branch -a
```

Switch to an existing local branch:

```text
git switch <development-branch>
```

Older Git installations can use:

```text
git checkout <development-branch>
```

Create a local branch that tracks an existing remote branch:

```text
git switch --track origin/<development-branch>
```

Create a new feature/development branch from your current branch:

```text
git switch -c <feature-branch>
```

Publish a new branch and configure its upstream:

```text
git push -u origin <feature-branch>
```

After switching or creating a branch, verify where you are:

```text
git status
git branch --show-current
git log -1 --oneline
```

## 5. Pull the latest changes

For a normal update of the currently tracked branch:

```text
git pull
```

For development branches where a linear history is preferred:

```text
git pull --rebase
```

Or explicitly:

```text
git fetch origin
git rebase origin/<development-branch>
```

Before pulling or rebasing, check for uncommitted changes:

```text
git status
```

Commit or deliberately stash unfinished work before performing history-sensitive operations.

## 6. Make, review, and commit changes

Inspect changes:

```text
git status
git diff
```

Stage one file:

```text
git add path/to/file
```

Stage all intended changes:

```text
git add .
```

Review exactly what is staged:

```text
git diff --cached
```

Commit:

```text
git commit -m "Describe the change clearly"
```

Inspect recent history:

```text
git log --oneline --decorate -10
```

Push an already tracked branch:

```text
git push
```

## 7. Rebase a development branch onto its base branch

A common workflow is to update a development branch with the latest `main` before merging it.

```text
git fetch origin --prune
git switch <development-branch>
git rebase origin/main
```

Conceptually, Git temporarily removes the commits unique to your development branch, moves its base to the latest `origin/main`, and then reapplies your commits in order.

If your repository uses a different integration/base branch, replace `main` with that branch.

### Resolve a rebase conflict

Check the conflicted files:

```text
git status
```

Open each conflicted file and resolve markers similar to:

```text
<<<<<<< HEAD
current base content
=======
your branch content
>>>>>>> commit
```

After resolving each file:

```text
git add path/to/resolved-file
git rebase --continue
```

Repeat until the rebase completes.

To abandon the rebase and return to the pre-rebase state:

```text
git rebase --abort
```

### Push after rebasing

Rebasing changes commit IDs. If the branch had already been pushed and rewriting that development branch is acceptable:

```text
git push --force-with-lease
```

Prefer `--force-with-lease` over `--force`. It provides protection against overwriting remote work that you have not fetched.

Do not force-push shared stable, release, or integration branches as part of ordinary development.

## 8. Keep stable and release branches isolated

Before editing, committing, or deploying, verify the active branch:

```text
git branch --show-current
git status
git log -1 --oneline
```

Do active work on the intended development or feature branch rather than directly modifying a stable/release branch unless that workflow is explicitly required.

## 9. Authenticate a Salesforce org

Authenticate using a browser and assign the org a convenient alias:

```text
sf org login web --alias <org-alias>
```

A browser opens. Sign in to the intended Salesforce org and approve access.

List authenticated orgs:

```text
sf org list
```

Display and verify the target org:

```text
sf org display --target-org <org-alias>
```

Always verify the target before deployment. An alias may refer to a Developer Edition, sandbox, scratch org, or another authorised Salesforce environment.

## 10. Deploy to Salesforce

From the Salesforce DX project root, deploy the standard source directory:

```text
sf project deploy start --source-dir force-app/main/default --target-org <org-alias>
```

Wait for a longer deployment:

```text
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --wait 30
```

`force-app/main/default` is a Salesforce DX source path. The word `main` in this path is unrelated to the Git branch named `main`.

## 11. Validate before deploying

For release-oriented changes, validation is useful before committing metadata to the target org:

```text
sf project deploy validate --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
```

After successful validation, perform the deployment:

```text
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
```

Validation checks deployment viability without applying the metadata as the final deployment.

## 12. Deploy selected metadata during development

Deploying only changed components can shorten the development feedback loop.

Example Apex class:

```text
sf project deploy start --source-dir force-app/main/default/classes/MyClass.cls --target-org <org-alias>
```

Example LWC bundle:

```text
sf project deploy start --source-dir force-app/main/default/lwc/myComponent --target-org <org-alias>
```

If a component depends on other changed metadata, deploy the complete related set or the complete source tree.

## 13. Run Apex tests

Run local Apex tests:

```text
sf apex run test --target-org <org-alias> --test-level RunLocalTests --wait 30 --code-coverage
```

Run a particular test class while iterating:

```text
sf apex run test --target-org <org-alias> --tests MyClassTest --wait 30 --code-coverage
```

## 14. Run JavaScript/Jest tests

Install project dependencies when required:

```text
npm install
```

Run the project's configured tests, commonly:

```text
npm test
```

Use the scripts defined by the project's `package.json` where available.

## 15. Recommended development workflow

The following sequence works across Linux, Windows, and macOS terminals because it avoids shell-specific multiline syntax:

```text
cd <repository-directory>
git fetch origin --prune
git switch <development-branch>
git pull --rebase
git status
git branch --show-current
git log -1 --oneline
npm test
git diff
git status
git add .
git diff --cached
git commit -m "Describe the change"
git push
sf org display --target-org <org-alias>
sf project deploy validate --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
sf project deploy start --source-dir force-app/main/default --target-org <org-alias> --test-level RunLocalTests --wait 30
```

The exact test/deployment sequence can be adjusted to match the repository's CI/CD and release process.

## 16. Move completed development into the integration branch

Do not manually copy files between branches when Git can preserve the history.

If `main` is the integration branch:

```text
git fetch origin --prune
git switch <development-branch>
git rebase origin/main
```

Run tests and validate the Salesforce deployment again after rebasing.

If the rebased development branch was already published and rewriting it is permitted:

```text
git push --force-with-lease
```

Merge using the repository's normal pull-request/review process.

After the merge, refresh local `main`:

```text
git switch main
git pull --ff-only origin main
```

`--ff-only` prevents Git from unexpectedly creating a local merge commit while updating the integration branch.

If the repository uses a different integration branch, substitute that branch for `main`.

## 17. Useful recovery commands

### Discard unstaged changes to one file

```text
git restore path/to/file
```

### Unstage a file while keeping its edits

```text
git restore --staged path/to/file
```

### Temporarily store uncommitted work

```text
git stash push -m "temporary work"
```

Restore it later:

```text
git stash pop
```

### Inspect the reflog

If a commit appears lost after a reset or rebase:

```text
git reflog
```

The reflog can often identify the previous commit so it can be recovered.

### Abort a merge

```text
git merge --abort
```

### Abort a rebase

```text
git rebase --abort
```

## 18. Git pull strategies

### Fast-forward only

```text
git pull --ff-only
```

Updates only when Git can fast-forward cleanly. This is a conservative choice for integration, stable, and release branches.

### Rebase

```text
git pull --rebase
```

Replays local commits over the latest remote commits. This is often useful on development and feature branches when a linear history is preferred.

### Merge

```text
git pull --no-rebase
```

Allows Git to merge divergent histories. Use when an explicit merge commit is intended.

## 19. Cross-platform shell notes

Most commands in this guide are identical on all three major desktop platforms.

### Linux and macOS

Bash/Zsh commonly use `/` in paths and `\` as a multiline continuation character.

### Windows PowerShell

PowerShell accepts the Git, npm, and `sf` commands used in this guide. Windows paths may use `\`, although many command-line tools also accept `/`. PowerShell uses the backtick character for multiline continuation.

### Windows Command Prompt

Git and Salesforce CLI commands still work, but Command Prompt uses `^` for multiline continuation. The guide therefore favours single-line commands so examples can be copied between shells with minimal modification.

## 20. Deployment troubleshooting

### Third-party deployment service reports `REQUEST_LIMIT_EXCEEDED`

A third-party deployment website can exhaust its own request quota. This does not by itself prove that the Salesforce metadata or repository is faulty. Deploying directly with Salesforce CLI removes that external deployment service from the path and provides direct diagnostics.

### Dependent Apex class is invalid and needs recompilation

Read the deepest/root compiler error first. One invalid Apex class can cause many dependent classes and tests to be reported as invalid.

### Wrong Salesforce org

Verify the target before deployment:

```text
sf org display --target-org <org-alias>
```

### Wrong Git branch

Verify both branch and commit:

```text
git branch --show-current
git log -1 --oneline
```

### Deployment succeeds but Lightning still looks old

Hard-refresh the browser where appropriate and verify that the expected metadata exists in the Git commit that was actually deployed.

## 21. Release checklist

Before moving development into an integration or release branch:

- The working tree is clean (`git status`).
- The development branch is updated against the intended base branch.
- Apex tests pass.
- JavaScript/Jest tests pass where applicable.
- Salesforce deployment validation succeeds.
- Manual smoke tests pass in the intended development/sandbox org.
- No secrets, tokens, credentials, or development-only configuration have been committed.
- Security/privacy documentation matches actual runtime behaviour.
- Stable/release branches have not been unintentionally modified.
- The final diff against the intended base branch has been reviewed.

For a repository using `main` as its integration branch:

```text
git fetch origin
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Substitute the appropriate base branch if the repository does not use `main`.

## 22. Core principle

Treat source control and Salesforce deployment as separate concerns:

1. **Git** controls source history, branches, commits, merges, and collaboration.
2. **Salesforce CLI** validates and deploys a selected source state into a Salesforce org.

Pushing to GitHub does not deploy Salesforce metadata, and deploying metadata does not replace Git source control. Before deployment, always know **which Git branch and commit** you are using and **which Salesforce org alias** you are targeting.