# Code signing & first-run warnings

Unsigned installers trigger **Windows Smart App Control / SmartScreen** ("Windows protected your PC") and **macOS Gatekeeper**.
Only signing removes the warnings; the download page explains the workaround until then.
Windows signing is mandatory for tagged releases in `.github/workflows/release.yml` (the build fails without it); manual runs may be unsigned.

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
- Tag builds **fail** if no signing is configured; manual runs may build unsigned for testing (with a warning).
- `desktop/scripts/verify-signatures.ps1` runs before artifacts are uploaded: every exe/dll must be `Valid`, timestamped, SHA-2, chain to a trusted root and match `WIN_PUBLISHER_NAME`; `-Require` (tags) also rejects unsigned files. Run it locally: `pwsh desktop/scripts/verify-signatures.ps1 -Path desktop/dist -Publisher "<name>" -Require`.
- `test-windows` installs silently, checks the installed `Asta.exe` signature, launches, upgrades over a running app, uninstalls and prints Code Integrity block events.
- Note: GitHub-hosted runners do not enforce Smart App Control. Final acceptance must be done by hand on a Windows 11 machine with SAC **On** (Settings -> Privacy & security -> Windows Security -> App & browser control -> Smart App Control): install the signed `Asta-Setup-x64.exe`, launch, uninstall, and confirm no new 3033/3077 events for Asta binaries.
- In-app updates only check the release feed and open the download page (no silent self-update), so "update" means installing the new signed installer over the old one.

## macOS (Gatekeeper)
- Needs an Apple Developer account ($99/yr) and a *Developer ID Application* certificate.
- Secrets: `MAC_CSC_LINK` (base64 `.p12`), `MAC_CSC_KEY_PASSWORD`, plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization.
- Hardened runtime entitlements live in `desktop/scripts/entitlements.mac.plist` (Electron JIT, node-pty).

## Linux
No signing is needed. Releases publish `SHA256SUMS.txt` so users can verify any download.
