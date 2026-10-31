See what changed, when and by whom: commit history, side-by-side diffs, line blame and file history.

## View commit history

Click the **Commits** tab in the footer. Each row shows the message, the short hash, the author and a relative time ("11m ago"). Branch and tag names appear as small badges, a filled dot marks `HEAD` and a ring marks a merge commit.

- Type in the filter box to search by message, author, hash or branch name.
- The list loads 100 commits; press **Load more commits** for older history.
- Click a commit (or right-click, **Inspect details**) to see its author, date, full message and changed files. Click a file there to open its diff.

Right-click a commit for more:

| Action | What it does |
|---|---|
| Inspect details | Opens the commit with its changed files |
| Copy hash / Copy message | Copies the full hash or the message |
| Checkout commit (detached) | Moves `HEAD` to that commit (asks first) |
| Create branch from here… | Starts a new branch at that commit |
| Cherry-pick | Applies that commit onto the current branch (asks first) |
| Revert | Makes a new commit that undoes it (asks first) |

> **Note:** after *Checkout commit* you are on a detached `HEAD`. Create a branch to keep any new commits.

## View file differences

Click a changed file in Source Control to open the diff viewer:

- **Staged** files compare `HEAD` with the index; **Unstaged** files compare the index with your working copy; new files show as additions.
- Buttons: **↑ / ↓** (or <kbd>Shift+F7</kbd> / <kbd>F7</kbd>) jump between changes, **Inline** switches between side-by-side and inline, **Ignore whitespace**, and **Collapse unchanged** hides untouched regions.
- The footer buttons let you **Stage** / **Unstage**, **Discard** or **Open File** right from the diff.

## File history and blame

These come from the **GitLens** extension (enable it in the Extensions view if it is not on yet):

| Feature | Shortcut |
|---|---|
| Toggle line blame (inline author and time) | <kbd>Alt+B</kbd> |
| Toggle file blame (gutter) | <kbd>Alt+Shift+B</kbd> |
| File history | <kbd>Alt+H</kbd> |
| Line history | <kbd>Alt+Shift+H</kbd> |
| Open the GitLens view | <kbd>Alt+G</kbd> |

The lighter **Git Blame** extension shows who last changed the current line.

## Expected result

You can answer "who changed this line, and why?" without leaving the editor.

## Common problems

- **Blame shows nothing:** the file is not committed yet, or the GitLens extension is disabled.
- **The commit list looks short:** it shows 100 commits at a time; use **Load more commits**.

## Related

- [Resolve Merge Conflicts and Stash](conflicts-stash.md)
- [Extensions overview](../extensions/overview.md)
