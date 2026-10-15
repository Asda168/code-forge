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
        self.assertContains(r, "Download Asta")
        self.assertContains(r, "Asta-Setup-x64.exe")

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
            self.assertEqual(self.c.post("/api/feedback/", {"message": "short"}, format="json").status_code, 400)
            self.assertEqual(self.c.post("/api/feedback/", {"kind": "hack", "message": "x" * 20}, format="json").status_code, 400)
            self.assertEqual(self.c.post("/api/feedback/", {"message": "x" * 20, "website": "spam"}, format="json").status_code, 200)
            send.assert_not_called()  # honeypot hits are dropped silently
        with mock.patch("core.telegram.send", return_value=False):
            self.assertEqual(self.c.post("/api/feedback/", {"message": "x" * 20}, format="json").status_code, 503)


class GoogleSyncTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()      # login throttle is 10/min; keep tests independent
        self.c = APIClient()

    @override_settings(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="")
    def test_google_not_configured(self):
        self.assertFalse(self.c.get("/api/auth/google/config/").json()["enabled"])
        r = self.c.post("/api/auth/google/", {"code": "x", "code_verifier": "y", "redirect_uri": "http://127.0.0.1:1/cb"}, format="json")
        self.assertEqual(r.status_code, 503)

    @override_settings(GOOGLE_CLIENT_ID="cid", GOOGLE_CLIENT_SECRET="sec")
    def test_google_login_creates_stable_user(self):
        from unittest import mock
        info = {"aud": "cid", "iss": "https://accounts.google.com", "email_verified": "true", "email": "a@b.co", "sub": "123", "name": "A B", "picture": "https://lh3.googleusercontent.com/a/x"}
        body = {"code": "c", "code_verifier": "v", "redirect_uri": "http://127.0.0.1:5555/cb"}
        with mock.patch("core.views._google_post", return_value={"id_token": "t"}), mock.patch("core.views._google_verify_id_token", return_value=info):
            t1 = self.c.post("/api/auth/google/", body, format="json").json()
            t2 = self.c.post("/api/auth/google/", body, format="json").json()
        self.assertEqual(t1["token"], t2["token"])
        self.assertEqual(t1["picture"], "https://lh3.googleusercontent.com/a/x")
        self.assertEqual(t1["name"], "A B")
        self.assertEqual(get_user_model().objects.filter(username="google_123").count(), 1)

    @override_settings(GOOGLE_CLIENT_ID="cid", GOOGLE_CLIENT_SECRET="sec")
    def test_google_rejects_non_loopback_redirect(self):
        r = self.c.post("/api/auth/google/", {"code": "c", "code_verifier": "v", "redirect_uri": "https://evil.example/cb"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_sync_roundtrip_and_auth(self):
        self.assertEqual(self.c.get("/api/sync/").status_code, 401)
        u = get_user_model().objects.create_user("s", password="pass12345")
        self.c.force_authenticate(u)
        self.assertIsNone(self.c.get("/api/sync/").json()["data"])
        self.assertEqual(self.c.put("/api/sync/", {"data": {"settings": {"theme": "x"}}}, format="json").json()["version"], 1)
        got = self.c.get("/api/sync/").json()
        self.assertEqual(got["data"]["settings"]["theme"], "x")
        self.assertEqual(self.c.put("/api/sync/", {"data": "nope"}, format="json").status_code, 400)


class ApiIndexTests(TestCase):
    def test_root_is_public_but_data_is_not(self):
        c = APIClient()
        r = c.get("/api/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("requires_sign_in", r.json())
        self.assertEqual(c.get("/api/sync/").status_code, 401)
        self.assertEqual(c.get("/api/profile/").status_code, 401)


@override_settings(GOOGLE_CLIENT_ID="cid", GOOGLE_CLIENT_SECRET="sec")
class GoogleIdentityTests(TestCase):
    BODY = {"code": "c", "code_verifier": "v", "redirect_uri": "http://127.0.0.1:5555/cb"}

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def login(self, sub="g-1", email="a@b.co", name="A B"):
        from unittest import mock
        info = {"aud": "cid", "iss": "https://accounts.google.com", "email_verified": "true", "email": email, "sub": sub, "name": name}
        with mock.patch("core.views._google_post", return_value={"id_token": "t"}), mock.patch("core.views._google_verify_id_token", return_value=info):
            return APIClient().post("/api/auth/google/", self.BODY, format="json")

    def test_new_user_is_created_once_and_flagged(self):
        from .models import SocialIdentity
        r1 = self.login(); r2 = self.login()
        self.assertTrue(r1.json()["created"]); self.assertFalse(r2.json()["created"])
        self.assertEqual(r1.json()["token"], r2.json()["token"])
        self.assertEqual(SocialIdentity.objects.filter(provider="google", subject="g-1").count(), 1)
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_email_match_does_not_take_over_a_password_account(self):
        victim = get_user_model().objects.create_user("victim", email="a@b.co", password="pass12345")
        r = self.login(sub="attacker-sub", email="a@b.co")
        self.assertEqual(r.status_code, 200)
        from rest_framework.authtoken.models import Token
        self.assertNotEqual(r.json()["token"], Token.objects.get_or_create(user=victim)[0].key)
        self.assertEqual(get_user_model().objects.count(), 2)

    def test_two_google_accounts_never_share_a_user(self):
        a = self.login(sub="g-a", email="x@y.z").json()["token"]; b = self.login(sub="g-b", email="x@y.z").json()["token"]
        self.assertNotEqual(a, b)

    def test_unique_constraint_and_race_fallback(self):
        from django.db import IntegrityError
        from .models import SocialIdentity
        from .views import _user_for_google
        u, created = _user_for_google({"sub": "race", "email": "r@r.co"})
        self.assertTrue(created)
        with self.assertRaises(IntegrityError):
            with transaction_atomic():
                SocialIdentity.objects.create(user=u, provider="google", subject="race")
        u2, created2 = _user_for_google({"sub": "race", "email": "r@r.co"})
        self.assertFalse(created2); self.assertEqual(u.pk, u2.pk)

    def test_session_works_then_logout_revokes(self):
        tok = self.login().json()["token"]
        c = APIClient(); c.credentials(HTTP_AUTHORIZATION="Token " + tok)
        self.assertEqual(c.get("/api/profile/").status_code, 200)
        self.assertEqual(c.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(c.get("/api/profile/").status_code, 401)

    def test_rejects_unverified_google_response(self):
        from unittest import mock
        with mock.patch("core.views._google_post", return_value={"id_token": "t"}), \
                mock.patch("core.views._google_verify_id_token", side_effect=ValueError("Your Google email is not verified.")):
            r = APIClient().post("/api/auth/google/", self.BODY, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(get_user_model().objects.count(), 0)


def transaction_atomic():
    from django.db import transaction
    return transaction.atomic()
