"""Iteration 7 backend tests — Admin panel endpoints & push relay.

Scope:
- /api/admin/whoami — 200 for admin, 403 for non-admin, 401 without token
- /api/admin/users — list + search filter (?q=)
- /api/admin/sos — list; PUT /api/admin/sos/{id} status update
- /api/admin/qa — list; ?only_unanswered=true; POST /api/admin/qa/{id}/reply
- POST /api/admin/guru-messages — publish + verify in /api/guru/messages
- POST /api/register-push — preview short-circuit (EMERGENT_PUSH_KEY=placeholder)
- Regression: OTP flow, /auth/me, /live/aathman-current, /guru/messages
"""
import uuid
import requests

ADMIN_EMAIL = "admin@aathmanawarenesscentre.com"


def _login(base_url, identifier):
    r = requests.post(f"{base_url}/api/auth/send-otp",
                      json={"identifier": identifier, "method": "email"}, timeout=15)
    assert r.status_code == 200, f"send-otp: {r.status_code} {r.text}"
    otp = r.json().get("dev_otp")
    assert otp, f"dev_otp missing in {r.json()}"
    r2 = requests.post(f"{base_url}/api/auth/verify-otp",
                       json={"identifier": identifier, "method": "email", "otp": otp}, timeout=15)
    assert r2.status_code == 200, f"verify-otp: {r2.status_code} {r2.text}"
    data = r2.json()
    return data["token"], data["user"]


# -------- Fixtures inline (session-scoped via conftest available too) --------

def _admin_headers(base_url):
    token, _ = _login(base_url, ADMIN_EMAIL)
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, token


def _seeker_headers(base_url, email=None):
    email = email or f"TEST_seeker_{uuid.uuid4().hex[:8]}@aathman.app"
    token, user = _login(base_url, email)
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, user, email


# ---------- /api/admin/whoami ----------

def test_admin_whoami_admin_ok(base_url):
    h, _ = _admin_headers(base_url)
    r = requests.get(f"{base_url}/api/admin/whoami", headers=h, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert (body.get("email") or "").lower() == ADMIN_EMAIL.lower()


def test_admin_whoami_non_admin_403(base_url):
    h, _, _ = _seeker_headers(base_url)
    r = requests.get(f"{base_url}/api/admin/whoami", headers=h, timeout=10)
    assert r.status_code == 403, r.text


def test_admin_whoami_no_token_401(base_url):
    r = requests.get(f"{base_url}/api/admin/whoami", timeout=10)
    # FastAPI HTTPBearer without auto_error may return 401 or 403 — spec says 401
    assert r.status_code in (401, 403), r.text


# ---------- /api/admin/users ----------

def test_admin_users_list(base_url):
    h, _ = _admin_headers(base_url)
    # seed a searchable non-admin user
    unique = uuid.uuid4().hex[:8]
    seed_email = f"TEST_searchme_{unique}@aathman.app"
    _login(base_url, seed_email)

    r = requests.get(f"{base_url}/api/admin/users", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    # Ensure MongoDB _id is not leaked
    for row in rows[:5]:
        assert "_id" not in row
        assert "id" in row and "email" in row


def test_admin_users_search_filter(base_url):
    h, _ = _admin_headers(base_url)
    unique = uuid.uuid4().hex[:8]
    seed_email = f"TEST_searchme_{unique}@aathman.app"
    _login(base_url, seed_email)

    # Filter by unique substring (backend lowercases emails)
    r = requests.get(f"{base_url}/api/admin/users", headers=h, params={"q": unique}, timeout=15)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    assert any((u.get("email") or "").lower() == seed_email.lower() for u in rows), \
        f"seeded user not found: {rows}"

    # Filter that should return zero
    r2 = requests.get(f"{base_url}/api/admin/users", headers=h,
                      params={"q": f"NOMATCH_{uuid.uuid4().hex}"}, timeout=15)
    assert r2.status_code == 200
    assert r2.json() == []


def test_admin_users_forbidden_for_non_admin(base_url):
    h, _, _ = _seeker_headers(base_url)
    r = requests.get(f"{base_url}/api/admin/users", headers=h, timeout=10)
    assert r.status_code == 403


# ---------- /api/admin/sos ----------

def test_admin_sos_list_and_status_update(base_url):
    h_admin, _ = _admin_headers(base_url)
    h_seeker, _, _ = _seeker_headers(base_url)

    # Seeker creates SOS
    r = requests.post(f"{base_url}/api/sos/request", headers=h_seeker, json={
        "name": "TEST_Seeker",
        "phone": "+911234567890",
        "feeling": "anxious",
        "note": "TEST_iteration7 sos"
    }, timeout=10)
    assert r.status_code == 200, r.text
    sos_id = r.json()["request"]["id"]

    # Admin lists SOS
    r2 = requests.get(f"{base_url}/api/admin/sos", headers=h_admin, timeout=10)
    assert r2.status_code == 200, r2.text
    rows = r2.json()
    assert isinstance(rows, list)
    match = next((x for x in rows if x.get("id") == sos_id), None)
    assert match is not None, f"created SOS not returned: {rows[:3]}"
    assert match.get("status") == "queued"

    # Update -> pending
    r3 = requests.put(f"{base_url}/api/admin/sos/{sos_id}", headers=h_admin,
                      json={"status": "pending"}, timeout=10)
    assert r3.status_code == 200, r3.text
    assert r3.json().get("ok") is True

    # Update -> resolved
    r4 = requests.put(f"{base_url}/api/admin/sos/{sos_id}", headers=h_admin,
                      json={"status": "resolved"}, timeout=10)
    assert r4.status_code == 200

    # Verify persistence
    r5 = requests.get(f"{base_url}/api/admin/sos", headers=h_admin, timeout=10)
    rows = r5.json()
    match = next((x for x in rows if x.get("id") == sos_id), None)
    assert match is not None
    assert match.get("status") == "resolved", f"status not persisted: {match}"


def test_admin_sos_update_404(base_url):
    h_admin, _ = _admin_headers(base_url)
    r = requests.put(f"{base_url}/api/admin/sos/{uuid.uuid4().hex}", headers=h_admin,
                     json={"status": "resolved"}, timeout=10)
    assert r.status_code == 404


def test_admin_sos_forbidden_for_non_admin(base_url):
    h, _, _ = _seeker_headers(base_url)
    r = requests.get(f"{base_url}/api/admin/sos", headers=h, timeout=10)
    assert r.status_code == 403


# ---------- /api/admin/qa ----------

def test_admin_qa_list_and_reply_reflects_in_public_qa(base_url):
    h_admin, _ = _admin_headers(base_url)
    h_seeker, _, _ = _seeker_headers(base_url)

    # Seeker posts a new question
    q_text = f"TEST_iter7 What is silence? {uuid.uuid4().hex[:6]}"
    rp = requests.post(f"{base_url}/api/qa", headers=h_seeker,
                       json={"question": q_text}, timeout=10)
    assert rp.status_code == 200, rp.text
    qa_id = rp.json()["id"]

    # Admin sees only_unanswered
    ru = requests.get(f"{base_url}/api/admin/qa", headers=h_admin,
                      params={"only_unanswered": "true"}, timeout=10)
    assert ru.status_code == 200, ru.text
    unanswered = ru.json()
    assert any(x.get("id") == qa_id for x in unanswered), \
        "new unanswered Q not in admin only_unanswered list"

    # Admin lists all
    ra = requests.get(f"{base_url}/api/admin/qa", headers=h_admin, timeout=10)
    assert ra.status_code == 200
    assert any(x.get("id") == qa_id for x in ra.json())

    # Public list should NOT yet include the un-answered question
    rpub = requests.get(f"{base_url}/api/qa", timeout=10)
    assert rpub.status_code == 200
    assert not any(x.get("id") == qa_id for x in rpub.json()), \
        "unanswered Q leaked to public /api/qa"

    # Admin replies
    answer_text = f"Silence is the language of God. [iter7-{uuid.uuid4().hex[:6]}]"
    rr = requests.post(f"{base_url}/api/admin/qa/{qa_id}/reply", headers=h_admin,
                       json={"answer": answer_text}, timeout=10)
    assert rr.status_code == 200, rr.text
    assert rr.json().get("ok") is True

    # After reply — public /api/qa MUST return it with the answer
    rpub2 = requests.get(f"{base_url}/api/qa", timeout=10)
    assert rpub2.status_code == 200
    match = next((x for x in rpub2.json() if x.get("id") == qa_id), None)
    assert match is not None, "answered Q not published on public /api/qa"
    assert match.get("answer") == answer_text
    assert match.get("question") == q_text

    # only_unanswered should no longer include it
    ru2 = requests.get(f"{base_url}/api/admin/qa", headers=h_admin,
                       params={"only_unanswered": "true"}, timeout=10)
    assert ru2.status_code == 200
    assert not any(x.get("id") == qa_id for x in ru2.json()), \
        "answered Q still in only_unanswered filter"


def test_admin_qa_reply_404(base_url):
    h_admin, _ = _admin_headers(base_url)
    r = requests.post(f"{base_url}/api/admin/qa/{uuid.uuid4().hex}/reply", headers=h_admin,
                      json={"answer": "nope"}, timeout=10)
    assert r.status_code == 404


def test_admin_qa_forbidden_for_non_admin(base_url):
    h, _, _ = _seeker_headers(base_url)
    r = requests.get(f"{base_url}/api/admin/qa", headers=h, timeout=10)
    assert r.status_code == 403


# ---------- /api/admin/guru-messages ----------

def test_admin_publish_guru_message_and_appears_in_public_feed(base_url):
    h_admin, _ = _admin_headers(base_url)
    title = f"TEST_iter7 Guruji Msg {uuid.uuid4().hex[:6]}"
    body = "Sit in silence and listen. TEST_iter7 body content."
    r = requests.post(f"{base_url}/api/admin/guru-messages", headers=h_admin,
                      json={"title": title, "body": body}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("ok") is True
    assert "push_sent_to" in data
    # Must NOT 500 in placeholder mode — must be an int (0 or count)
    assert isinstance(data["push_sent_to"], int), f"push_sent_to not int: {data}"
    assert data["push_sent_to"] >= 0
    msg = data["message"]
    assert msg["title"] == title
    assert msg["body"] == body
    assert msg.get("id")
    assert msg.get("cover")  # legacy image fallback applied
    msg_id = msg["id"]

    # Verify appears in public /api/guru/messages
    rpub = requests.get(f"{base_url}/api/guru/messages", timeout=10)
    assert rpub.status_code == 200
    rows = rpub.json()
    match = next((x for x in rows if x.get("id") == msg_id), None)
    assert match is not None, "published guru message not in public feed"
    assert match["title"] == title
    assert match["body"] == body


def test_admin_guru_message_forbidden_for_non_admin(base_url):
    h, _, _ = _seeker_headers(base_url)
    r = requests.post(f"{base_url}/api/admin/guru-messages", headers=h,
                      json={"title": "hax", "body": "attempt"}, timeout=10)
    assert r.status_code == 403


# ---------- /api/register-push ----------

def test_register_push_preview_mode(base_url):
    payload = {
        "user_id": f"TEST_user_{uuid.uuid4().hex[:8]}",
        "platform": "ios",
        "device_token": "TEST_devicetoken_" + uuid.uuid4().hex,
    }
    r = requests.post(f"{base_url}/api/register-push", json=payload, timeout=10)
    assert r.status_code == 201, f"{r.status_code} {r.text}"
    data = r.json()
    assert data.get("status") == "registered"
    assert data.get("mode") == "preview"


def test_register_push_validation(base_url):
    # Missing fields → 422
    r = requests.post(f"{base_url}/api/register-push", json={"user_id": "x"}, timeout=10)
    assert r.status_code == 422


# ---------- Regression ----------

def test_regression_otp_and_me(base_url):
    email = f"TEST_reg_{uuid.uuid4().hex[:8]}@aathman.app"
    token, user = _login(base_url, email)
    # Backend normalizes email to lowercase
    assert token and (user.get("email") or "").lower() == email.lower()
    r = requests.get(f"{base_url}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200
    assert (r.json().get("email") or "").lower() == email.lower()


def test_regression_live_aathman_current(base_url):
    r = requests.get(f"{base_url}/api/live/aathman-current", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("is_live_now", "video_id", "title", "thumbnail", "channel_id"):
        assert k in d
    assert d["channel_id"] == "UCkDostBKd39l9lz8UxpSxBg"
    assert isinstance(d["is_live_now"], bool)


def test_regression_guru_messages_public(base_url):
    r = requests.get(f"{base_url}/api/guru/messages", timeout=10)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        for row in rows[:5]:
            assert "_id" not in row
            assert "id" in row
            assert "title" in row
            assert "body" in row
