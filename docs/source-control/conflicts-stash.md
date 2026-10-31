A merge conflict happens when Git cannot combine two sets of changes automatically. AstaIDE highlights the conflicts and lets you choose a side with one click. Stash parks unfinished work so you can switch tasks.

## Resolve merge conflicts

When a merge, pull or rebase leaves conflicts:

- A banner in Source Control says **"N merge conflicts"** with a **Resolve** button that opens the first conflicted file.
- Conflicted files appear in their own **Merge Changes** group. The commit button is disabled until they are resolved.

### Inline in the editor

Each conflict block shows actions above it:

| Action | Result |
|---|---|
| **Accept Current Change** | Keep your branch's version |
| **Accept Incoming Change** | Keep the other branch's version |
| **Accept Both Changes** | Keep both, one after the other |
| **Compare Changes** | Open a side-by-side comparison |

An **Accept All** bar appears at the top of the file for resolving every conflict the same way.

### Whole file at once

In the Merge Changes group, for a file modified on both sides, use **Accept Current Version** or **Accept Incoming Version** (hover the file, or right-click). Use **Mark as Resolved** after you edit by hand.

### Finish

1. Resolve every conflict and stage the files (**Mark as Resolved** stages them).
2. Commit.

To give up, open the arrow next to the main button and choose **Abort merge**.

## Stash work in progress

Open the **More actions** (`...`) menu at the top of the Source Control view:

- **Stash changes** runs `git stash push -u`: it saves tracked changes **and untracked files** and gives you a clean working tree.
- **Pop stash** runs `git stash pop`: it re-applies the newest stash and removes it from the stash list.

For anything else (listing, applying a specific stash, dropping), use the terminal:

```bash
git stash list
git stash apply stash@{1}
git stash drop stash@{1}
```

## Expected result

The Merge Changes group empties, the banner disappears and **Commit** becomes available.

## Common problems

- **Pop stash reports a conflict:** resolve it as above; the stash stays in the list until the pop succeeds.
- **Conflict markers (`<<<<<<<`) are still in the file:** a conflict was edited by hand. Remove the markers, then **Mark as Resolved**.

## Related

- [Stage, Commit and Generate Messages](stage-commit.md)
- [Commit History, Diffs, Blame and File History](history-diff.md)
