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


class ApiIndexView(APIView):
    """Public index at /api/ so opening the API in a browser shows what exists instead of a 401."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        base = request.build_absolute_uri("/api/")
        public = ["releases/", "releases/latest/", "extensions/"]
        private = ["profile/", "settings/", "projects/", "workspaces/"]
        return Response({"name": "Asta IDE API", "public": {p: base + p for p in public},
                         "requires_sign_in": {p: base + p for p in private},
                         "detail": "Endpoints under requires_sign_in need an Authorization: Token header."})


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


class GithubReleases(APIView):
    """Cached proxy of GitHub Releases (assets + download_count) so visitors share one request instead of hitting GitHub's 60/h-per-IP limit."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        import json
        import urllib.request
        from django.core.cache import cache
        from . import site
        key = "gh_releases"
        data = cache.get(key)
        if data is None:
            headers = {"Accept": "application/vnd.github+json", "User-Agent": "asta-site"}
            if os.environ.get("GITHUB_TOKEN"):
                headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
            try:
                req = urllib.request.Request(f"https://api.github.com/repos/{site.REPO.replace('https://github.com/', '')}/releases?per_page=30", headers=headers)
                with urllib.request.urlopen(req, timeout=8) as r:
                    data = json.load(r)
                cache.set(key, data, 300)
                cache.set(key + "_stale", data, 86400)
            except Exception:
                data = cache.get(key + "_stale")
                if data is None:
                    return Response({"detail": "GitHub unavailable."}, status=status.HTTP_502_BAD_GATEWAY)
        resp = Response(data)
        resp["Cache-Control"] = "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
        return resp


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
    import json
    from pathlib import Path
    from django.http import HttpResponse
    from . import site
    base = _site_url(request)
    urls = [f"<url><loc>{base}/</loc><lastmod>{site.RELEASED}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>"]
    pages = Path(__file__).parent / "docs_site" / "pages.json"
    if pages.is_file():                                  # documentation center: every page is listed for search engines
        for u in json.loads(pages.read_text(encoding="utf8")):
            urls.append(f"<url><loc>{base}{u}</loc><lastmod>{site.RELEASED}</lastmod><changefreq>monthly</changefreq><priority>{'0.8' if u == '/docs/' else '0.6'}</priority></url>")
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(urls) + "</urlset>"
    return HttpResponse(xml, content_type="application/xml")


def og_image(request):
    from pathlib import Path
    from django.http import HttpResponse
    r = HttpResponse((Path(__file__).parent / "seo" / "og.png").read_bytes(), content_type="image/png")
    r["Cache-Control"] = "public, max-age=86400"
    return r


SHOTS = {"explorer", "git", "editor", "terminal", "run", "extensions"}


def shot_image(request, name):
    """Real screenshots of the desktop app (core/seo/shots/<name>.webp), cached by the browser and the CDN."""
    from pathlib import Path
    from django.http import Http404, HttpResponse
    if name not in SHOTS:
        raise Http404
    r = HttpResponse((Path(__file__).parent / "seo" / "shots" / f"{name}.webp").read_bytes(), content_type="image/webp")
    r["Cache-Control"] = "public, max-age=604800, s-maxage=604800"
    return r


_DOCS_TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
               ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml"}


def docs_page(request, path=""):
    """Static documentation center (built from /docs by `node docs/build.js` into core/docs_site/).
    Serves <dir>/index.html for page URLs and the shared assets; never reads outside docs_site."""
    from pathlib import Path
    from django.http import Http404, HttpResponse, HttpResponsePermanentRedirect
    root = (Path(__file__).parent / "docs_site").resolve()
    rel = path.strip("/")
    target = (root / rel).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise Http404
    if target.is_dir():
        if path and not path.endswith("/"):
            return HttpResponsePermanentRedirect(request.path + "/")
        target = target / "index.html"
    if not target.is_file() or target.suffix not in _DOCS_TYPES:
        raise Http404
    r = HttpResponse(target.read_bytes(), content_type=_DOCS_TYPES[target.suffix])
    r["Cache-Control"] = "public, max-age=300, s-maxage=3600" if target.suffix in (".html", ".json") else "public, max-age=86400, s-maxage=86400"
    return r


class FeedbackView(APIView):
    """Public feedback / improvement form on the website. Forwards to the Telegram bot; stores nothing."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "feedback"
    KINDS = {"feedback", "improvement", "bug"}
    MAX_IMAGES = 4
    MAX_BYTES = 4 * 1024 * 1024   # Vercel rejects request bodies over 4.5 MB

    def post(self, request):
        d = request.data
        if d.get("website"):  # honeypot: real users never fill this hidden field
            return Response({"ok": True})
        kind = str(d.get("kind") or "feedback").lower()
        message = str(d.get("message") or "").strip()
        contact = str(d.get("contact") or "").strip()[:120]
        if kind not in self.KINDS:
            return Response({"detail": "Unknown feedback type."}, status=status.HTTP_400_BAD_REQUEST)
        if not contact:
            return Response({"detail": "Please enter your email or Telegram username so we can notify you."}, status=status.HTTP_400_BAD_REQUEST)
        if not 10 <= len(message) <= 2000:
            return Response({"detail": "Please write between 10 and 2000 characters."}, status=status.HTTP_400_BAD_REQUEST)
        photos = []
        files = request.FILES.getlist("images") if hasattr(request, "FILES") else []
        if len(files) > self.MAX_IMAGES:
            return Response({"detail": f"Please attach at most {self.MAX_IMAGES} images."}, status=status.HTTP_400_BAD_REQUEST)
        total = 0
        for f in files:
            head = f.read(12); f.seek(0)
            ctype = "image/png" if head.startswith(b"\x89PNG") else "image/jpeg" if head.startswith(b"\xff\xd8") else "image/webp" if head[:4] == b"RIFF" and head[8:12] == b"WEBP" else None
            total += f.size
            if not ctype:
                return Response({"detail": "Attachments must be PNG, JPEG or WebP images."}, status=status.HTTP_400_BAD_REQUEST)
            if total > self.MAX_BYTES:
                return Response({"detail": "Images are too large (4 MB in total)."}, status=status.HTTP_400_BAD_REQUEST)
            photos.append((f"image{len(photos) + 1}.{ctype.split('/')[1]}", ctype, f.read()))
        from . import site
        text = telegram.feedback_text(kind, message, contact, site.VERSION)
        # One Telegram post: the images with the description + contact as the caption under them.
        # Only if the text is too long for a caption do we fall back to album + separate text.
        if photos and len(text) <= telegram.CAPTION_MAX:
            ok = telegram.send_photos(photos, text)
        else:
            ok = telegram.send(text) and (telegram.send_photos(photos) if photos else True)
        if not ok:
            return Response({"detail": "Feedback is temporarily unavailable. Please open a GitHub issue instead."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"ok": True, "images": bool(photos)})
