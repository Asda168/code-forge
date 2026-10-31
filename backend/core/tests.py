from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Download, Release


class ApiTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()   # feedback is throttled per hour; keep tests independent
        self.user = get_user_model().objects.create_user("t", password="pass12345")
        self.c = APIClient()

    def login(self):
        r = self.c.post("/api/auth/login/", {"username": "t", "password": "pass12345"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.c.credentials(HTTP_AUTHORIZATION="Token " + r.json()["token"])

    def test_auth_required(self):
        self.assertEqual(self.c.get("/api/profile/").status_code, 401)

    def test_profile_settings_projects(self):
        self.login()
        self.assertEqual(self.c.get("/api/profile/").status_code, 200)
        self.assertEqual(self.c.get("/api/settings/").json()["font_family"], "JetBrains Mono")
        self.assertEqual(self.c.post("/api/projects/", {"name": "x", "kind": "laravel"}, format="json").status_code, 201)
        self.assertEqual(len(self.c.get("/api/projects/").json()), 1)

    def test_projects_are_private(self):
        other = get_user_model().objects.create_user("o", password="pass12345")
        from .models import Project
        Project.objects.create(owner=other, name="secret")
        self.login()
        self.assertEqual(len(self.c.get("/api/projects/").json()), 0)

    def test_download_page_without_db_rows(self):
        r = self.c.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "Download Asta IDE")
        self.assertContains(r, "Asta-Setup-x64.exe")

    def test_site_screenshots_served(self):
        for name in ("explorer", "git", "editor", "terminal", "run", "extensions"):
            r = self.c.get(f"/shots/{name}.webp")
            self.assertEqual((r.status_code, r["Content-Type"]), (200, "image/webp"))
            self.assertTrue(r.content.startswith(b"RIFF"))
        self.assertEqual(self.c.get("/shots/secret.webp").status_code, 404)
        self.assertEqual(self.c.get("/shots/..%2F..%2Fsettings.webp").status_code, 404)

    def test_update_check_and_download_page(self):
        r = Release.objects.create(version="1.2.0", released_at="2026-01-01")
        Download.objects.create(release=r, platform="windows", arch="x64", filename="a.exe", url="https://x/a.exe")
        j = self.c.get("/api/releases/latest/?current=1.0.0").json()
        self.assertTrue(j["update_available"])
        self.assertFalse(self.c.get("/api/releases/latest/?current=1.2.0").json()["update_available"])
        self.assertEqual(self.c.get("/").status_code, 200)

    def test_vercel_host_allowed(self):
        self.assertEqual(self.c.get("/", HTTP_HOST="code-forge-neon-two.vercel.app").status_code, 200)

    def test_feedback_forwards_to_telegram(self):
        from unittest import mock
        with mock.patch("core.telegram.send", return_value=True) as send:
            r = self.c.post("/api/feedback/", {"kind": "improvement", "message": "Please add a <b>dark</b> theme", "contact": "me@x.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        text = send.call_args[0][0]
        self.assertIn("Improvement", text)
        self.assertIn("&lt;b&gt;dark&lt;/b&gt;", text)  # user text is HTML-escaped
        self.assertNotIn("<b>dark</b>", text)

    def test_feedback_validation_honeypot_and_failure(self):
        from unittest import mock
        with mock.patch("core.telegram.send", return_value=True) as send:
            self.assertEqual(self.c.post("/api/feedback/", {"message": "short", "contact": "me@x.com"}, format="json").status_code, 400)
            self.assertEqual(self.c.post("/api/feedback/", {"message": "x" * 20}, format="json").status_code, 400)  # contact is required
            self.assertEqual(self.c.post("/api/feedback/", {"kind": "hack", "message": "x" * 20, "contact": "me@x.com"}, format="json").status_code, 400)
            self.assertEqual(self.c.post("/api/feedback/", {"message": "x" * 20, "contact": "me@x.com", "website": "spam"}, format="json").status_code, 200)
            send.assert_not_called()  # honeypot hits are dropped silently
        with mock.patch("core.telegram.send", return_value=False):
            self.assertEqual(self.c.post("/api/feedback/", {"message": "x" * 20, "contact": "me@x.com"}, format="json").status_code, 503)

    def test_feedback_images_pushed_to_telegram(self):
        from unittest import mock
        from django.core.files.uploadedfile import SimpleUploadedFile
        png = SimpleUploadedFile("a.png", b"\x89PNG\r\n\x1a\n" + b"0" * 50, content_type="image/png")
        with mock.patch("core.telegram.send", return_value=True) as send, mock.patch("core.telegram.send_photos", return_value=True) as photos:
            r = self.c.post("/api/feedback/", {"kind": "bug", "message": "Crash when opening a folder", "contact": "me@x.com", "images": [png]}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(photos.call_args[0][0][0][1], "image/png")
        send.assert_not_called()  # one post: images with the description + contact as caption
        self.assertIn("Crash when opening a folder", photos.call_args[0][1])
        self.assertIn("me@x.com", photos.call_args[0][1])
        bad = SimpleUploadedFile("a.png", b"not an image at all", content_type="image/png")
        with mock.patch("core.telegram.send", return_value=True) as send:
            r = self.c.post("/api/feedback/", {"message": "Crash when opening a folder", "contact": "me@x.com", "images": [bad]}, format="multipart")
        self.assertEqual(r.status_code, 400)
        send.assert_not_called()


class ApiIndexTests(TestCase):
    def test_root_is_public_but_data_is_not(self):
        c = APIClient()
        r = c.get("/api/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("requires_sign_in", r.json())
        self.assertEqual(c.get("/api/profile/").status_code, 401)


class DocsCenterTests(TestCase):
    """The documentation center is built into core/docs_site by `node docs/build.js` and served at /docs/."""

    def test_home_and_every_listed_page_render(self):
        import json
        from pathlib import Path
        pages = json.loads((Path(__file__).parent / "docs_site" / "pages.json").read_text(encoding="utf8"))
        self.assertGreater(len(pages), 60)
        for url in pages:
            r = self.client.get(url)
            self.assertEqual(r.status_code, 200, url)
            self.assertIn(b"AstaIDE", r.content, url)

    def test_assets_and_search_index(self):
        for url, ctype in (("/docs/assets/docs.css", "text/css"), ("/docs/assets/docs.js", "javascript"), ("/docs/search-index.json", "application/json"), ("/docs/assets/logo.png", "image/png")):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 200, url)
            self.assertIn(ctype, r["Content-Type"], url)

    def test_missing_slash_redirects_and_unknown_is_404(self):
        self.assertEqual(self.client.get("/docs/getting-started/install").status_code, 301)
        self.assertEqual(self.client.get("/docs/nope/").status_code, 404)

    def test_no_path_traversal(self):
        for url in ("/docs/../views.py", "/docs/..%2f..%2fcodeforge/settings.py", "/docs/assets/../../views.py"):
            self.assertEqual(self.client.get(url).status_code, 404, url)

    def test_sitemap_lists_docs_and_homepage_links_to_them(self):
        self.assertIn(b"/docs/getting-started/install/", self.client.get("/sitemap.xml").content)
        home = self.client.get("/").content
        self.assertIn(b'href="/docs/"', home)
        self.assertIn(b"Read the docs", home)


class DownloadBaselineTests(TestCase):
    def test_homepage_exposes_baseline_for_re_released_version(self):
        from . import site
        self.assertEqual(site.DOWNLOAD_BASELINE.get("v1.3.9"), 11)
        html = self.client.get("/").content.decode()
        self.assertIn('id="dl-base"', html)
        self.assertIn('"v1.3.9": 11', html)
