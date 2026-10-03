from django.contrib.auth import get_user_model
from rest_framework import serializers

from . import models


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = models.UserProfile
        fields = ["username", "email", "display_name", "telemetry_enabled", "sync_enabled", "ai_consent"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = get_user_model()
        fields = ["username", "email", "password"]

    def create(self, data):
        return get_user_model().objects.create_user(**data)


class EditorSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.EditorSettings
        exclude = ["id", "user"]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Project
        fields = ["id", "name", "kind", "created_at"]
        read_only_fields = ["id", "created_at"]


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Workspace
        fields = ["id", "name", "projects", "layout", "updated_at"]
        read_only_fields = ["id", "updated_at"]

    def validate_projects(self, projects):
        user = self.context["request"].user
        if any(p.owner_id != user.id for p in projects):
            raise serializers.ValidationError("Unknown project.")
        return projects


class DownloadSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Download
        fields = ["platform", "arch", "kind", "filename", "url", "size_bytes", "sha256"]


class ReleaseSerializer(serializers.ModelSerializer):
    downloads = DownloadSerializer(many=True, read_only=True)

    class Meta:
        model = models.Release
        fields = ["version", "channel", "notes", "released_at", "min_os", "downloads"]


class ExtensionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Extension
        fields = ["slug", "name", "category", "version", "description", "languages"]
