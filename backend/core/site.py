"""Static release data for the public site. Used when no database is configured (e.g. Vercel
without DATABASE_URL), so the download page never depends on a writable database.

`available=False` means the installer has not been published yet; the page shows "Coming soon"
for it instead of a link that would 404. Flip it (and set `url`) when you publish a build.
"""
REPO = "https://github.com/Asda168/code-forge"
VERSION = "1.3.5"
RELEASED = "2026-10-09"
# Versions offered in the download picker (newest first). Used when the GitHub API is unreachable.
VERSIONS = ["1.3.5", "1.3.4", "1.3.3", "1.3.2"]
CHANGES = [
    "Renamed to Asta IDE",
    "New Settings and Keyboard Shortcuts pages",
    "Arch Linux package (.pacman)",
    "New logo and icons",
    "Website SEO improvements",
]
_REL = f"{REPO}/releases/latest/download"

DOWNLOADS = [
    {"platform": "windows", "arch": "x64", "kind": "exe", "filename": "Asta-Setup-x64.exe", "url": f"{_REL}/Asta-Setup-x64.exe", "available": True},
    {"platform": "windows", "arch": "arm64", "kind": "exe", "filename": "Asta-Setup-arm64.exe", "url": f"{_REL}/Asta-Setup-arm64.exe", "available": True},
    {"platform": "macos", "arch": "universal", "kind": "dmg", "filename": "Asta-macOS-universal.dmg", "url": f"{_REL}/Asta-macOS-universal.dmg", "available": True},
    {"platform": "linux", "arch": "x64", "kind": "AppImage", "filename": "Asta.AppImage", "url": f"{_REL}/Asta.AppImage", "available": True},
    {"platform": "linux", "arch": "x64", "kind": "deb", "filename": "Asta.deb", "url": f"{_REL}/Asta.deb", "available": True},
    {"platform": "linux", "arch": "x64", "kind": "rpm", "filename": "Asta.rpm", "url": f"{_REL}/Asta.rpm", "available": True},
    {"platform": "linux", "arch": "x64", "kind": "pacman", "filename": "Asta.pacman", "url": f"{_REL}/Asta.pacman", "available": True},
]
# Set True to show the project cards below; while False the Projects section shows "Coming soon".
SHOW_PROJECTS = False
PROJECTS = [
    {"name": "Portfolio (Django)", "description": "Single-page personal portfolio built with Django: typewriter intro, skills, experience, projects and a validated contact form.",
     "tags": ["Django", "Python", "Tailwind", "Vercel"], "url": "https://oukasda.vercel.app/", "source": "https://github.com/Asda168/portfolio-django"},
    {"name": "MySQL Forge Studio", "description": "Modern MySQL database client, SQL editor, code editor, Git client and terminal for Windows, macOS and Linux.",
     "tags": ["TypeScript", "MySQL", "SQL", "Vercel"], "url": "https://sql-tool-rho.vercel.app/", "source": "https://github.com/Asda168/sql-tool"},
]
REQUIREMENTS = {"windows": "Windows 10 or 11 (x64 / ARM64)", "macos": "macOS 12+ (Apple Silicon & Intel)", "linux": "Ubuntu 20.04+, Fedora 36+ or similar (glibc 2.31+)"}


def catalog():
    import json
    from pathlib import Path
    return json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))


def context():
    return {
        "extensions": catalog(),
        "repo_slug": REPO.replace("https://github.com/", ""), "version": VERSION, "versions": VERSIONS, "changes": CHANGES, "released": RELEASED, "repo": REPO, "downloads": DOWNLOADS, "requirements": REQUIREMENTS, "projects": PROJECTS, "show_projects": SHOW_PROJECTS,
        "source_zip": f"{REPO}/archive/refs/heads/main.zip",
    }
