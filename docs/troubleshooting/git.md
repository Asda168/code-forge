Source Control and Git Bash both need the `git` program. AstaIDE finds it automatically in most cases.

## Git not detected

Symptoms: Source Control shows errors such as "git failed", or nothing happens when you click buttons.

1. Open the terminal and run:

```bash
git --version
```

2. If that prints a version, but AstaIDE still fails, tell AstaIDE the exact path:

```json
{ "gitPath": "C:\\Program Files\\Git\\cmd\\git.exe" }
```

3. If it prints "not found", install Git ([git-scm.com](https://git-scm.com/downloads)), then **restart AstaIDE** so it picks up the updated `PATH`.

To use the system Git again, set `"gitPath": ""`.

### Find your Git path

```powershell
where.exe git          # Windows
```

```bash
which git              # macOS and Linux
```

## Git Bash configuration

AstaIDE looks for Git Bash (`bash.exe`) in the usual places: `Program Files\Git`, your local `Programs` folder, `C:\Git`, Scoop's `git` app, and next to the `git.exe` it finds on your `PATH`. If it is somewhere else:

```json
{
  "gitBashPath": "D:\\Tools\\Git\\bin\\bash.exe",
  "defaultShell": "gitbash"
}
```

Restart the terminal panel afterwards. The path must point at `bash.exe` (not `git-bash.exe`) inside Git's `bin` folder.

## Authentication problems

AstaIDE runs Git with terminal prompts turned off, so it cannot ask for a username or password. If push, pull or fetch fails with "Authentication failed" or "could not read Username":

- **HTTPS:** sign in once through Git Credential Manager (installed with Git for Windows); run `git fetch` in the terminal and complete the browser sign-in, or use a personal access token as the password when the credential helper asks.
- **SSH:** create a key (`ssh-keygen -t ed25519`), add the public key to GitHub, and use a `git@github.com:user/repo.git` URL for the remote.

## Identity is missing

If a commit fails with "Please tell me who you are":

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Expected result

Source Control lists your changes and the branch name appears in the picker and status bar.

## Related

- [Git Integration, Init, Connect and Clone](../source-control/overview.md)
- [Open the Terminal and Choose a Shell](../terminal/shells.md)
