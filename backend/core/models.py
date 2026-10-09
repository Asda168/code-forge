"""Asta data model.

Privacy rule: these models store *metadata* only. Source code and absolute local paths are
never stored unless the user explicitly enables sync (UserProfile.sync_enabled).
"""
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

User = settings.AUTH_USER_MODEL


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=120, blank=True)
    telemetry_enabled = models.BooleanField(default=False)
    sync_enabled = models.BooleanField(default=False, help_text="Settings/workspace sync")
    ai_consent = models.BooleanField(default=False, help_text="Allow sending code to AI services")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name or str(self.user)


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)
        EditorSettings.objects.get_or_create(user=instance)


class Theme(models.Model):
    BASES = [("vs-dark", "Dark"), ("vs", "Light"), ("hc-black", "High Contrast")]
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)
    slug = models.SlugField()
    name = models.CharField(max_length=80)
    base = models.CharField(max_length=20, choices=BASES, default="vs-dark")
    colors = models.JSONField(default=dict, blank=True)
    is_builtin = models.BooleanField(default=False)

    class Meta:
        unique_together = [("owner", "slug")]

    def __str__(self):
        return self.name


class EditorSettings(models.Model):
    AUTOSAVE = [
        ("off", "Off"),
        ("afterDelay", "After Delay"),
        ("onFocusChange", "When Focus Changes"),
        ("onWindowChange", "When Window Changes"),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="editor_settings")
    font_family = models.CharField(max_length=120, default="JetBrains Mono")
    font_size = models.PositiveSmallIntegerField(default=14)
    font_weight = models.CharField(max_length=12, default="400")
    line_height = models.FloatField(default=1.5)
    letter_spacing = models.FloatField(default=0)
    ligatures = models.BooleanField(default=True)
    smooth_rendering = models.BooleanField(default=True)
    minimap = models.BooleanField(default=True)
    word_wrap = models.BooleanField(default=False)
    tab_size = models.PositiveSmallIntegerField(default=4)
    insert_spaces = models.BooleanField(default=True)
    auto_save = models.CharField(max_length=20, choices=AUTOSAVE, default="afterDelay")
    auto_save_delay = models.PositiveIntegerField(default=1000)
    theme = models.ForeignKey(Theme, null=True, blank=True, on_delete=models.SET_NULL)


class TerminalProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="terminal_profiles")
    name = models.CharField(max_length=60)
    platform = models.CharField(max_length=10, choices=[("win32", "Windows"), ("darwin", "macOS"), ("linux", "Linux")])
    shell_path = models.CharField(max_length=500, blank=True)
    args = models.JSONField(default=list, blank=True)
    is_default = models.BooleanField(default=False)


class Project(models.Model):
    KINDS = ["laravel", "django", "python", "node", "vue", "react", "php", "empty"]
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=[(k, k.title()) for k in KINDS], default="empty")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Repository(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="repositories")
    name = models.CharField(max_length=120)
    default_branch = models.CharField(max_length=80, default="main")


class GitRemote(models.Model):
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE, related_name="remotes")
    name = models.CharField(max_length=60, default="origin")
    url = models.CharField(max_length=500)  # https or ssh; never store credentials in the URL


class RunConfiguration(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="run_configs")
    name = models.CharField(max_length=120)
    command = models.CharField(max_length=500)
    working_directory = models.CharField(max_length=500, default="${workspaceFolder}")
    environment = models.JSONField(default=dict, blank=True)


class Workspace(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="workspaces")
    name = models.CharField(max_length=120)
    projects = models.ManyToManyField(Project, blank=True)
    layout = models.JSONField(default=dict, blank=True)  # editor layout, open tab names, terminals
    updated_at = models.DateTimeField(auto_now=True)


class Extension(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=40, blank=True)
    version = models.CharField(max_length=20, default="1.0.0")
    description = models.TextField(blank=True)
    languages = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name


class InstalledExtension(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="installed_extensions")
    extension = models.ForeignKey(Extension, on_delete=models.CASCADE)
    enabled = models.BooleanField(default=True)
    installed_version = models.CharField(max_length=20)

    class Meta:
        unique_together = [("user", "extension")]


class Release(models.Model):
    version = models.CharField(max_length=20, unique=True)
    channel = models.CharField(max_length=20, default="stable")
    notes = models.TextField(blank=True)
    released_at = models.DateField()
    min_os = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-released_at", "-id"]

    def __str__(self):
        return self.version


class Download(models.Model):
    PLATFORMS = [("windows", "Windows"), ("macos", "macOS"), ("linux", "Linux")]
    release = models.ForeignKey(Release, on_delete=models.CASCADE, related_name="downloads")
    platform = models.CharField(max_length=10, choices=PLATFORMS)
    arch = models.CharField(max_length=10)  # x64 / arm64 / universal
    kind = models.CharField(max_length=20, blank=True)  # exe, dmg, AppImage, deb, rpm
    filename = models.CharField(max_length=200)
    url = models.URLField()
    size_bytes = models.BigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)


class UserPreference(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="preferences")
    key = models.CharField(max_length=80)
    value = models.JSONField(default=dict)

    class Meta:
        unique_together = [("user", "key")]
