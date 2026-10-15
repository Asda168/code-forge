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


def _google_post(url, form):
    """POST form data to a Google endpoint; returns parsed JSON or raises ValueError with a safe message."""
    import json
    import urllib.error
    import urllib.parse
    import urllib.request
    req = urllib.request.Request(url, data=urllib.parse.urlencode(form).encode(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise ValueError("Google rejected the sign-in (%s)." % e.code)
    except Exception:
        raise ValueError("Could not reach Google.")


def _google_verify_id_token(id_token):
    import json
    import urllib.parse
    import urllib.request
    from django.conf import settings
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": id_token})
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            info = json.loads(r.read().decode())
    except Exception:
        raise ValueError("Google sign-in could not be verified.")
    if info.get("aud") != settings.GOOGLE_CLIENT_ID or info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Google sign-in is for a different app.")
    if str(info.get("email_verified")).lower() != "true" or not info.get("email") or not info.get("sub"):
        raise ValueError("Your Google email is not verified.")
    return info


class ApiIndexView(APIView):
    """Public index at /api/ so opening the API in a browser shows what exists instead of a 401."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        base = request.build_absolute_uri("/api/")
        public = ["releases/", "releases/latest/", "extensions/", "auth/google/config/"]
        private = ["profile/", "settings/", "sync/", "projects/", "workspaces/"]
        return Response({"name": "Asta IDE API", "public": {p: base + p for p in public},
                         "requires_sign_in": {p: base + p for p in private},
                         "detail": "Endpoints under requires_sign_in need an Authorization: Token header."})


def _user_for_google(info):
    """Find the user bound to this Google subject, or create one. Returns (user, created).

    Identity is (provider, sub) only: an existing password account with the same email is never taken over or merged."""
    from django.contrib.auth import get_user_model
    from django.db import IntegrityError, transaction
    ident = models.SocialIdentity.objects.select_related("user").filter(provider="google", subject=info["sub"]).first()
    if ident:
        return ident.user, False
    User = get_user_model()
    try:
        with transaction.atomic():
            user = User.objects.create_user("google_" + info["sub"], email=info["email"])
            user.set_unusable_password()
            user.save()
            models.SocialIdentity.objects.create(user=user, provider="google", subject=info["sub"], email=info["email"])
            return user, True
    except IntegrityError:        # a concurrent sign-up won the race: use its account
        ident = models.SocialIdentity.objects.select_related("user").get(provider="google", subject=info["sub"])
        return ident.user, False


class GoogleConfigView(APIView):
    """Public: lets the desktop app know whether Google sign-in is set up, and the (public) client id."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.conf import settings
        ok = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
        return Response({"enabled": ok, "client_id": settings.GOOGLE_CLIENT_ID if ok else ""})


class GoogleLoginView(APIView):
    """Exchange a Google authorization code (PKCE, loopback redirect) for an Asta API token.

    The same Google account always maps to the same Asta user, so signing in again after a reinstall
    restores the account (and its synced settings)."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "login"

    def post(self, request):
        from django.conf import settings
        from django.contrib.auth import get_user_model
        if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
            return Response({"detail": "Google sign-in is not configured on this server."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        code, verifier, redirect = (str(request.data.get(k) or "") for k in ("code", "code_verifier", "redirect_uri"))
        if not (code and verifier and redirect.startswith("http://127.0.0.1:")):
            return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            tok = _google_post("https://oauth2.googleapis.com/token", {
                "code": code, "code_verifier": verifier, "redirect_uri": redirect, "grant_type": "authorization_code",
                "client_id": settings.GOOGLE_CLIENT_ID, "client_secret": settings.GOOGLE_CLIENT_SECRET})
            info = _google_verify_id_token(tok.get("id_token", ""))
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        user, created = _user_for_google(info)
        pic = str(info.get("picture") or "")
        user.profile.avatar_url = pic[:500] if pic.startswith("https://") else ""
        if created:
            user.profile.display_name = (info.get("name") or "")[:120]
        user.profile.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "email": user.email or info["email"], "name": user.profile.display_name,
                         "picture": user.profile.avatar_url, "created": created})


class SyncView(APIView):
    """GET the user's snapshot, PUT a new one. Last write wins; `version` lets a client see if it is behind."""
    throttle_scope = "sync"
    MAX_BYTES = 3 * 1024 * 1024

    def get(self, request):
        snap = models.SyncSnapshot.objects.filter(user=request.user).first()
        if not snap:
            return Response({"version": 0, "data": None})
        return Response({"version": snap.version, "data": snap.data, "updated_at": snap.updated_at})

    def put(self, request):
        import json
        data = request.data.get("data")
        if not isinstance(data, dict):
            return Response({"detail": "Invalid snapshot."}, status=status.HTTP_400_BAD_REQUEST)
        if len(json.dumps(data)) > self.MAX_BYTES:
            return Response({"detail": "Snapshot too large."}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        snap, _ = models.SyncSnapshot.objects.get_or_create(user=request.user)
        snap.data = data
        snap.version += 1
        snap.save()
        return Response({"version": snap.version})


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "login"
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
