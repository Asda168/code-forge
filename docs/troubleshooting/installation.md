Windows and macOS warn about, or block, apps whose publisher they cannot verify. Releases are published with a SHA-256 checksum file and, once signed, a verifiable digital signature (see below). Check the release notes to see whether your version is signed.

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

SmartScreen learns from downloads over time, and a signed build removes the warning. Only click **Run anyway** for a file you downloaded from the official page and whose checksum or signature you have verified.

## Windows Smart App Control

Windows 11 can run **Smart App Control (SAC)**. When it is **On** it only runs apps that are signed by a publisher whose certificate chains to Microsoft's trusted roots, or that Microsoft's cloud already knows to be safe. Unsigned or untrusted apps are blocked with *"Smart App Control blocked an app that may be unsafe"*. Unlike SmartScreen there is **no "Run anyway" button**, and SAC cannot be allowed per app. This is Windows working as designed, not a sign that the file is malicious.

What to do:

1. **Download only the official installer** from [astaide.vercel.app](/#download) or the [GitHub Releases](https://github.com/Asda168/code-forge/releases) page. Never use a mirror or a link from a message.
2. **Check the release is signed** (see below). Signed releases from a trusted publisher are accepted by SAC; the release notes state when a version is signed.
3. **If a build is unsigned, do not work around Windows.** Wait for a signed release, use a PC where SAC is already Off or in Evaluation by your own choice, or build from [source](https://github.com/Asda168/code-forge) yourself.
4. Report it with the details below so we can fix it.

> We never recommend turning off Smart App Control, Microsoft Defender or any antivirus. SAC cannot be turned back on without resetting Windows; only your IT administrator or you, knowingly and for software you trust, should change it.

**Collecting details for a bug report.** In PowerShell:

```powershell
Get-AuthenticodeSignature "$env:LOCALAPPDATA\Programs\Asta\Asta.exe" | Format-List Status, StatusMessage, SignerCertificate
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-CodeIntegrity/Operational'; Id=3033,3077} -MaxEvents 10 | Format-List TimeCreated, Message
```

## Verify the publisher and signature

Right-click `Asta-Setup-x64.exe`, choose **Properties**, then the **Digital Signatures** tab: select the signature, **Details**, and confirm *"This digital signature is OK"* and that the signer is the publisher named on the website and in the release notes. Or in PowerShell:

```powershell
Get-AuthenticodeSignature .\Asta-Setup-x64.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
```

`Status` must be `Valid`. `NotSigned`, `HashMismatch` or `NotTrusted` means do not run it: re-download from the official page.

## macOS Gatekeeper

If macOS says the app "cannot be opened because the developer cannot be verified", Control-click **Asta** in Applications, choose **Open**, then **Open** again. You only do this once.

## Verify your download

Each release publishes `SHA256SUMS.txt`. Compare your file's hash with it:

```powershell
Get-FileHash .\Asta-Setup-x64.exe -Algorithm SHA256
```

```bash
shasum -a 256 Asta.AppImage
```

## Expected result

The installer's signature shows `Valid`, its hash matches `SHA256SUMS.txt`, and AstaIDE installs and opens normally.

## Related

- [Download and Installation](../getting-started/install.md)
- [Extensions, Performance, Rendering and Crashes](application.md)
