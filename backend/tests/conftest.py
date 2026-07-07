import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend env to get public URL for testing (mimics what user sees)
load_dotenv(Path("/app/frontend/.env"))

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, base_url, identifier):
    r = session.post(f"{base_url}/api/auth/send-otp",
                     json={"identifier": identifier, "method": "email"})
    assert r.status_code == 200, f"send-otp failed: {r.status_code} {r.text}"
    dev_otp = r.json().get("dev_otp")
    assert dev_otp, "dev_otp missing"
    r2 = session.post(f"{base_url}/api/auth/verify-otp",
                      json={"identifier": identifier, "otp": dev_otp, "method": "email"})
    assert r2.status_code == 200, f"verify-otp failed: {r2.status_code} {r2.text}"
    data = r2.json()
    return data["token"], data["user"], data.get("is_new", False), dev_otp


@pytest.fixture(scope="session")
def user_session(api_client, base_url):
    """Create a fresh user for the session; return (email, token, user)."""
    email = f"TEST_seeker_{uuid.uuid4().hex[:8]}@aathman.app"
    token, user, is_new, _ = _login(api_client, base_url, email)
    return {"email": email, "token": token, "user": user, "is_new": is_new}


@pytest.fixture(scope="session")
def auth_headers(user_session):
    return {"Authorization": f"Bearer {user_session['token']}", "Content-Type": "application/json"}
