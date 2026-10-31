The AstaIDE installers are currently **not code-signed**, so Windows and macOS show a warning the first time. The software is not a virus; the warning means the system does not know the publisher yet.

## Installation problems

| Symptom | Fix |
|---|---|
| Installer will not start | Re-download it from [astaide.vercel.app](/#download); a partial download will not run |
| "Access denied" while installing | Choose an install folder you own, or run the installer as an administrator |
| Linux AppImage does nothing | `chmod +x Asta.AppImage`, then run it from a terminal to see any error |
| `.deb` / `.rpm` will not install | Use your package manager so dependencies resolve: `sudo apt install ./Asta.deb` or `sudo dnf install ./Asta.rpm` |
| Wrong architecture | Windows on ARM needs the **arm64** installer; others use **x64** |

## Windows SmartScreen

**"Windows protected your PC / Microsoft Defender SmartScreen prevented an unrecognized app from starting".**

1. Click **More info** in the blue window.
2. Click **Run anyway**.

SmartScreen learns from downloads over time, and a signed build removes the warning.

## Windows Smart App Control

Windows 11 can run **Smart App Control (SAC)**. When it is **On** it blocks apps that are not signed by a trusted publisher and have no download reputation, with a message such as *"Smart App Control blocked an app that may be unsafe"*. Unlike SmartScreen there is **no "Run anyway" button**, and SAC cannot be allowed per app.

Your options:

- **Wait for a signed build.** Once releases are signed with a certificate that chains to Microsoft's trusted roots, SAC accepts them. Release notes will say when this happens.
- **Check whether SAC is on:** Settings, Privacy & security, Windows Security, App & browser control, Smart App Control.
- **Turn SAC off** (Evaluation or Off). Be aware that, on Windows, once turned off it **cannot be turned back on** without resetting or reinstalling Windows. Only do this if you accept that trade-off.
- **Use a machine or account where SAC is Off** (it is not enforced on Windows 10).

> **Important:** never disable security features for software you do not trust. If you prefer, review the source on [GitHub](https://github.com/Asda168/code-forge) and build it yourself.

## macOS Gatekeeper

If macOS says the app "cannot be opened because the developer cannot be verified", Control-click **Asta** in Applications, choose **Open**, then **Open** again. You only do this once.

## Verify your download

Each release publishes a SHA-256 manifest of its files. Compare your file's hash with it:

```powershell
Get-FileHash .\Asta-Setup-x64.exe -Algorithm SHA256
```

```bash
shasum -a 256 Asta.AppImage
```

## Expected result

AstaIDE installs and opens normally after you click through the one-time warning.

## Related

- [Download and Installation](../getting-started/install.md)
- [Extensions, Performance, Rendering and Crashes](application.md)
