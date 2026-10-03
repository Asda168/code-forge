import datetime

from django.core.management.base import BaseCommand

from core.models import Download, Extension, Release, Theme

THEMES = [
    ("codeforge-dark", "CodeForge Dark", "vs-dark"),
    ("codeforge-light", "CodeForge Light", "vs"),
    ("high-contrast", "High Contrast", "hc-black"),
    ("midnight", "Midnight", "vs-dark"),
    ("vampire", "Vampire (Dracula-inspired)", "vs-dark"),
    ("solar", "Solar (Solarized-inspired)", "vs"),
]
EXTENSIONS = [
    ("php", "PHP", "language"), ("laravel", "Laravel", "framework"), ("python", "Python", "language"),
    ("django", "Django", "framework"), ("javascript", "JavaScript", "language"), ("vue", "Vue", "framework"),
    ("react", "React", "framework"), ("sql", "SQL", "language"), ("mysql", "MySQL", "database"),
    ("git", "Git", "tools"),
]
DOWNLOADS = [
    ("windows", "x64", "exe", "CodeForge-Setup-x64.exe"),
    ("windows", "arm64", "exe", "CodeForge-Setup-arm64.exe"),
    ("macos", "universal", "dmg", "CodeForge-macOS-universal.dmg"),
    ("linux", "x64", "AppImage", "CodeForge.AppImage"),
    ("linux", "x64", "deb", "CodeForge.deb"),
    ("linux", "x64", "rpm", "CodeForge.rpm"),
]


class Command(BaseCommand):
    help = "Seed built-in themes, extensions and a sample release."

    def handle(self, *a, **o):
        for slug, name, base in THEMES:
            Theme.objects.get_or_create(owner=None, slug=slug, defaults={"name": name, "base": base, "is_builtin": True})
        for slug, name, cat in EXTENSIONS:
            Extension.objects.get_or_create(slug=slug, defaults={"name": name, "category": cat})
        rel, _ = Release.objects.get_or_create(
            version="1.0.0",
            defaults={"released_at": datetime.date.today(), "notes": "Initial release.",
                      "min_os": {"windows": "Windows 10+", "macos": "macOS 12+", "linux": "glibc 2.31+"}},
        )
        for plat, arch, kind, fn in DOWNLOADS:
            Download.objects.get_or_create(
                release=rel, filename=fn,
                defaults={"platform": plat, "arch": arch, "kind": kind, "url": f"https://example.com/releases/1.0.0/{fn}"},
            )
        self.stdout.write(self.style.SUCCESS("Seeded."))
