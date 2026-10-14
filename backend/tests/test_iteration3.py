"""Iteration 3 tests: points system, live/attend, rank-by-points, monthly-stats,
diary-by-date, Brahmatheerth books, community/info.

Uses per-test fresh user (independent auth headers) so points math is deterministic.
"""
import uuid
from datetime import datetime, timezone


def _fresh_user(api_client, base_url):
    email = f"TEST_iter3_{uuid.uuid4().hex[:8]}@aathman.app"
    r = api_client.post(f"{base_url}/api/auth/send-otp",
                        json={"identifier": email, "method": "email"})
    otp = r.json()["dev_otp"]
    r2 = api_client.post(f"{base_url}/api/auth/verify-otp",
                         json={"identifier": email, "otp": otp, "method": "email"})
    data = r2.json()
    return {
        "email": email,
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}",
                    "Content-Type": "application/json"},
    }


# ----------------- Points / stats/me -----------------
class TestStatsPoints:
    def test_stats_me_has_new_fields(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        r = api_client.get(f"{base_url}/api/stats/me", headers=u["headers"])
        assert r.status_code == 200
        s = r.json()
        for k in ("total_sessions", "total_minutes", "mantra_count", "streak",
                  "points", "live_attended", "breakdown", "rules"):
            assert k in s, f"missing {k}"
        for k in ("live", "meditation", "mantra"):
            assert k in s["breakdown"]
        # rules constants
        assert s["rules"]["live_session"] == 100
        assert s["rules"]["meditation_per_hour"] == 50
        assert s["rules"]["malas_108"] == 50
        # fresh user
        assert s["points"] == 0
        assert s["live_attended"] == 0

    def test_meditation_60min_gives_50_points(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        meds = api_client.get(f"{base_url}/api/meditations").json()
        api_client.post(f"{base_url}/api/meditation/complete",
                        json={"meditation_id": meds[0]["id"], "duration_minutes": 60},
                        headers=u["headers"])
        s = api_client.get(f"{base_url}/api/stats/me", headers=u["headers"]).json()
        assert s["breakdown"]["meditation"] == 50
        assert s["total_minutes"] == 60
        assert s["points"] == 50

    def test_meditation_120min_gives_100_points(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        meds = api_client.get(f"{base_url}/api/meditations").json()
        api_client.post(f"{base_url}/api/meditation/complete",
                        json={"meditation_id": meds[0]["id"], "duration_minutes": 120},
                        headers=u["headers"])
        s = api_client.get(f"{base_url}/api/stats/me", headers=u["headers"]).json()
        assert s["breakdown"]["meditation"] == 100

    def test_mantra_108_chants_rounds_to_zero(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        api_client.post(f"{base_url}/api/mantra/increment",
                        json={"count": 108}, headers=u["headers"])
        s = api_client.get(f"{base_url}/api/stats/me", headers=u["headers"]).json()
        # 108*50/11664 ≈ 0.463 → round to 0
        assert s["breakdown"]["mantra"] == 0
        assert s["mantra_count"] == 108

    def test_mantra_11664_chants_gives_50_points(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        # 108 malas = 108*108 = 11664 chants
        api_client.post(f"{base_url}/api/mantra/increment",
                        json={"count": 11664}, headers=u["headers"])
        s = api_client.get(f"{base_url}/api/stats/me", headers=u["headers"]).json()
        assert s["breakdown"]["mantra"] == 50
        assert s["mantra_count"] == 11664


# ----------------- Live attend -----------------
class TestLiveAttend:
    def test_attend_awards_100_then_idempotent(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        sessions = api_client.get(f"{base_url}/api/live/sessions").json()
        sid = sessions[0]["id"]
        r1 = api_client.post(f"{base_url}/api/live/attend",
                             json={"session_id": sid}, headers=u["headers"])
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1.get("awarded_points") == 100
        assert d1.get("points") == 100

        # 2nd call -> idempotent
        r2 = api_client.post(f"{base_url}/api/live/attend",
                             json={"session_id": sid}, headers=u["headers"])
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already_attended") is True
        assert "awarded_points" not in d2
        assert d2.get("points") == 100  # unchanged

        # stats/me reflect
        s = api_client.get(f"{base_url}/api/stats/me", headers=u["headers"]).json()
        assert s["live_attended"] == 1
        assert s["breakdown"]["live"] == 100
        assert s["points"] == 100

    def test_attend_unknown_session_404(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        r = api_client.post(f"{base_url}/api/live/attend",
                            json={"session_id": "nope-xyz"}, headers=u["headers"])
        assert r.status_code == 404


# ----------------- Rank by points -----------------
class TestRankPoints:
    def test_rank_sorted_by_points_desc(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        # give this user 100 points via live attend
        sessions = api_client.get(f"{base_url}/api/live/sessions").json()
        api_client.post(f"{base_url}/api/live/attend",
                        json={"session_id": sessions[0]["id"]}, headers=u["headers"])
        r = api_client.get(f"{base_url}/api/rank", params={"scope": "national"},
                           headers=u["headers"])
        assert r.status_code == 200
        board = r.json()["leaderboard"]
        assert len(board) >= 1
        # every row has points and mins fields
        for row in board:
            assert "points" in row and "mins" in row
        # sorted desc by points
        pts_list = [row["points"] for row in board]
        assert pts_list == sorted(pts_list, reverse=True)
        # self is included
        assert any(row["user_id"] == u["user"]["id"] for row in board)

    def test_rank_all_scopes_return_leaderboard(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        for scope in ("national", "international", "state", "circle"):
            r = api_client.get(f"{base_url}/api/rank", params={"scope": scope},
                               headers=u["headers"])
            assert r.status_code == 200, f"{scope} failed"
            data = r.json()
            assert data["scope"] == scope
            assert isinstance(data["leaderboard"], list)
            # self always included
            assert any(x["user_id"] == u["user"]["id"] for x in data["leaderboard"]), \
                f"self missing in scope {scope}"


# ----------------- Mood monthly stats -----------------
class TestMoodMonthly:
    def test_monthly_shape_and_totals(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        # 2 calm, 1 happy today
        for m in ("calm", "calm", "happy"):
            api_client.post(f"{base_url}/api/mood",
                            json={"mood": m, "kind": "checkin"}, headers=u["headers"])
        r = api_client.get(f"{base_url}/api/mood/monthly-stats", headers=u["headers"])
        assert r.status_code == 200
        data = r.json()
        assert data["days"] == 30
        assert isinstance(data["series"], list) and len(data["series"]) == 30
        # each item shape
        for it in data["series"]:
            assert "date" in it and "counts" in it
            for k in ("calm", "happy", "grateful", "reflective", "blessed"):
                assert k in it["counts"]
        # totals reflect
        assert data["totals"]["calm"] >= 2
        assert data["totals"]["happy"] >= 1
        # totals equal sum of series
        for k in ("calm", "happy", "grateful", "reflective", "blessed"):
            assert data["totals"][k] == sum(s["counts"][k] for s in data["series"]), k


# ----------------- Diary by date / dates -----------------
class TestDiaryDates:
    def test_diary_date_filter_and_dates_and_single(self, api_client, base_url):
        u = _fresh_user(api_client, base_url)
        today = datetime.now(timezone.utc).date().isoformat()
        # create entry (today's date auto-assigned)
        r = api_client.post(f"{base_url}/api/diary",
                            json={"content": "TEST entry", "mood": "calm"},
                            headers=u["headers"])
        assert r.status_code == 200
        entry = r.json()
        assert entry["date"] == today

        # filter by today
        r2 = api_client.get(f"{base_url}/api/diary", params={"date": today},
                            headers=u["headers"])
        assert r2.status_code == 200
        rows = r2.json()
        assert len(rows) >= 1
        assert all(e["date"] == today for e in rows)
        assert any(e["id"] == entry["id"] for e in rows)

        # dates list includes today
        r3 = api_client.get(f"{base_url}/api/diary/dates", headers=u["headers"])
        assert r3.status_code == 200
        dates = r3.json()
        assert any(d["date"] == today and d["count"] >= 1 for d in dates)

        # single
        r4 = api_client.get(f"{base_url}/api/diary/{entry['id']}", headers=u["headers"])
        assert r4.status_code == 200
        assert r4.json()["id"] == entry["id"]

        # 404
        r5 = api_client.get(f"{base_url}/api/diary/nope-xyz", headers=u["headers"])
        assert r5.status_code == 404


# ----------------- Books (Brahmatheerth) -----------------
class TestBrahmatheerthBooks:
    def test_books_are_9_brahmatheerth_issues(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/books")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 9, f"expected 9 Brahmatheerth issues, got {len(rows)}"
        # sorted by order asc
        orders = [b.get("order") for b in rows]
        assert orders == sorted(orders)
        for b in rows:
            assert b["author"] == "HH Guruji Sundar"
            assert b["price"] == 500
            assert b["kind"] == "magazine"
            assert b["title"].startswith("Brahmatheerth Issue"), b["title"]
            assert b["external_url"].startswith("https://gurujisundar.com/product/"), b["external_url"]


# ----------------- Community info -----------------
class TestCommunityInfo:
    def test_community_info_shape(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/community/info")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "Aathman Awareness Centre"
        assert d["founder"]
        assert d["tagline"]
        assert d["quote"]
        assert d["guru_quote"]
        assert d["about"]
        assert d["hero_image"].startswith("http")
        assert "customer-assets.emergentagent.com" in d["guru_image"], d["guru_image"]
        assert "GurujiSundar" in d["guru_image"] or "guruji" in d["guru_image"].lower()
        assert d["website"].startswith("https://")
        assert d["shop"].startswith("https://")
        assert isinstance(d["courses"], list) and len(d["courses"]) >= 4
        for c in d["courses"]:
            assert c["title"] and c["url"].startswith("http") and c["cover"].startswith("http")
        assert isinstance(d["articles"], list) and len(d["articles"]) >= 3
        assert isinstance(d["socials"], list) and len(d["socials"]) >= 6
        assert isinstance(d["testimonials"], list) and len(d["testimonials"]) >= 2
