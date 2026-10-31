AstaIDE does not install PHP, Python or Node.js. Run and Debug and the terminal use the copies on your computer. "Command not found" nearly always means the tool is not installed or its folder is not on your `PATH`.

## First check

In the AstaIDE terminal:

```bash
php -v
python --version
node -v
```

(Use `python3` on macOS and Linux if `python` is not found.)

## PHP Not Found

Install PHP (and Composer for Laravel):

| System | How |
|---|---|
| Windows | Download PHP from [windows.php.net](https://windows.php.net/download/), unzip it (for example to `C:\php`), or install a bundle such as Laragon or XAMPP. Install [Composer](https://getcomposer.org/download/). |
| macOS | `brew install php composer` |
| Ubuntu / Debian | `sudo apt install php-cli php-mbstring php-xml php-curl unzip composer` |

Windows: add the PHP folder to `PATH` (Settings, System, About, Advanced system settings, Environment Variables, Path, New). **Close and reopen AstaIDE.**

## Python Not Found

| System | How |
|---|---|
| Windows | Install from [python.org](https://www.python.org/downloads/) and tick **Add python.exe to PATH** in the installer |
| macOS | `brew install python` (command: `python3`) |
| Ubuntu / Debian | `sudo apt install python3 python3-venv python3-pip` |

On Windows, if typing `python` opens the Microsoft Store, turn off the *App execution aliases* for `python.exe` in Settings, Apps, Advanced app settings, App execution aliases.

## Node.js Not Found

| System | How |
|---|---|
| Windows, macOS | Installer from [nodejs.org](https://nodejs.org/) (adds itself to `PATH`) |
| macOS | `brew install node` |
| Ubuntu / Debian | `sudo apt install nodejs npm`, or use [nvm](https://github.com/nvm-sh/nvm) for newer versions |

## Why restart AstaIDE

A program started before you changed `PATH` keeps the old value. Close every AstaIDE window and open it again.

## It works in one terminal but not another

Different shells can load different `PATH`s. If `php` works in PowerShell but not Git Bash, switch the profile ([Open the Terminal and Choose a Shell](../terminal/shells.md)) or add the path to the shell's own start-up file (`~/.bashrc` for Git Bash).

## Expected result

`php -v`, `python --version` or `node -v` prints a version, and Run and Debug can start your project.

## Related

- [Understanding Run and Debug](../run-debug/overview.md)
- [Troubleshoot Terminal Issues](../terminal/troubleshooting.md)
