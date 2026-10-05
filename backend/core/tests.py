from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Download, Release


class ApiTests(TestCase):
    def setUp(self):
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
        self.assertContains(r, "Download CodeCambo")
        self.assertContains(r, "CodeCambo-Setup-x64.exe")

    def test_update_check_and_download_page(self):
        r = Release.objects.create(version="1.2.0", released_at="2026-01-01")
        Download.objects.create(release=r, platform="windows", arch="x64", filename="a.exe", url="https://x/a.exe")
        j = self.c.get("/api/releases/latest/?current=1.0.0").json()
        self.assertTrue(j["update_available"])
        self.assertFalse(self.c.get("/api/releases/latest/?current=1.2.0").json()["update_available"])
        self.assertEqual(self.c.get("/").status_code, 200)

    def test_vercel_host_allowed(self):
        self.assertEqual(self.c.get("/", HTTP_HOST="code-forge-neon-two.vercel.app").status_code, 200)
