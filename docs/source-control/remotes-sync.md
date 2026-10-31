A remote is a named copy of your repository on a server, usually called `origin`. Fetch, pull and push keep your branch and the remote in step.

## Manage Git remotes

Click the **Remotes** tab in the footer. Each remote shows its name, URL, how many remote branches it has and when it was last fetched. If your current branch tracks that remote, ↑ and ↓ show what is waiting to push or pull. Credentials embedded in a URL (`https://user:token@host/…`) are masked in the list.

| Action | How |
|---|---|
| Add a remote | **+** in the Remotes header, then name and URL |
| Fetch from one remote | The download button on its row (or press <kbd>Enter</kbd> on the row) |
| Fetch from all remotes | The download button in the Remotes header or the footer |
| Push the current branch to a remote | The up-arrow on its row (asks first) |
| Edit name or URL | Right-click, **Edit remote…** |
| Copy the URL | Right-click, **Copy URL** |
| Remove | Right-click, **Remove remote…** (asks first; only your local copy changes) |

## Fetch, pull and push

The footer always has three buttons:

| Button | Runs | Notes |
|---|---|---|
| **Fetch** | `git fetch --all` | Downloads new commits without changing your files |
| **Pull** | `git pull` | Fetch and merge into your branch; a badge shows how many commits you are behind |
| **Push** | `git push` | A badge shows how many commits you are ahead |

The main button in the commit area becomes **Sync Changes** after you commit: it pulls, then pushes, in one click.

### Pushing a new branch

If the branch has no upstream yet, AstaIDE offers to publish it to `origin` (`git push -u origin <branch>`). If the server rejects a push because it has newer commits, AstaIDE offers **Pull & push**.

### Keeping status fresh

AstaIDE refreshes when you return to the window and, for branches that have an upstream, fetches in the background every 3 minutes, so ahead/behind stays current. The footer and Remotes rows show when the last fetch, pull or push succeeded in this session.

## Expected result

Pushing makes your commits visible on the remote; the ↑ badge disappears and the Remotes row shows "fetched just now".

## Common problems

- **Authentication failed:** AstaIDE cannot prompt for passwords. Use Git Credential Manager or SSH keys, then retry ([Git Not Detected and Git Bash Setup](../troubleshooting/git.md)).
- **"Remote already exists":** pick another name or edit the existing remote.
- **Push rejected:** pull first, resolve any conflicts, then push.

## Related

- [Create, Switch, Rename and Delete Branches](branches.md)
- [Resolve Merge Conflicts and Stash](conflicts-stash.md)
