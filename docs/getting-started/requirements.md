AstaIDE runs on Windows, macOS and Linux. The IDE itself needs nothing else, but some features use tools that must already be installed on your computer.

## Supported platforms

| Platform | Package | Notes |
|---|---|---|
| Windows (x64) | `Asta-Setup-x64.exe` | Installer wizard |
| Windows (ARM64) | `Asta-Setup-arm64.exe` | Installer wizard |
| macOS | `Asta-macOS-universal.dmg` | One build for Intel and Apple silicon |
| Linux (x64) | `Asta.AppImage`, `Asta.deb`, `Asta.rpm`, `Asta.pacman` | Pick the format for your distribution |

AstaIDE is built on Electron 33, so it needs a desktop operating system version that Electron 33 supports (Windows 10 or later, a current macOS release, or a mainstream 64-bit Linux desktop).

## Tools AstaIDE uses

| Tool | Needed for | Required? |
|---|---|---|
| **Git** | Source Control, Git Bash terminal | Yes, for anything Git-related |
| **Git for Windows** | The *Git Bash* terminal profile (Windows) | Only if you want Git Bash |
| **PHP** and **Composer** | Laravel and PHP projects | Only for those projects |
| **Python 3** | Python and Django projects | Only for those projects |
| **Node.js** and npm | Node, React and Vue projects | Only for those projects |

AstaIDE does not bundle these tools. If one is missing you will see an error such as "command not found" in the terminal; see [PHP, Python and Node.js Not Found](../troubleshooting/runtimes.md).

## Expected result

You can run `git --version` in any terminal and get a version number. Do the same for `php -v`, `python --version` or `node -v` for the stacks you use.

## Common problems

- **Git is installed but AstaIDE says it cannot find it:** see [Git Not Detected](../troubleshooting/git.md).
- **The terminal looks limited (no colours or full-screen apps):** the optional `node-pty` component is missing; see [Troubleshoot Terminal Issues](../terminal/troubleshooting.md).

## Related

- [Download and Installation](install.md)
