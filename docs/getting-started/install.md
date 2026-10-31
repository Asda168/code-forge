Download the installer for your system from the AstaIDE website, run it, and start the app. Updates are installed the same way: download the newer installer and run it over the old one.

## Requirements

- A supported OS ([System Requirements](requirements.md)).
- Permission to install software (or use the AppImage on Linux, which needs no install).

## Download

Open [astaide.vercel.app](/#download). The page detects your system and shows the right button; the version picker lets you choose an older release.

## Windows

1. Run `Asta-Setup-x64.exe` (or `Asta-Setup-arm64.exe` on ARM PCs).
2. If Windows shows **"Windows protected your PC"**, click **More info**, then **Run anyway**. The installer is safe; the warning appears because it is not yet code-signed. Details: [SmartScreen and Smart App Control](../troubleshooting/installation.md).
3. Choose the install folder (the wizard lets you change it) and finish. AstaIDE creates a desktop shortcut and a Start menu entry, and can start immediately after install.

## macOS

1. Open `Asta-macOS-universal.dmg`.
2. Drag **Asta** into **Applications**.
3. On first launch, if macOS says the developer cannot be verified, Control-click the app, choose **Open**, then confirm.

## Linux

Pick one format:

```bash
# AppImage: no install needed
chmod +x Asta.AppImage
./Asta.AppImage

# Debian / Ubuntu
sudo apt install ./Asta.deb

# Fedora / openSUSE
sudo dnf install ./Asta.rpm

# Arch
sudo pacman -U Asta.pacman
```

## Run from source (developers)

```bash
git clone https://github.com/Asda168/code-forge.git
cd code-forge/desktop
npm install
npm run icons
npm start
```

To build installers yourself use `npm run dist:win`, `npm run dist:mac` or `npm run dist:linux` on the matching operating system.

## Updates

AstaIDE checks the release feed (Settings, **Updates**, *Automatic updates* and *Check now*). When a newer version exists it opens the download page; you then install the new version over the old one. There is no silent self-update.

## Expected result

AstaIDE opens with the start screen and the Explorer ready for a folder.

## Common problems

- **Windows blocks the installer or the app:** [Installation, SmartScreen and Smart App Control](../troubleshooting/installation.md).
- **Nothing happens when launching on Linux:** make sure the AppImage is executable (`chmod +x`).

## Related

- [First Launch](first-launch.md)
