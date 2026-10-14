"""
Iteration 8 — Deployment readiness smoke test.

Verifies backend continues to function after the following deployment fixes:
  1. JWT_SECRET hardening — server.py now raises RuntimeError if missing/placeholder.
     Real .env has a valid value; the fact that we can hit /api/ at all confirms boot.
  2. Removed android.googleServicesFile from app.json (no runtime impact on backend).
  3. .env un-ignored in .gitignore (no runtime impact).

Scope (per review_request):
  - Core public endpoints: /api/, /api/music (4 tracks), /api/guru/messages
  - Auth: send-otp + verify-otp dev-mode -> JWT -> /api/auth/me
  - Admin: whoami, users, qa list, qa reply, public /api/qa reflects the answer
  - Push relay preview short-circuit: POST /api/register-push -> 201, mode: 'preview'
"""
import os
import uuid
import pytest
import requests

ADMIN_EMAIL = "admin@aathmanawarenesscentre.com"


def _login(session, base_url, identifier):
    r = session.post(f"{base_url}/api/auth/send-otp",
                     json={"identifier": identifier, "method": "email"})
    assert r.status_code == 200, f"send-otp {r.status_code}: {r.text}"
    body = r.json()
    otp = body.get("dev_otp")
    assert otp and len(otp) == 6, f"dev_otp missing from response: {body}"
    r2 = session.post(f"{base_url}/api/auth/verify-otp",
                      json={"identifier": identifier, "otp": otp, "method": "email"})
    assert r2.status_code == 200, f"verify-otp {r2.status_code}: {r2.text}"
    data = r2.json()
    assert "token" in data and data["token"]
    assert "user" in data
    return data["token"], data["user"]


# ---- Backend boot / JWT_SECRET hardening ---------------------------------
class TestBootAndJwtSecret:
    """Server must be up and JWT round-trip must decode with the current secret."""

    def test_root_endpoint(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("message") == "Aathman API is awake"
        assert "time" in data

    def test_otp_verify_token_decodes_on_me(self, api_client, base_url):
        """Full JWT round-trip: OTP -> token -> /auth/me returns the same user."""
        email = f"TEST_iter8_boot_{uuid.uuid4().hex[:8]}@aathman.app"
        token, user = _login(api_client, base_url, email)

        r = api_client.get(f"{base_url}/api/auth/me",
                           headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["id"] == user["id"]
        # Backend lowercases the identifier
        assert me.get("email", "").lower() == email.lower()


# ---- Regression: core public endpoints -----------------------------------
class TestCorePublicEndpoints:

    def test_music_returns_four_tracks(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/music")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) == 4, f"Expected 4 uploaded MP3 tracks, got {len(rows)}"
        expected_titles = {
            "Call From Within", "By The Waves",
            "By The Waterfall", "Birds in Nature",
        }
        got_titles = {t["title"] for t in rows}
        assert got_titles == expected_titles, f"got {got_titles}"
        # Every row must have a real MP3 URL
        for t in rows:
            assert t["url"].endswith(".mp3") or t["url"].endswith(".mp3?")
            # No mongo _id should leak
            assert "_id" not in t

    def test_guru_messages_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/guru/messages")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 3
        for row in rows[:5]:
            assert "id" in row and "title" in row and "body" in row
            assert "_id" not in row


# ---- Push relay preview mode ---------------------------------------------
class TestRegisterPushPreview:

    def test_register_push_preview_mode(self, api_client, base_url):
        email = f"TEST_iter8_push_{uuid.uuid4().hex[:8]}@aathman.app"
        token, user = _login(api_client, base_url, email)
        payload = {
            "user_id": user["id"],
            "platform": "ios",
            "device_token": f"TEST_iter8_token_{uuid.uuid4().hex}",
        }
        r = api_client.post(
            f"{base_url}/api/register-push",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert r.status_code == 201, f"expected 201 got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("status") == "registered"
        assert body.get("mode") == "preview"

    def test_register_push_user_id_mismatch_forbidden(self, api_client, base_url):
        email = f"TEST_iter8_push2_{uuid.uuid4().hex[:8]}@aathman.app"
        token, _ = _login(api_client, base_url, email)
        r = api_client.post(
            f"{base_url}/api/register-push",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "user_id": "some-other-user-id",
                "platform": "ios",
                "device_token": "TEST_iter8_token_x",
            },
        )
        assert r.status_code == 403, r.text


# ---- Admin flow -----------------------------------------------------------
class TestAdminFlow:

    @pytest.fixture(scope="class")
    def admin_session(self, api_client, base_url):
        token, user = _login(api_client, base_url, ADMIN_EMAIL)
        return {"token": token, "user": user}

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_session):
        return {"Authorization": f"Bearer {admin_session['token']}",
                "Content-Type": "application/json"}

    def test_admin_whoami(self, api_client, base_url, admin_headers):
        r = api_client.get(f"{base_url}/api/admin/whoami", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert (body.get("email") or "").lower() == ADMIN_EMAIL.lower()

    def test_admin_users_list(self, api_client, base_url, admin_headers):
        r = api_client.get(f"{base_url}/api/admin/users", headers=admin_headers)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
        # Ensure no _id leaks
        for u in rows[:20]:
            assert "_id" not in u

    def test_admin_qa_reply_flow_end_to_end(self, api_client, base_url, admin_headers):
        # 1) seeker posts a question
        seeker_email = f"TEST_iter8_qa_{uuid.uuid4().hex[:8]}@aathman.app"
        seeker_token, _ = _login(api_client, base_url, seeker_email)
        q_text = f"TEST_iter8 question {uuid.uuid4().hex[:6]}"
        r = api_client.post(
            f"{base_url}/api/qa",
            headers={"Authorization": f"Bearer {seeker_token}"},
            json={"question": q_text},
        )
        assert r.status_code == 200, r.text
        qa_id = r.json()["id"]

        # 2) admin sees it via /admin/qa
        r = api_client.get(f"{base_url}/api/admin/qa", headers=admin_headers)
        assert r.status_code == 200
        assert any(row["id"] == qa_id for row in r.json())

        # 3) admin replies
        a_text = f"TEST_iter8 answer {uuid.uuid4().hex[:6]}"
        r = api_client.post(
            f"{base_url}/api/admin/qa/{qa_id}/reply",
            headers=admin_headers,
            json={"answer": a_text},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # 4) public /api/qa reflects the answer
        r = api_client.get(f"{base_url}/api/qa")
        assert r.status_code == 200
        match = next((x for x in r.json() if x["id"] == qa_id), None)
        assert match is not None, "answered Q missing from public /api/qa"
        assert match["answer"] == a_text
