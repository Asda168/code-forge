from django.contrib.auth import authenticate
from django.shortcuts import render
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models, serializers, telegram


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "login"

    def post(self, request):
        user = authenticate(username=request.data.get("username"), password=request.data.get("password"))
        if not user:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = serializers.RegisterSerializer


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = serializers.ProfileSerializer

    def get_object(self):
        return self.request.user.profile


class SettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = serializers.EditorSettingsSerializer

    def get_object(self):
        obj, _ = models.EditorSettings.objects.get_or_create(user=self.request.user)
        return obj


class OwnedViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return super().get_queryset().filter(**{self.owner_field: self.request.user})


class ProjectViewSet(OwnedViewSet):
    queryset = models.Project.objects.all()
    serializer_class = serializers.ProjectSerializer
    owner_field = "owner"

    def perform_create(self, s):
        s.save(owner=self.request.user)


class WorkspaceViewSet(OwnedViewSet):
    queryset = models.Workspace.objects.all()
    serializer_class = serializers.WorkspaceSerializer
    owner_field = "owner"

    def perform_create(self, s):
        s.save(owner=self.request.user)


def _static_release():
    from . import site
    return {"version": site.VERSION, "channel": "stable", "notes": "", "released_at": site.RELEASED, "min_os": site.REQUIREMENTS,
            "downloads": [d for d in site.DOWNLOADS if d["available"]]}


def _db_releases():
    """Releases from the database, or None when no usable database/tables exist (e.g. Vercel without DATABASE_URL)."""
    from django.db import DatabaseError
    try:
        return list(models.Release.objects.prefetch_related("downloads"))
    except DatabaseError:
        return None


class ReleaseList(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        rels = _db_releases()
        if not rels:
            return Response([_static_release()])
        return Response(serializers.ReleaseSerializer(rels, many=True).data)


class LatestRelease(APIView):
    """Used by the desktop auto-updater: GET /api/releases/latest/?current=1.0.0"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        rels = [r for r in (_db_releases() or []) if r.channel == request.query_params.get("channel", "stable")]
        data = serializers.ReleaseSerializer(rels[0]).data if rels else _static_release()
        current = request.query_params.get("current", "0")
        return Response({"update_available": _vtuple(data["version"]) > _vtuple(current), "release": data})


def _vtuple(v):
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


class ExtensionList(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = serializers.ExtensionSerializer
    queryset = models.Extension.objects.all()


def download_page(request):
    from . import site
    return render(request, "core/download.html", site.context())


class FeedbackView(APIView):
    """Public feedback / improvement form on the website. Forwards to the Telegram bot; stores nothing."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "feedback"
    KINDS = {"feedback", "improvement", "bug"}

    def post(self, request):
        d = request.data
        if d.get("website"):  # honeypot: real users never fill this hidden field
            return Response({"ok": True})
        kind = str(d.get("kind") or "feedback").lower()
        message = str(d.get("message") or "").strip()
        contact = str(d.get("contact") or "").strip()[:120]
        if kind not in self.KINDS:
            return Response({"detail": "Unknown feedback type."}, status=status.HTTP_400_BAD_REQUEST)
        if not 10 <= len(message) <= 2000:
            return Response({"detail": "Please write between 10 and 2000 characters."}, status=status.HTTP_400_BAD_REQUEST)
        from . import site
        if not telegram.send(telegram.feedback_text(kind, message, contact, site.VERSION)):
            return Response({"detail": "Feedback is temporarily unavailable. Please open a GitHub issue instead."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"ok": True})
