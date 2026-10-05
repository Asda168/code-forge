"""Static release data for the public site. Used when no database is configured (e.g. Vercel
without DATABASE_URL), so the download page never depends on a writable database.

`available=False` means the installer has not been published yet; the page shows "Coming soon"
for it instead of a link that would 404. Flip it (and set `url`) when you publish a build.
"""
REPO = "https://github.com/Asda168/code-forge"
VERSION = "1.0.0"
RELEASED = "2026-10-03"
_REL = f"{REPO}/releases/latest/download"

DOWNLOADS = [
    {"platform": "windows", "arch": "x64", "kind": "exe", "filename": "CodeCambo-Setup-x64.exe", "url": f"{_REL}/CodeCambo-Setup-x64.exe", "available": False},
    {"platform": "windows", "arch": "arm64", "kind": "exe", "filename": "CodeCambo-Setup-arm64.exe", "url": f"{_REL}/CodeCambo-Setup-arm64.exe", "available": False},
    {"platform": "macos", "arch": "universal", "kind": "dmg", "filename": "CodeCambo-macOS-universal.dmg", "url": f"{_REL}/CodeCambo-macOS-universal.dmg", "available": False},
    {"platform": "linux", "arch": "x64", "kind": "AppImage", "filename": "CodeCambo.AppImage", "url": f"{_REL}/CodeCambo.AppImage", "available": False},
    {"platform": "linux", "arch": "x64", "kind": "deb", "filename": "CodeCambo.deb", "url": f"{_REL}/CodeCambo.deb", "available": False},
    {"platform": "linux", "arch": "x64", "kind": "rpm", "filename": "CodeCambo.rpm", "url": f"{_REL}/CodeCambo.rpm", "available": False},
]
REQUIREMENTS = {"windows": "Windows 10 or 11 (x64 / ARM64)", "macos": "macOS 12+ (Apple Silicon & Intel)", "linux": "Ubuntu 20.04+, Fedora 36+ or similar (glibc 2.31+)"}


def catalog():
    import json
    from pathlib import Path
    return json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))


def context():
    return {
        "extensions": catalog(),
        "repo_slug": REPO.replace("https://github.com/", ""), "version": VERSION, "released": RELEASED, "repo": REPO, "downloads": DOWNLOADS, "requirements": REQUIREMENTS,
        "source_zip": f"{REPO}/archive/refs/heads/main.zip",
    }
