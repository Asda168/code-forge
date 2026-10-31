A project in AstaIDE is simply a folder. You can open one from the File menu, from your recent list, or as a saved workspace.

## Requirements

- A folder on your computer. AstaIDE refuses protected system folders, drive roots and your home folder itself.

## Open a folder

1. Press <kbd>Ctrl+O</kbd> (or **File**, **Open Folder**).
2. Pick the folder and confirm.

The Explorer shows the folder tree and the status bar shows the Git branch if the folder is a repository.

> **Security:** AstaIDE can only read and write inside folders you have opened. This is how it keeps every file operation, Git command and terminal action inside your project.

## Other ways to open

| Goal | How |
|---|---|
| A recent project | **File**, **Open Recent** |
| Search all recent projects | <kbd>Ctrl+R</kbd> (Find Project) |
| Open in a separate window | **File**, **Open Folder in New Window** or <kbd>Ctrl+Shift+N</kbd> for an empty new window |
| Open a single file | <kbd>Ctrl+Alt+O</kbd> |
| Close the project | **File**, **Close Folder** |
| Save the open folders as a named workspace | Palette: *Save Workspace*; reopen with *Open Workspace* |

## Clone a repository instead

If the code is on GitHub, use **Git**, **Clone Repository…** and AstaIDE opens the clone when it finishes. See [Clone a repository](../source-control/overview.md#clone-a-repository).

## Expected result

The Explorer lists your files. Run or terminal actions now start in that folder.

## Common problems

- **"Path is outside the open workspace":** the action targeted a folder you have not opened. Open that folder first.
- **The folder is rejected:** choose a project subfolder rather than a drive root or your home folder.

## Related

- [File Explorer](../ide-fundamentals/explorer.md)
- [Create Your First Project](create-project.md)
