"""Iteration 5 tests: Aathman YouTube channel embed endpoint + live_sessions migration.

Verifies:
- GET /api/live/aathman-channel returns channel_id, handle, streams_url, live_embed_url, channel_url
- GET /api/live/sessions rows all point to Aathman channel and DO NOT have youtube_id
- kind filters (satsang/yoga) each return >=2 rows on the Aathman channel
- POST /api/live/attend: awards 100 on first, idempotent on second (uses a valid session_id)
"""
import pytest

AATHMAN_CHANNEL_ID = "UCkDostBKd39l9lz8UxpSxBg"
AATHMAN_HANDLE = "@Aathmanawarenesscentre"


class TestAathmanChannelEndpoint:
    def test_aathman_channel_shape(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/aathman-channel")
        assert r.status_code == 200, r.text
        data = r.json()

        assert data.get("channel_id") == AATHMAN_CHANNEL_ID
        assert data.get("handle") == AATHMAN_HANDLE

        streams_url = data.get("streams_url", "")
        assert "/@Aathmanawarenesscentre/streams" in streams_url, streams_url

        live_embed_url = data.get("live_embed_url", "")
        assert f"embed/live_stream?channel={AATHMAN_CHANNEL_ID}" in live_embed_url, live_embed_url

        channel_url = data.get("channel_url", "")
        assert channel_url and "Aathmanawarenesscentre" in channel_url


class TestLiveSessionsMigration:
    def test_all_sessions_point_to_aathman_channel(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/sessions")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1, "expected at least one seeded live session"

        for row in rows:
            assert row.get("youtube_channel_id") == AATHMAN_CHANNEL_ID, (
                f"row {row.get('id')} has youtube_channel_id={row.get('youtube_channel_id')}"
            )
            assert "youtube_id" not in row, (
                f"row {row.get('id')} still has legacy youtube_id: {row.get('youtube_id')}"
            )

    def test_satsang_sessions_at_least_two(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/sessions", params={"kind": "satsang"})
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) >= 2, f"expected >=2 satsang rows, got {len(rows)}"
        for row in rows:
            assert row.get("kind") == "satsang"
            assert row.get("youtube_channel_id") == AATHMAN_CHANNEL_ID
            assert "youtube_id" not in row

    def test_yoga_sessions_at_least_two(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/live/sessions", params={"kind": "yoga"})
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) >= 2, f"expected >=2 yoga rows, got {len(rows)}"
        for row in rows:
            assert row.get("kind") == "yoga"
            assert row.get("youtube_channel_id") == AATHMAN_CHANNEL_ID
            assert "youtube_id" not in row


class TestLiveAttendIdempotent:
    def test_attend_awards_100_then_idempotent(self, api_client, base_url, auth_headers):
        # pick a session
        r = api_client.get(f"{base_url}/api/live/sessions")
        assert r.status_code == 200
        rows = r.json()
        assert rows, "need at least one session"
        session_id = rows[0]["id"]

        # first attend
        r1 = api_client.post(
            f"{base_url}/api/live/attend",
            json={"session_id": session_id},
            headers=auth_headers,
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("ok") is True
        assert d1.get("awarded_points") == 100, d1
        pts_after_first = d1.get("points")
        assert isinstance(pts_after_first, int)

        # second attend — idempotent
        r2 = api_client.post(
            f"{base_url}/api/live/attend",
            json={"session_id": session_id},
            headers=auth_headers,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("ok") is True
        assert d2.get("already_attended") is True
        assert "awarded_points" not in d2 or d2.get("awarded_points") in (0, None)
        # points must not increase on the idempotent call
        assert d2.get("points") == pts_after_first, (d2, pts_after_first)


class TestRegressionSpotCheck:
    """Quick sanity that previously-passing endpoints still work."""

    def test_community_info(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/community/info")
        assert r.status_code == 200, r.text

    def test_books_contains_brahmatheerth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/books")
        assert r.status_code == 200, r.text
        titles = " ".join([str(b.get("title", "")) for b in r.json()]).lower()
        assert "brahmatheerth" in titles

    def test_auth_me_requires_token(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("email")

    def test_stats_me_has_points(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/stats/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "points" in d
        assert "breakdown" in d or "rules" in d

    def test_mood_monthly(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/mood/monthly-stats", headers=auth_headers)
        assert r.status_code == 200, r.text

    def test_diary_dates(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/diary/dates", headers=auth_headers)
        assert r.status_code == 200, r.text

    def test_emergent_session_contract_still_intact(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/emergent-session", json={"session_id": ""})
        assert r.status_code == 400
