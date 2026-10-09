import os
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


def _site_url(request):
    """Canonical origin: SITE_URL env/setting if set, else the request's own origin."""
    from django.conf import settings
    return (getattr(settings, "SITE_URL", "") or request.build_absolute_uri("/")).rstrip("/")


def download_page(request):
    from . import site
    base = _site_url(request)
    return render(request, "core/download.html", {**site.context(), "site_url": base, "canonical": base + "/", "og_image": base + "/og.png",
        "google_verification": os.environ.get("GOOGLE_SITE_VERIFICATION", ""), "bing_verification": os.environ.get("BING_SITE_VERIFICATION", "")})


def robots_txt(request):
    from django.http import HttpResponse
    body = "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: " + _site_url(request) + "/sitemap.xml\n"
    return HttpResponse(body, content_type="text/plain")


def sitemap_xml(request):
    from django.http import HttpResponse
    from . import site
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
           f'<url><loc>{_site_url(request)}/</loc><lastmod>{site.RELEASED}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>')
    return HttpResponse(xml, content_type="application/xml")


def og_image(request):
    from pathlib import Path
    from django.http import HttpResponse
    r = HttpResponse((Path(__file__).parent / "seo" / "og.png").read_bytes(), content_type="image/png")
    r["Cache-Control"] = "public, max-age=86400"
    return r


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
