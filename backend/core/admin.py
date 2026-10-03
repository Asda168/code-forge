from django.contrib import admin

from . import models

for m in [
    models.UserProfile, models.Workspace, models.Project, models.Repository, models.GitRemote,
    models.RunConfiguration, models.EditorSettings, models.TerminalProfile, models.Theme,
    models.Extension, models.InstalledExtension, models.Release, models.Download, models.UserPreference,
]:
    admin.site.register(m)
