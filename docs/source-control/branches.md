Branches are managed in two places: the **branch picker** at the top of the Source Control view, and the **Branches** panel opened from the footer.

## Requirements

- A repository with at least one commit.

## Create and switch branches

**From the branch picker:** click the branch name, then choose another branch to switch, or **＋ Create new branch…**.

**From the footer:** click the **Branches** tab. Local and remote-tracking branches are listed in separate groups, the current branch is pinned first with a **current** badge, and the filter box narrows the list as you type.

- Click a **local** branch (or the check button on its row) to check it out.
- Click a **remote** branch (for example `origin/feature/login`) to check it out as a **tracking** branch. If a local branch of the same name already exists, that one is used.
- Create from any branch: right-click it, **Create branch from here…**.

Branch names may contain letters, digits, `.`, `_`, `-` and `/` (for example `feature/login`). They cannot start with `-`, contain `..` or end with `/` or `.lock`.

> **Note:** switching branches with uncommitted changes can fail if the changes conflict with the target branch. Commit or [stash](conflicts-stash.md#stash-work-in-progress) first.

## Rename a branch

Branch picker, **Rename current branch…**, or right-click a local branch, **Rename…**. This renames the local branch only; it does not rename it on the remote.

## Delete a branch

Right-click a branch, **Delete branch** (local) and confirm. If Git says the branch is not fully merged, AstaIDE asks a second time before using a force delete, because those commits could be lost. You cannot delete the branch you are on.

To delete a branch on the server, right-click the remote branch, **Delete remote branch…**. This removes it for everyone, so AstaIDE asks you to confirm.

## Merge and rebase

Right-click another branch:

- **Merge into `<current>`** merges that branch into the one you are on (asks first).
- **Rebase `<current>` onto this** rewrites the current branch's commits on top of the other (asks first; avoid on shared branches).

## Branch status

Rows show **↑n** (commits to push), **↓n** (commits to pull) and **gone** when the upstream branch no longer exists on the remote.

## Expected result

The status bar and branch picker show the new branch name immediately.

## Common problems

- **"Invalid branch name":** check the naming rules above.
- **Checkout fails because of local changes:** commit or stash them.

## Related

- [Stage, Commit and Generate Messages](stage-commit.md)
- [Remotes, Fetch, Pull and Push](remotes-sync.md)
