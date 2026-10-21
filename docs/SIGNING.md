# Code signing & first-run warnings

Unsigned installers trigger **Windows SmartScreen** ("Windows protected your PC") and **macOS Gatekeeper**.
Only signing removes the warnings; the download page explains the workaround until then.
Signing is opt-in in `.github/workflows/release.yml`: set the secrets below and the next tagged release is signed. No secrets = unsigned build, as before.

## Windows (SmartScreen)
- Free for open source: [SignPath Foundation](https://signpath.org/) or Azure Trusted Signing (paid, ~$10/mo). A standard OV certificate also works but builds reputation slowly; EV removes the warning immediately.
- Secrets: `WIN_CSC_LINK` (base64 `.pfx` or file URL) and `WIN_CSC_KEY_PASSWORD`. The workflow then builds with `win.signAndEditExecutable=true`.
- For Azure Trusted Signing / SignPath, replace the `CSC_*` env with that service's electron-builder settings (`win.azureSignOptions`).

## macOS (Gatekeeper)
- Needs an Apple Developer account ($99/yr) and a *Developer ID Application* certificate.
- Secrets: `MAC_CSC_LINK` (base64 `.p12`), `MAC_CSC_KEY_PASSWORD`, plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarization.
- Hardened runtime entitlements live in `desktop/scripts/entitlements.mac.plist` (Electron JIT, node-pty).

## Linux
No signing is needed. Releases publish `SHA256SUMS.txt` so users can verify any download.
