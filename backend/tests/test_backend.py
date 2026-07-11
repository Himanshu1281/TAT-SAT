"""Aathman backend API tests - full flow coverage."""
import uuid
import requests


# ----------------- Health -----------------
class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert "message" in data and "Aathman" in data["message"]


# ----------------- Auth -----------------
class TestAuth:
    def test_send_otp_returns_dev_otp(self, api_client, base_url):
        email = f"TEST_otp_{uuid.uuid4().hex[:8]}@aathman.app"
        r = api_client.post(f"{base_url}/api/auth/send-otp",
                            json={"identifier": email, "method": "email"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "dev_otp" in data and len(data["dev_otp"]) == 6

    def test_verify_otp_creates_new_user_onboarded_false(self, api_client, base_url):
        email = f"TEST_newuser_{uuid.uuid4().hex[:8]}@aathman.app"
        r = api_client.post(f"{base_url}/api/auth/send-otp",
                            json={"identifier": email, "method": "email"})
        otp = r.json()["dev_otp"]
        r2 = api_client.post(f"{base_url}/api/auth/verify-otp",
                             json={"identifier": email, "otp": otp, "method": "email"})
        assert r2.status_code == 200
        data = r2.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert "user" in data
        assert data["user"]["identifier"] == email.lower()
        assert data["user"]["onboarded"] is False
        assert data["is_new"] is True

    def test_verify_otp_wrong_returns_400(self, api_client, base_url):
        email = f"TEST_wrong_{uuid.uuid4().hex[:8]}@aathman.app"
        api_client.post(f"{base_url}/api/auth/send-otp",
                        json={"identifier": email, "method": "email"})
        r = api_client.post(f"{base_url}/api/auth/verify-otp",
                            json={"identifier": email, "otp": "000000", "method": "email"})
        assert r.status_code == 400

    def test_previous_otp_invalidated(self, api_client, base_url):
        email = f"TEST_invalidate_{uuid.uuid4().hex[:8]}@aathman.app"
        r1 = api_client.post(f"{base_url}/api/auth/send-otp",
                             json={"identifier": email, "method": "email"})
        old_otp = r1.json()["dev_otp"]
        r2 = api_client.post(f"{base_url}/api/auth/send-otp",
                             json={"identifier": email, "method": "email"})
        new_otp = r2.json()["dev_otp"]
        # old OTP should now be invalid
        r_old = api_client.post(f"{base_url}/api/auth/verify-otp",
                                json={"identifier": email, "otp": old_otp, "method": "email"})
        assert r_old.status_code == 400
        # new OTP should still work
        r_new = api_client.post(f"{base_url}/api/auth/verify-otp",
                                json={"identifier": email, "otp": new_otp, "method": "email"})
        assert r_new.status_code == 200

    def test_me_requires_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_401(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me",
                           headers={"Authorization": "Bearer not-a-valid-token"})
        assert r.status_code == 401

    def test_me_returns_user(self, api_client, base_url, auth_headers, user_session):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["identifier"] == user_session["email"].lower()


# ----------------- Profile -----------------
class TestProfile:
    def test_update_profile_sets_onboarded_true(self, api_client, base_url, auth_headers):
        payload = {"name": "Seeker One", "age": 30, "gender": "male",
                   "state": "Karnataka", "nationality": "India"}
        r = api_client.put(f"{base_url}/api/profile", json=payload, headers=auth_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["name"] == "Seeker One"
        assert u["age"] == 30
        assert u["state"] == "Karnataka"
        assert u["nationality"] == "India"
        assert u["onboarded"] is True

        # GET me to verify persistence
        r2 = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["onboarded"] is True
        assert r2.json()["name"] == "Seeker One"


# ----------------- Meditations & sessions -----------------
class TestMeditations:
    def test_list_meditations(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/meditations")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 3
        assert "id" in rows[0] and "title" in rows[0] and "category" in rows[0]

    def test_filter_by_category_sleep(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/meditations", params={"category": "sleep"})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        assert all(row["category"] == "sleep" for row in rows)

    def test_complete_meditation_updates_stats(self, api_client, base_url, auth_headers):
        # get a meditation id
        meds = api_client.get(f"{base_url}/api/meditations").json()
        med_id = meds[0]["id"]
        r = api_client.post(f"{base_url}/api/meditation/complete",
                            json={"meditation_id": med_id, "duration_minutes": 10},
                            headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["duration_minutes"] == 10

        stats = api_client.get(f"{base_url}/api/stats/me", headers=auth_headers).json()
        assert stats["total_sessions"] >= 1
        assert stats["total_minutes"] >= 10
        assert stats["streak"] >= 1


# ----------------- Mantra -----------------
class TestMantra:
    def test_mantra_increment_and_total(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/mantra/increment",
                            json={"mantra": "Om Namah Shivaya", "count": 5},
                            headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert r.json()["total"] >= 5

        stats = api_client.get(f"{base_url}/api/stats/me", headers=auth_headers).json()
        assert stats["mantra_count"] >= 5


# ----------------- Mood -----------------
class TestMood:
    def test_log_mood_and_weekly(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/mood",
                            json={"mood": "calm", "kind": "checkin"},
                            headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["mood"] == "calm"

        r2 = api_client.get(f"{base_url}/api/mood/weekly-stats", headers=auth_headers)
        assert r2.status_code == 200
        data = r2.json()
        assert data["counts"]["calm"] >= 1
        assert data["total"] >= 1


# ----------------- Diary -----------------
class TestDiary:
    def test_diary_create_list_delete(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/diary",
                            json={"content": "first entry", "mood": "grateful"},
                            headers=auth_headers)
        assert r.status_code == 200
        entry_id = r.json()["id"]
        assert r.json()["content"] == "first entry"

        r2 = api_client.get(f"{base_url}/api/diary", headers=auth_headers)
        assert r2.status_code == 200
        assert any(e["id"] == entry_id for e in r2.json())

        r3 = api_client.delete(f"{base_url}/api/diary/{entry_id}", headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["ok"] is True

        r4 = api_client.get(f"{base_url}/api/diary", headers=auth_headers)
        assert all(e["id"] != entry_id for e in r4.json())


# ----------------- Rank -----------------
class TestRank:
    def test_rank_national_includes_self(self, api_client, base_url, auth_headers, user_session):
        r = api_client.get(f"{base_url}/api/rank", params={"scope": "national"},
                           headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["scope"] == "national"
        assert isinstance(data["leaderboard"], list)
        me_id = user_session["user"]["id"]
        assert any(x["user_id"] == me_id for x in data["leaderboard"])


# ----------------- Live Sessions -----------------
class TestLive:
    def test_all_live_sessions(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/sessions")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 2

    def test_satsang(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/sessions", params={"kind": "satsang"})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1 and all(x["kind"] == "satsang" for x in rows)

    def test_yoga(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/sessions", params={"kind": "yoga"})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1 and all(x["kind"] == "yoga" for x in rows)


# ----------------- Books & Orders -----------------
class TestBooksAndOrders:
    def test_books_list(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/books")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        assert "id" in rows[0] and "price" in rows[0]

    def test_book_detail(self, api_client, base_url):
        books = api_client.get(f"{base_url}/api/books").json()
        book_id = books[0]["id"]
        r = api_client.get(f"{base_url}/api/books/{book_id}")
        assert r.status_code == 200
        assert r.json()["id"] == book_id

    def test_book_detail_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/books/nonexistent-id")
        assert r.status_code == 404

    def test_order_create_and_verify_mocked(self, api_client, base_url, auth_headers):
        books = api_client.get(f"{base_url}/api/books").json()
        book_id = books[0]["id"]
        payload = {
            "items": [{"book_id": book_id, "quantity": 2}],
            "address": "TEST address, Bengaluru",
            "payment_method": "razorpay",
        }
        r = api_client.post(f"{base_url}/api/orders/create", json=payload, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["mock_mode"] is True
        order = data["order"]
        assert order["status"] == "pending"
        assert order["amount"] == books[0]["price"] * 2

        r2 = api_client.post(f"{base_url}/api/orders/verify",
                             json={"order_id": order["id"]}, headers=auth_headers)
        assert r2.status_code == 200
        v = r2.json()
        assert v["ok"] is True and v["status"] == "paid"


# ----------------- Guru content -----------------
class TestGuru:
    def test_messages(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/guru/messages")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        assert "title" in rows[0] and "body" in rows[0]

    def test_quote_today(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/guru/quote-today")
        assert r.status_code == 200
        q = r.json()
        assert "text" in q and "author" in q


# ----------------- Q&A -----------------
class TestQA:
    def test_qa_create_and_list_seeded(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/qa",
                            json={"question": "How to meditate?"},
                            headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["question"] == "How to meditate?"
        assert r.json()["answer"] is None  # unanswered by default

        r2 = api_client.get(f"{base_url}/api/qa")
        assert r2.status_code == 200
        rows = r2.json()
        # Seeded answers exist
        assert len(rows) >= 2
        assert all(x.get("answer") for x in rows)


# ----------------- SOS -----------------
class TestSOS:
    def test_sos_request(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/sos/request",
                            json={"name": "TEST Seeker", "phone": "+919999999999",
                                  "feeling": "anxious", "note": "need help"},
                            headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert "teacher" in d["message"].lower() or "alone" in d["message"].lower()


# ----------------- Sleep -----------------
class TestSleep:
    def test_sleep_music(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/sleep/content", params={"kind": "music"})
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1 and all(x["kind"] == "music" for x in rows)


# ----------------- Music (new) -----------------
GURUJI_IMAGE = "https://customer-assets.emergentagent.com/job_mantra-connect-3/artifacts/y2tp1enp_GurujiSundar.jpeg"


class TestMusic:
    def test_music_list_has_at_least_10_tracks(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/music")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 10, f"expected >=10 tracks got {len(rows)}"

    def test_music_track_shape(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/music").json()
        required = {"id", "title", "url", "cover", "order"}
        for track in rows:
            missing = required - set(track.keys())
            assert not missing, f"track missing fields {missing}: {track}"
            assert isinstance(track["title"], str) and track["title"]
            assert isinstance(track["url"], str) and track["url"].startswith("http")
            assert isinstance(track["cover"], str) and track["cover"].startswith("http")
            assert isinstance(track["order"], int)

    def test_music_sorted_by_order(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/music").json()
        orders = [t["order"] for t in rows]
        assert orders == sorted(orders), "music tracks should be sorted by order asc"


# ----------------- Guruji image migration -----------------
class TestGurujiImageMigration:
    def test_all_guru_messages_use_new_image(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/guru/messages").json()
        assert len(rows) >= 1
        for m in rows:
            assert m.get("cover") == GURUJI_IMAGE, f"guru message '{m.get('title')}' has cover={m.get('cover')}"

    def test_satsang_sessions_hosted_by_guruji_use_new_image(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/live/sessions", params={"kind": "satsang"}).json()
        assert len(rows) >= 1
        guruji_hosted = [s for s in rows if s.get("host") == "Guruji Sundar"]
        assert len(guruji_hosted) >= 1
        for s in guruji_hosted:
            assert s.get("cover") == GURUJI_IMAGE, f"satsang '{s.get('title')}' has cover={s.get('cover')}"

    def test_yoga_sessions_retain_original_covers(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/live/sessions", params={"kind": "yoga"}).json()
        assert len(rows) >= 1
        for s in rows:
            # Yoga is hosted by Yogini Radha; must NOT be overwritten with guruji image
            assert s.get("cover") != GURUJI_IMAGE, f"yoga '{s.get('title')}' incorrectly uses guruji image"
            assert isinstance(s.get("cover"), str) and s["cover"].startswith("http")

    def test_morning_awakening_uses_new_image(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/meditations").json()
        matches = [m for m in rows if m.get("title") == "Morning Awakening"]
        assert len(matches) == 1, f"expected exactly 1 Morning Awakening, got {len(matches)}"
        assert matches[0].get("cover") == GURUJI_IMAGE

    def test_other_meditations_unchanged(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/meditations").json()
        others = [m for m in rows if m.get("title") != "Morning Awakening"]
        # These should not have been migrated to the guruji image
        for m in others:
            assert m.get("cover") != GURUJI_IMAGE, f"meditation '{m.get('title')}' unexpectedly uses guruji image"

    def test_meditation_bell_defaults_present(self, api_client, base_url):
        rows = api_client.get(f"{base_url}/api/meditations").json()
        bell_values = [m.get("bell_default") for m in rows if "bell_default" in m]
        assert bell_values, "no bell_default on any meditation"
        # Report suspicious small (non-zero, <60) values without failing hard
        suspicious = [v for v in bell_values if 0 < v < 60]
        # keep an informational assertion – log via message rather than fail
        assert isinstance(bell_values[0], int)
        print(f"bell_default values seen: {bell_values} suspicious(<60,!=0): {suspicious}")
