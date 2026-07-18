"""Iteration 6 backend tests — YouTube Live Chat mirror endpoint /api/live/aathman-current.

Contract:
- Returns dict with keys: is_live_now, video_id, title, thumbnail, channel_id
- channel_id == 'UCkDostBKd39l9lz8UxpSxBg'
- If video_id present, thumbnail == https://i.ytimg.com/vi/{video_id}/hqdefault.jpg
- is_live_now is bool
- No authentication required, responds under 8s
- In-memory cache TTL 60s: two back-to-back calls return identical data
- Existing /api/live/aathman-channel and /api/live/sessions still work
"""
import time
import requests

CHANNEL_ID = "UCkDostBKd39l9lz8UxpSxBg"
THUMB_FMT = "https://i.ytimg.com/vi/{}/hqdefault.jpg"


# ---- /api/live/aathman-current ----

def test_aathman_current_contract_and_channel_id(base_url):
    t0 = time.monotonic()
    r = requests.get(f"{base_url}/api/live/aathman-current", timeout=10)
    elapsed = time.monotonic() - t0
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    # Required keys
    for k in ("is_live_now", "video_id", "title", "thumbnail", "channel_id"):
        assert k in data, f"missing key {k} in {data}"
    # Types / values
    assert isinstance(data["is_live_now"], bool), f"is_live_now not bool: {type(data['is_live_now'])}"
    assert data["channel_id"] == CHANNEL_ID, f"channel_id mismatch: {data['channel_id']}"
    # Latency
    assert elapsed < 10, f"endpoint too slow: {elapsed:.2f}s"


def test_aathman_current_thumbnail_matches_video_id(base_url):
    r = requests.get(f"{base_url}/api/live/aathman-current", timeout=10)
    assert r.status_code == 200
    data = r.json()
    if data.get("video_id"):
        vid = data["video_id"]
        # Youtube video_id: 11 chars, [a-zA-Z0-9_-]
        assert len(vid) == 11, f"video_id length not 11: {vid!r}"
        assert data["thumbnail"] == THUMB_FMT.format(vid), (
            f"thumbnail mismatch: got {data['thumbnail']} expected {THUMB_FMT.format(vid)}"
        )
    else:
        # Graceful null case allowed per spec (scrape may fail)
        assert data["thumbnail"] is None or data["thumbnail"] == ""
        assert data["is_live_now"] is False


def test_aathman_current_no_auth_required(base_url):
    s = requests.Session()  # no Authorization header
    r = s.get(f"{base_url}/api/live/aathman-current", timeout=10)
    assert r.status_code == 200


def test_aathman_current_cache_two_calls_identical(base_url):
    r1 = requests.get(f"{base_url}/api/live/aathman-current", timeout=10)
    assert r1.status_code == 200
    r2 = requests.get(f"{base_url}/api/live/aathman-current", timeout=10)
    assert r2.status_code == 200
    # Cache TTL 60s — back-to-back calls must return identical payload
    assert r1.json() == r2.json(), f"cache miss: {r1.json()} vs {r2.json()}"


def test_aathman_current_responds_under_8s(base_url):
    t0 = time.monotonic()
    r = requests.get(f"{base_url}/api/live/aathman-current", timeout=10)
    elapsed = time.monotonic() - t0
    assert r.status_code == 200
    # After first call, cache is warm; this call should be well under 8s (usually <100ms).
    assert elapsed < 8, f"endpoint response {elapsed:.2f}s exceeds 8s SLA"


# ---- Regression: pre-existing endpoints still work ----

def test_aathman_channel_still_works(base_url):
    r = requests.get(f"{base_url}/api/live/aathman-channel", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["channel_id"] == CHANNEL_ID
    assert d["handle"] == "@Aathmanawarenesscentre"
    assert "/@Aathmanawarenesscentre/streams" in d["streams_url"]
    assert f"embed/live_stream?channel={CHANNEL_ID}" in d["live_embed_url"]
    assert d.get("channel_url")


def test_live_sessions_still_works(base_url):
    r = requests.get(f"{base_url}/api/live/sessions", timeout=10)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1
    for row in rows:
        assert row.get("youtube_channel_id") == CHANNEL_ID, row
        assert "youtube_id" not in row, f"legacy field leaked: {row}"


def test_live_sessions_kind_filter_still_works(base_url):
    for kind in ("satsang", "yoga"):
        r = requests.get(f"{base_url}/api/live/sessions", params={"kind": kind}, timeout=10)
        assert r.status_code == 200, f"{kind}: {r.status_code}"
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1, f"{kind} empty"
        for row in rows:
            assert row["kind"] == kind
            assert row["youtube_channel_id"] == CHANNEL_ID
