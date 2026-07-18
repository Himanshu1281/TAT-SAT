"""Iteration 4 tests: /api/auth/emergent-session error paths only (happy path
requires a real Google session, so we validate the endpoint contract on
invalid/empty session_ids)."""
import pytest


class TestEmergentSession:
    def test_empty_session_id_returns_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/emergent-session",
                            json={"session_id": ""})
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "session_id" in detail or "required" in detail

    def test_missing_session_id_field_returns_422(self, api_client, base_url):
        # Pydantic model requires session_id; missing key => 422
        r = api_client.post(f"{base_url}/api/auth/emergent-session", json={})
        assert r.status_code == 422, r.text

    def test_invalid_session_id_returns_401_or_502(self, api_client, base_url):
        # Emergent upstream will reject a bogus session id.
        r = api_client.post(f"{base_url}/api/auth/emergent-session",
                            json={"session_id": "invalid-abc-does-not-exist"})
        assert r.status_code in (401, 502), f"got {r.status_code} {r.text}"
        detail = (r.json().get("detail") or "").lower()
        # 401 => "Invalid or expired session", 502 => "Auth provider unreachable"
        assert any(w in detail for w in ("invalid", "expired", "unreachable", "provider"))

    def test_endpoint_exists_and_json_body_required(self, api_client, base_url):
        # No JSON body => 422
        r = api_client.post(f"{base_url}/api/auth/emergent-session")
        assert r.status_code == 422
