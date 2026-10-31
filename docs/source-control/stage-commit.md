Stage the changes you want, write a message and commit. AstaIDE can also draft the message for you, locally.

## Stage and unstage files

Changed files are listed under **Unstaged** (including new, untracked files marked **U**) and **Staged**. Badges show the kind of change: **M** modified, **A** added, **D** deleted, **R** renamed, **U** untracked.

| Action | How |
|---|---|
| Stage one file | Hover the file and click **+**, or right-click, **Stage Changes** |
| Stage everything | **+** next to *Unstaged*, or the *Stage all changes* button in the Changes toolbar |
| Unstage a file | **−** on the file, or right-click, **Unstage Changes** |
| Unstage everything | **−** next to *Staged* |
| Discard changes | The undo button on the file, or right-click, **Discard Changes** (asks first; this cannot be undone, and untracked files are deleted) |
| See the diff | Click the file ([Commit History, Diffs, Blame and File History](history-diff.md)) |

Right-click a file for more: **Open File**, **Copy Path**, **Copy Relative Path**, **Reveal in Explorer** and **Reveal in File Manager**.

## Write commit messages

Type a message in the box. The first line is the summary; add more lines for details. Press <kbd>Ctrl+Enter</kbd> to commit.

If nothing is staged when you commit, AstaIDE asks whether to **Stage all & commit**.

## Generate commit messages

Click **Generate** inside the message box (or the sparkle button in the Changes toolbar). AstaIDE builds a [conventional-commit](https://www.conventionalcommits.org/) style message from your file list, locally. Nothing is sent anywhere.

| Your changes | Example result |
|---|---|
| Only `.md` files | `docs: Update README.md` |
| Only tests | `test: Update login.test.js` |
| Only styles | `style: Update app.css` |
| Only config files such as `package.json` | `chore: Update package.json` |
| Only new files | `feat: Add login.js, auth.js` |
| Mixed | `Update a.js, b.js, c.js and 4 more files` |

Edit the result before committing; it is a starting point.

## The main button

| State | Button | What it does |
|---|---|---|
| Changes to commit | **Commit** (with the number staged) | `git commit` |
| Clean, ahead or behind | **Sync Changes** (↑ahead ↓behind) | `git pull`, then `git push` |
| New branch with a remote, nothing to commit | **Publish Branch** | `git push -u origin <branch>` |
| Merge conflicts | disabled | Resolve the conflicts first |

The **arrow next to the button** offers **Commit**, **Commit & Push** and **Commit (Amend)**. Amend replaces the last commit with your staged changes and message; AstaIDE warns you not to amend commits you already pushed.

## Expected result

The files leave the Staged list, the badge count drops and the commit appears in the **Commits** panel.

## Common problems

- **"Enter a commit message":** the box is empty.
- **"Resolve N conflicted files first":** see [Resolve Merge Conflicts](conflicts-stash.md).
- **Git says "Please tell me who you are":** set your identity once in a terminal: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.

## Related

- [Create, Switch, Rename and Delete Branches](branches.md)
- [Remotes, Fetch, Pull and Push](remotes-sync.md)
