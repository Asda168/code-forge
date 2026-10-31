# Code signing & first-run warnings

Unsigned installers trigger **Windows Smart App Control / SmartScreen** ("Windows protected your PC") and **macOS Gatekeeper**.
Only signing removes the warnings; the download page explains the workaround until then.
Windows signing is used automatically when the secrets below are set (and then verified strictly); without them the workflow still builds, with a warning, and the installer is UNSIGNED, so Smart App Control will block it.

## Windows (Smart App Control + SmartScreen)

**Root cause of "Smart App Control blocked an app… could not verify its publisher":** the installed `Asta.exe` has no Authenticode signature
(`Get-AuthenticodeSignature` -> `NotSigned`; the `Microsoft-Windows-CodeIntegrity/Operational` log shows events 3033/3077 for `Asta.exe`).
Smart App Control (Windows 11) only allows binaries signed by a CA in the Microsoft Trusted Root Program, or ones with good cloud reputation.
A new, unsigned app has neither, and SAC cannot be overridden per app (turning it off is permanent without reinstalling Windows, so we never ask users to).
Self-signed certificates are not trusted and must not be used.

Only a real signature fixes it. Options:
- **Azure Trusted Signing** (recommended; ~$10/mo; identity validation of an individual or organisation; certs chain to the Microsoft root and are accepted by SAC immediately).
- A standard OV/EV code-signing certificate from a public CA (DigiCert, Sectigo, SSL.com…). Since 2023 the private key must live on an HSM/token or cloud HSM, so a plain `.pfx` export is usually only available from CAs/services that still allow it. EV gives instant SmartScreen reputation; SAC accepts any validly signed, trusted publisher.
- SignPath Foundation (free for qualifying open-source projects).

### Configure the GitHub repo (nothing secret is ever committed)
Repository **variables**: `WIN_PUBLISHER_NAME` (must equal the certificate subject, e.g. your validated name; it is also written to the exe's CompanyName so the publisher is consistent), and for Azure `AZURE_SIGNING_ENDPOINT`, `AZURE_SIGNING_ACCOUNT`, `AZURE_SIGNING_PROFILE`.
Repository **secrets**: Azure -> `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (service principal with the *Trusted Signing Certificate Profile Signer* role); or PFX -> `WIN_CSC_LINK` (base64 `.pfx`), `WIN_CSC_KEY_PASSWORD`.

### What the pipeline does (`.github/workflows/release.yml`, `desktop/package.json`)
- Signs `Asta.exe`, all DLLs (`win.signDlls`), the installer and the uninstaller, SHA-256 digest (`signingHashAlgorithms`) with an RFC 3161 timestamp (`rfc3161TimeStampServer`).
- `win.signExts: ['.node']` + `signDlls` also sign native addons and the unpacked node-pty `winpty-agent.exe`/`winpty.dll` (electron-builder 25.x; v26 uses the same `signExts`). When signing is configured the workflow passes `-c.forceCodeSigning=true`, so a signing failure stops the build instead of shipping an unsigned file. Microsoft's own `conpty.dll`/`OpenConsole.exe` ship already signed; check after the first signed build that they still show Microsoft as publisher (the audit flags this).
- `desktop/scripts/audit-binaries.ps1` (read-only) writes `signature-audit.csv/.md` (publisher, status, issuer, timestamp, SHA-256, origin, expected-signed) and `SHA256-MANIFEST.txt`; `-Compare old-manifest` fails on modified/missing/extra files. CI uploads it as the `signature-audit` artifact. Unknown-origin files are reported, never auto-signed.
- **Tag (release) builds fail unless fully signed**: `verify-signatures.ps1 -Require -SigntoolStrict` (also runs `signtool verify /pa /all /v`) and the `release` job re-checks installer SHA-256s against the build job's `SHA256-INSTALLERS.txt` so nothing can change after verification. To knowingly ship unsigned, set the repo variable `ALLOW_UNSIGNED_RELEASE=true`. Manual (non-tag) runs only warn.
- Release notes (generated in the `release` job) carry install + verify instructions. Targets: NSIS installer only (x64, arm64); there is no portable build, so nothing extra to sign.
- `desktop/scripts/verify-signatures.ps1` runs before artifacts are uploaded: every exe/dll must be `Valid`, timestamped, SHA-2, chain to a trusted root and match `WIN_PUBLISHER_NAME`; `-Require` (tags) also rejects unsigned files. Run it locally: `pwsh desktop/scripts/verify-signatures.ps1 -Path desktop/dist -Publisher "<name>" -Require`.
- `test-windows` installs silently, checks the installed `Asta.exe` signature, launches, upgrades over a running app, uninstalls and prints Code Integrity block events.
- Note: GitHub-hosted runners do not enforce Smart App Control. Final acceptance must be done by hand on a Windows 11 machine with SAC **On** (Settings -> Privacy & security -> Windows Security -> App & browser control -> Smart App Control): install the signed `Asta-Setup-x64.exe`, launch, uninstall, and confirm no new 3033/3077 events for Asta binaries.
- In-app updates only check the release feed and open the download page (no silent self-update), so "update" means installing the new signed installer over the old one.

### Evidence from an affected machine (SAC enforcing, Code Integrity log)
Events 3033/3077 for `...\Programs\Asta\Asta.exe` (launched by explorer.exe), `Uninstall Asta.exe` and the installer's `old-uninstaller.exe`; all `NotSigned`.
Also unsigned in the 1.3.8 install: Electron's `ffmpeg.dll`, `libEGL.dll`, `libGLESv2.dll`, `vk_swiftshader.dll`, `vulkan-1.dll`, `resources/elevate.exe`, and node-pty's `pty.node`, `conpty.node`, `winpty*` (these would block the integrated terminal once `Asta.exe` itself passes).
No signature can be produced without a real certificate; until `WIN_PUBLISHER_NAME` + a signing secret exist, builds stay unsigned and SAC will keep blocking them.

### Manual acceptance test (needs a signed build and real Windows 11 machines; hosted runners do not enforce SAC)
| Scenario | Pass criteria |
|---|---|
| Win 11 clean VM, SAC **On**, download installer from the official site | `Get-AuthenticodeSignature` = Valid; installer runs; no Code Integrity 3033/3077 for Asta files |
| Fresh install, launch, open terminal (node-pty), uninstall | App and terminal work; uninstall leaves no `Asta.exe` |
| Upgrade over the previous (unsigned) release, running and not running | Installer replaces it; launch works; settings kept |
| SmartScreen path (SAC Off) | At most a reputation prompt; no "unknown publisher" for an OV/EV or Trusted Signing publisher |
Record results in the release PR. Not performed yet: no certificate exists, so no signed build could be tested.

## macOS (Gatekeeper)
- Needs an Apple Developer account ($99/yr) and a *Developer ID Application* certificate.
- Secrets: `MAC_CSC_LINK` (base64 `.p12`), `MAC_CSC_KEY_PASSWORD`, plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization.
- Hardened runtime entitlements live in `desktop/scripts/entitlements.mac.plist` (Electron JIT, node-pty).

## Linux
No signing is needed. Releases publish `SHA256SUMS.txt` so users can verify any download.
