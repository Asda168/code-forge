The integrated terminal opens in your project folder and uses a real shell. On Windows you can choose between PowerShell, CMD and Git Bash.

## Open the integrated terminal

- Press <kbd>Ctrl+`</kbd> to show or hide the terminal panel.
- <kbd>Ctrl+Shift+`</kbd> opens a **new** terminal.
- Right-click a folder in the Explorer, then **Open in Terminal** (or **Open in Git Bash**) to start in that folder.

## Select PowerShell, CMD or Git Bash

Click the **arrow next to the + button** in the panel's title bar ("Select terminal profile") and pick a shell. It opens a new terminal using that profile.

| Platform | Shells AstaIDE detects |
|---|---|
| Windows | **Git Bash** (needs Git for Windows), **PowerShell** (Windows PowerShell), **CMD** |
| macOS | `zsh`, `bash` |
| Linux | `bash`, `zsh` |

Unix shells start as login shells (`-l`); Git Bash starts with `--login -i`.

## Change the default terminal

Open Settings, **Terminal**, then **Shell**, and set *Default shell*, or edit `settings.json`:

```json
{ "defaultShell": "powershell" }
```

| Value | Meaning |
|---|---|
| `""` (empty, default) | Auto: the platform default |
| `"gitbash"`, `"powershell"`, `"cmd"` | Windows profiles |
| `"zsh"`, `"bash"` | macOS and Linux |

New terminals use this shell unless you pick another from the profile menu. To restore the default, set the value back to `""`.

## Custom shell locations

If AstaIDE cannot find a shell, tell it where the program is:

```json
{
  "gitBashPath": "C:\\Program Files\\Git\\bin\\bash.exe",
  "powershellPath": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
  "cmdPath": "C:\\Windows\\System32\\cmd.exe"
}
```

Remember to double every backslash in JSON. Leave a value empty (`""`) to use auto-detection.

## Expected result

A terminal tab appears at the bottom with a prompt in your project folder, for example `PS C:\Projects\my-app>`.

## Common problems

- **Git Bash is missing from the list:** install [Git for Windows](https://git-scm.com/download/win) or set `gitBashPath` ([Git Bash setup](../troubleshooting/git.md#git-bash-configuration)).
- **The terminal does not open:** see [Troubleshoot Terminal Issues](troubleshooting.md).

## Related

- [Multiple Terminals, Split and Resize](panes.md)
- [Settings Reference](../settings/reference.md)
