AstaIDE's Source Control view is a visual front end for the `git` program on your computer. It never replaces Git: every button runs a normal Git command, and only a safe list of commands is allowed.

![The Source Control view](/shots/git.webp)

## Requirements

- Git installed and on your `PATH` ([Git Not Detected](../troubleshooting/git.md) if it is not found).
- An open folder.

## Introduction to the Git integration

Open the view with <kbd>Ctrl+Shift+G</kbd>. From top to bottom:

1. **Branch picker and Commit box**, fixed at the top: current branch, message field, **Generate**, and the main button (Commit, Sync Changes or Publish Branch).
2. **Changes**, scrollable: *Merge Changes* (conflicts), *Staged* and *Unstaged* files.
3. **Footer**, fixed at the bottom: tabs for **Branches**, **Commits** and **Remotes**, plus **Fetch**, **Pull** and **Push** buttons.

Click a footer tab to open that list in a panel above the footer; click it again to close the panel.

The activity bar badge shows the number of pending changes, and the status bar shows the branch with its ahead/behind count.

## Initialize a repository

If the folder is not a repository, the view offers **Initialize Repository** (also in the Git menu and the Command Palette). New repositories start on the branch named by the **Default branch** setting (`gitDefaultBranch`, default `main`):

```json
{ "gitDefaultBranch": "main" }
```

## Connect a GitHub repository

1. Create an empty repository on GitHub and copy its URL (HTTPS or SSH).
2. In the footer, open **Remotes** and click **+** (*Add remote…*).
3. Enter the name (usually `origin`) and the URL, then **Add**.
4. Make a commit, then press **Publish Branch** (the main button) to push and set the upstream.

Or in the terminal:

```bash
git remote add origin https://github.com/you/your-repo.git
git push -u origin main
```

> **Important:** AstaIDE runs Git with terminal prompts disabled, so it cannot ask for a password. Sign in once with Git Credential Manager (included with Git for Windows) or use SSH keys; after that push, pull and fetch work from the buttons.

## Clone a repository

Use **Git**, **Clone Repository…** from the menu (or the *Clone…* button on the empty Source Control view):

1. Enter the repository URL. HTTPS (`https://…`), `git@host:…` and `ssh://…` URLs are accepted.
2. Choose the folder to clone into (Browse).
3. AstaIDE clones and opens the new folder.

## Expected result

The view lists your changed files, the branch shows in the picker and the status bar, and the footer shows your repository state.

## Common problems

- **"This folder is not a Git repository":** click **Initialize Repository**, or open the folder that contains `.git`.
- **Push asks for credentials and fails:** configure a credential helper or SSH key, then retry ([Git Not Detected and Git Bash Setup](../troubleshooting/git.md)).

## Related

- [Stage, Commit and Generate Messages](stage-commit.md)
- [Remotes, Fetch, Pull and Push](remotes-sync.md)
