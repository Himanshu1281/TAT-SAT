from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import re
import string
import hmac
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt as pyjwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ------------ Config ------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET or JWT_SECRET.lower() in {"change-me", "changeme", "placeholder"}:
    raise RuntimeError("JWT_SECRET is required and must be set to a strong random value in the environment.")
JWT_ALG = 'HS256'
JWT_EXP_DAYS = 30

GURUJI_IMAGE = "https://customer-assets.emergentagent.com/job_mantra-connect-3/artifacts/y2tp1enp_GurujiSundar.jpeg"

SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@aathman.app')
SENDGRID_FROM_NAME = os.environ.get('SENDGRID_FROM_NAME', 'Aathman')
# The app signs in with Google only. OTP login is for dev/testing only (OTP_DEV_MODE=true).
OTP_DEV_MODE = os.environ.get('OTP_DEV_MODE', 'false').lower() == 'true'

RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()}
EMERGENT_PUSH_KEY = os.environ.get('EMERGENT_PUSH_KEY', 'placeholder')
EMERGENT_PUSH_BASE_URL = 'https://integrations.emergentagent.com'

app = FastAPI(title="Aathman API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ------------ Helpers ------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=JWT_EXP_DAYS)).timestamp()),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def send_otp_email(to_email: str, otp: str) -> bool:
    if not SENDGRID_API_KEY:
        logger.info(f"[DEV] OTP for {to_email}: {otp}")
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        html = f"""
        <div style="font-family: Inter, Arial; background:#F7F6F2; padding:32px; color:#1A1A1A;">
          <h2 style="color:#FFBA3D; margin:0 0 8px;">Aathman</h2>
          <p>Namaste,</p>
          <p>Your verification code is:</p>
          <div style="font-size:32px; font-weight:700; letter-spacing:8px; margin:16px 0; color:#7861FF;">{otp}</div>
          <p style="font-size:12px; color:#666;">This code expires in 10 minutes.</p>
        </div>
        """
        msg = Mail(
            from_email=(SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME),
            to_emails=to_email,
            subject="Aathman - Your Verification Code",
            html_content=html,
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(msg)
        return True
    except Exception as e:
        logger.error(f"SendGrid error: {e}")
        return False


# ------------ Models ------------
class SendOtpBody(BaseModel):
    identifier: str  # email or phone
    method: Literal["email", "phone"] = "email"


class VerifyOtpBody(BaseModel):
    identifier: str
    otp: str
    method: Literal["email", "phone"] = "email"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    gender: Optional[str] = None
    state: Optional[str] = None
    nationality: Optional[str] = None
    avatar: Optional[str] = None


class DiaryEntry(BaseModel):
    title: Optional[str] = ""
    content: str
    mood: Optional[str] = None
    date: Optional[str] = None  # ISO date string


class MoodBody(BaseModel):
    mood: str  # calm, happy, grateful, reflective, blessed
    kind: Literal["checkin", "checkout"] = "checkin"
    note: Optional[str] = ""


class MeditationCompleteBody(BaseModel):
    meditation_id: str
    duration_minutes: int


class MantraIncrementBody(BaseModel):
    mantra: Optional[str] = "Om Namah Shivaya"
    count: int = 1


class QAPost(BaseModel):
    question: str



class CartItem(BaseModel):
    book_id: str
    quantity: int = 1


class CheckoutBody(BaseModel):
    items: List[CartItem]
    address: str
    payment_method: Literal["razorpay", "cod"] = "razorpay"


class VerifyPaymentBody(BaseModel):
    order_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


# ------------ Auth ------------
@api.post("/auth/send-otp")
async def send_otp(body: SendOtpBody):
    identifier = body.identifier.strip().lower()
    if not identifier:
        raise HTTPException(400, "identifier required")
    if not OTP_DEV_MODE:
        raise HTTPException(403, "Please sign in with Google")
    otp = "".join(random.choices(string.digits, k=6))
    doc = {
        "id": new_id(),
        "identifier": identifier,
        "method": body.method,
        "otp": otp,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=10),
        "used": False,
    }
    # invalidate previous OTPs
    await db.otps.update_many({"identifier": identifier, "used": False}, {"$set": {"used": True}})
    await db.otps.insert_one(doc)
    sent = False
    if body.method == "email":
        sent = send_otp_email(identifier, otp)
    # Only reachable in dev mode, so the OTP is returned for testing
    return {"ok": True, "sent": sent, "method": body.method, "dev_otp": otp}


@api.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtpBody):
    identifier = body.identifier.strip().lower()
    if not OTP_DEV_MODE:
        raise HTTPException(403, "Please sign in with Google")
    doc = await db.otps.find_one(
        {"identifier": identifier, "otp": body.otp, "used": False},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not doc:
        raise HTTPException(400, "Invalid OTP")
    expires = doc["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now_utc():
        raise HTTPException(400, "OTP expired")
    await db.otps.update_one({"id": doc["id"]}, {"$set": {"used": True}})

    user = await db.users.find_one({"identifier": identifier}, {"_id": 0})
    # Google accounts sign in only via Google; OTP must never open them (OTP is returned in dev mode)
    if user and user.get("method") == "google":
        raise HTTPException(403, "This account uses Google sign-in")
    is_new = False
    if not user:
        is_new = True
        user = {
            "id": new_id(),
            "identifier": identifier,
            "method": body.method,
            "email": identifier if body.method == "email" else None,
            "phone": identifier if body.method == "phone" else None,
            "name": "",
            "age": None,
            "sex": None,
            "gender": None,
            "state": None,
            "nationality": "India",
            "avatar": None,
            "created_at": now_utc(),
            "onboarded": False,
            "streak": 0,
            "last_active_date": None,
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    token = make_token(user["id"])
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = iso(user["created_at"])
    if user.get("last_active_date") and isinstance(user["last_active_date"], datetime):
        user["last_active_date"] = iso(user["last_active_date"])
    return {"token": token, "user": user, "is_new": is_new}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = iso(user["created_at"])
    if user.get("last_active_date") and isinstance(user["last_active_date"], datetime):
        user["last_active_date"] = iso(user["last_active_date"])
    return user


class EmergentSessionBody(BaseModel):
    session_id: str


@api.post("/auth/emergent-session")
async def emergent_session(body: EmergentSessionBody):
    """Exchange an Emergent Auth session_id for our app JWT.

    Calls Emergent's session-data endpoint to verify and pull the user profile,
    upserts the user in MongoDB, and returns a JWT the client uses for all
    subsequent /api requests.
    """
    import httpx
    if not body.session_id:
        raise HTTPException(400, "session_id required")
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid or expired session")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Emergent Auth error: {e}")
        raise HTTPException(502, "Auth provider unreachable")

    email = (data.get("email") or "").strip().lower()
    name = data.get("name") or ""
    picture = data.get("picture") or None
    if not email:
        raise HTTPException(400, "Google account did not return an email")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    is_new = False
    if not user:
        is_new = True
        user = {
            "id": new_id(),
            "identifier": email,
            "method": "google",
            "email": email,
            "phone": None,
            "name": name,
            "age": None,
            "sex": None,
            "gender": None,
            "state": None,
            "nationality": "India",
            "avatar": picture,
            "created_at": now_utc(),
            "onboarded": False,
            "streak": 0,
            "last_active_date": None,
        }
        await db.users.insert_one(user)
        user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    else:
        # Sync latest google profile bits without overwriting user's chosen name if already set
        updates: dict = {}
        # Once Google proves ownership of this email, OTP can no longer open the account
        if user.get("method") != "google":
            updates["method"] = "google"
        if not user.get("name") and name:
            updates["name"] = name
        if picture and picture != user.get("avatar"):
            updates["avatar"] = picture
        if updates:
            await db.users.update_one({"id": user["id"]}, {"$set": updates})
            user = await db.users.find_one({"id": user["id"]}, {"_id": 0})

    token = make_token(user["id"])
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = iso(user["created_at"])
    if user.get("last_active_date") and isinstance(user["last_active_date"], datetime):
        user["last_active_date"] = iso(user["last_active_date"])
    return {"token": token, "user": user, "is_new": is_new}


# ------------ Profile ------------
@api.put("/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        update["onboarded"] = True
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if isinstance(updated.get("created_at"), datetime):
        updated["created_at"] = iso(updated["created_at"])
    return updated


# ------------ Diary ------------
@api.get("/diary")
async def list_diary(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: dict = {"user_id": user["id"]}
    if date:
        q["date"] = date
    entries = await db.diary.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for e in entries:
        if isinstance(e.get("created_at"), datetime):
            e["created_at"] = iso(e["created_at"])
    return entries


@api.get("/diary/dates")
async def diary_dates(user: dict = Depends(get_current_user)):
    """Return list of distinct dates that have diary entries + count per date."""
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
    ]
    out = []
    async for r in db.diary.aggregate(pipeline):
        out.append({"date": r["_id"], "count": int(r["count"])})
    return out


@api.get("/diary/{entry_id}")
async def get_diary(entry_id: str, user: dict = Depends(get_current_user)):
    e = await db.diary.find_one({"id": entry_id, "user_id": user["id"]}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Not found")
    if isinstance(e.get("created_at"), datetime):
        e["created_at"] = iso(e["created_at"])
    return e


@api.post("/diary")
async def create_diary(body: DiaryEntry, user: dict = Depends(get_current_user)):
    entry = {
        "id": new_id(),
        "user_id": user["id"],
        "title": body.title or "",
        "content": body.content,
        "mood": body.mood,
        "date": body.date or now_utc().date().isoformat(),
        "created_at": now_utc(),
    }
    await db.diary.insert_one(entry.copy())
    entry["created_at"] = iso(entry["created_at"])
    return entry


@api.delete("/diary/{entry_id}")
async def delete_diary(entry_id: str, user: dict = Depends(get_current_user)):
    await db.diary.delete_one({"id": entry_id, "user_id": user["id"]})
    return {"ok": True}


# ------------ Mood ------------
@api.post("/mood")
async def log_mood(body: MoodBody, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "mood": body.mood,
        "kind": body.kind,
        "note": body.note or "",
        "created_at": now_utc(),
    }
    await db.moods.insert_one(doc.copy())
    doc["created_at"] = iso(doc["created_at"])
    return doc


@api.get("/mood/history")
async def mood_history(user: dict = Depends(get_current_user)):
    rows = await db.moods.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = iso(r["created_at"])
    return rows


@api.get("/mood/weekly-stats")
async def mood_weekly(user: dict = Depends(get_current_user)):
    since = now_utc() - timedelta(days=7)
    rows = await db.moods.find({"user_id": user["id"], "created_at": {"$gte": since}}, {"_id": 0}).to_list(500)
    counts = {"calm": 0, "happy": 0, "grateful": 0, "reflective": 0, "blessed": 0}
    for r in rows:
        m = (r.get("mood") or "").lower()
        if m in counts:
            counts[m] += 1
    return {"since": iso(since), "counts": counts, "total": sum(counts.values())}


@api.get("/mood/monthly-stats")
async def mood_monthly(user: dict = Depends(get_current_user)):
    """Return daily mood counts for the last 30 days."""
    days = 30
    since = now_utc() - timedelta(days=days)
    rows = await db.moods.find({"user_id": user["id"], "created_at": {"$gte": since}}, {"_id": 0}).to_list(2000)
    # Bucket by date
    buckets: dict = {}
    for r in rows:
        c = r.get("created_at")
        if isinstance(c, str):
            try:
                c = datetime.fromisoformat(c)
            except Exception:
                continue
        d = c.date().isoformat()
        b = buckets.setdefault(d, {"calm": 0, "happy": 0, "grateful": 0, "reflective": 0, "blessed": 0})
        m = (r.get("mood") or "").lower()
        if m in b:
            b[m] += 1
    # Fill missing days with zero
    today = now_utc().date()
    series = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        series.append({"date": d, "counts": buckets.get(d, {"calm": 0, "happy": 0, "grateful": 0, "reflective": 0, "blessed": 0})})
    totals = {"calm": 0, "happy": 0, "grateful": 0, "reflective": 0, "blessed": 0}
    for s in series:
        for k, v in s["counts"].items():
            totals[k] += v
    return {"since": iso(since), "days": days, "series": series, "totals": totals}


# ------------ Meditation ------------
@api.get("/meditations")
async def list_meditations(category: Optional[str] = None):
    q = {}
    if category and category.lower() != "all":
        q["category"] = category.lower()
    rows = await db.meditations.find(q, {"_id": 0}).to_list(200)
    return rows


@api.post("/meditation/complete")
async def complete_meditation(body: MeditationCompleteBody, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "meditation_id": body.meditation_id,
        "duration_minutes": body.duration_minutes,
        "created_at": now_utc(),
    }
    await db.sessions.insert_one(doc.copy())
    await _bump_streak(user["id"])
    doc["created_at"] = iso(doc["created_at"])
    return doc


async def _bump_streak(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    today = now_utc().date()
    last = user.get("last_active_date")
    if isinstance(last, str):
        try:
            last = datetime.fromisoformat(last)
        except Exception:
            last = None
    last_date = last.date() if isinstance(last, datetime) else None
    streak = user.get("streak", 0)
    if last_date == today:
        return
    if last_date == today - timedelta(days=1):
        streak += 1
    else:
        streak = 1
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"streak": streak, "last_active_date": now_utc()}},
    )


# ------------ Mantra Jaap ------------
@api.post("/mantra/increment")
async def mantra_inc(body: MantraIncrementBody, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "mantra": body.mantra or "Om Namah Shivaya",
        "count": body.count,
        "created_at": now_utc(),
    }
    await db.mantras.insert_one(doc.copy())
    total = await _mantra_total(user["id"])
    return {"ok": True, "total": total}


async def _mantra_total(user_id: str) -> int:
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$count"}}},
    ]
    async for row in db.mantras.aggregate(pipeline):
        return int(row.get("total", 0))
    return 0


# ------------ Points ------------
POINTS_PER_LIVE = 100
POINTS_PER_MED_HOUR = 50
POINTS_PER_108_MALAS = 50  # 108 malas = 108 * 108 chants


async def _compute_points(user_id: str) -> dict:
    """Compute total points and breakdown for a user."""
    # Live attendances
    live_attended = await db.live_attend.count_documents({"user_id": user_id})
    # Meditation minutes
    total_mins = 0
    async for row in db.sessions.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "m": {"$sum": "$duration_minutes"}}},
    ]):
        total_mins = int(row.get("m", 0))
    # Mantra chants
    mantra_total = await _mantra_total(user_id)
    live_pts = live_attended * POINTS_PER_LIVE
    med_pts = round(total_mins * POINTS_PER_MED_HOUR / 60)
    mantra_pts = round(mantra_total * POINTS_PER_108_MALAS / (108 * 108))
    total = live_pts + med_pts + mantra_pts
    return {
        "total": int(total),
        "live_points": int(live_pts),
        "meditation_points": int(med_pts),
        "mantra_points": int(mantra_pts),
        "live_attended": int(live_attended),
        "total_minutes": int(total_mins),
        "mantra_count": int(mantra_total),
    }


# ------------ Stats & Rank ------------
@api.get("/stats/me")
async def stats_me(user: dict = Depends(get_current_user)):
    sessions = await db.sessions.count_documents({"user_id": user["id"]})
    pts = await _compute_points(user["id"])
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "total_sessions": sessions,
        "total_minutes": pts["total_minutes"],
        "mantra_count": pts["mantra_count"],
        "streak": fresh.get("streak", 0),
        "points": pts["total"],
        "live_attended": pts["live_attended"],
        "breakdown": {
            "live": pts["live_points"],
            "meditation": pts["meditation_points"],
            "mantra": pts["mantra_points"],
        },
        "rules": {
            "live_session": POINTS_PER_LIVE,
            "meditation_per_hour": POINTS_PER_MED_HOUR,
            "malas_108": POINTS_PER_108_MALAS,
        },
    }


@api.get("/rank")
async def rank(scope: str = "national", user: dict = Depends(get_current_user)):
    # Gather all users who have any activity + include self
    user_ids: set = set([user["id"]])
    async for r in db.sessions.aggregate([{"$group": {"_id": "$user_id"}}]):
        user_ids.add(r["_id"])
    async for r in db.mantras.aggregate([{"$group": {"_id": "$user_id"}}]):
        user_ids.add(r["_id"])
    async for r in db.live_attend.aggregate([{"$group": {"_id": "$user_id"}}]):
        user_ids.add(r["_id"])
    rows = []
    for uid in user_ids:
        u = await db.users.find_one({"id": uid}, {"_id": 0})
        if not u:
            continue
        # Scope filter
        if scope == "circle" and u["id"] != user["id"]:
            continue
        if scope == "state" and u.get("state") and user.get("state") and u.get("state") != user.get("state"):
            continue
        if scope == "national" and u.get("nationality") and user.get("nationality"):
            if u.get("nationality") != user.get("nationality"):
                continue
        pts = await _compute_points(uid)
        rows.append({
            "user_id": u["id"],
            "name": u.get("name") or "Seeker",
            "state": u.get("state"),
            "nationality": u.get("nationality"),
            "avatar": u.get("avatar"),
            "points": pts["total"],
            "mins": pts["total_minutes"],
        })
    rows.sort(key=lambda x: -x["points"])
    for i, r in enumerate(rows[:50]):
        r["rank"] = i + 1
    return {"scope": scope, "leaderboard": rows[:50]}


# ------------ Live Satsang & Yoga ------------
@api.get("/live/sessions")
async def live_sessions(kind: Optional[str] = None):
    q = {}
    if kind:
        q["kind"] = kind
    rows = await db.live_sessions.find(q, {"_id": 0}).sort("start_at", 1).to_list(50)
    # The stored is_live flag is seed data; real status comes from the channel scrape.
    live_now = (await _scrape_aathman_live()).get("is_live_now", False)
    now = now_utc()
    for r in rows:
        start = r.get("start_at")
        if isinstance(start, datetime):
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            # Sessions are weekly: roll past dates forward to the next occurrence.
            if start < now:
                start += timedelta(weeks=((now - start) // timedelta(weeks=1)) + 1)
            r["start_at"] = iso(start)
        r["is_live"] = bool(live_now and r.get("youtube_channel_id") == AATHMAN_YOUTUBE_CHANNEL_ID)
    rows.sort(key=lambda r: r.get("start_at") or "")
    return rows


@api.get("/live/aathman-channel")
async def aathman_channel():
    """Return the Aathman Awareness Centre YouTube channel embed info."""
    return {
        "channel_id": AATHMAN_YOUTUBE_CHANNEL_ID,
        "handle": "@Aathmanawarenesscentre",
        "streams_url": AATHMAN_YOUTUBE_STREAMS_URL,
        "live_embed_url": f"https://www.youtube.com/embed/live_stream?channel={AATHMAN_YOUTUBE_CHANNEL_ID}&autoplay=1&playsinline=1",
        "channel_url": "https://www.youtube.com/@Aathmanawarenesscentre",
    }


# Cached scraping of the channel's /live page — refreshes at most once every 60s
_LIVE_CACHE: dict = {"at": 0.0, "data": None}
_LIVE_TTL = 60.0
import asyncio as _asyncio
_LIVE_LOCK = _asyncio.Lock()


async def _scrape_aathman_live() -> dict:
    import time as _t
    import re as _re
    import httpx as _httpx
    now = _t.monotonic()
    if _LIVE_CACHE["data"] and (now - _LIVE_CACHE["at"]) < _LIVE_TTL:
        return _LIVE_CACHE["data"]
    async with _LIVE_LOCK:
        # Double-check inside lock
        now = _t.monotonic()
        if _LIVE_CACHE["data"] and (now - _LIVE_CACHE["at"]) < _LIVE_TTL:
            return _LIVE_CACHE["data"]
        result = {
            "is_live_now": False,
            "video_id": None,
            "title": None,
            "thumbnail": None,
            "channel_id": AATHMAN_YOUTUBE_CHANNEL_ID,
        }
        try:
            async with _httpx.AsyncClient(
                timeout=8,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            ) as http:
                r = await http.get("https://www.youtube.com/@Aathmanawarenesscentre/live")
            html = r.text or ""
            # Prefer the canonical URL (most reliable)
            m = _re.search(r'"canonicalUrl":"https://www\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})', html)
            if not m:
                m = _re.search(r'<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})', html)
            if not m:
                m = _re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if m:
                result["video_id"] = m.group(1)
            # Detect actual live state — require strong signals (currently broadcasting).
            # Bare "isLive":true can also mean an *upcoming* premiere/stream, so we require
            # concurrent viewers or the explicit "watching now" text.
            if (
                '"isLiveNow":true' in html
                or '"concurrentViewers"' in html
                or 'watching now' in html.lower()
            ):
                result["is_live_now"] = True
            # Title
            t = _re.search(r'"videoPrimaryInfoRenderer".*?"title":\{"runs":\[\{"text":"([^"]+)"', html)
            if not t:
                t = _re.search(r'<meta name="title" content="([^"]+)"', html)
            if t:
                result["title"] = t.group(1)
            if result["video_id"]:
                result["thumbnail"] = f"https://i.ytimg.com/vi/{result['video_id']}/hqdefault.jpg"
        except Exception as e:
            logger.info(f"scrape live failed: {e}")
        _LIVE_CACHE["data"] = result
        _LIVE_CACHE["at"] = _t.monotonic()
        return result


@api.get("/live/aathman-current")
async def aathman_current():
    """Best-effort detection of the currently-live (or latest) Aathman stream.

    Returns {is_live_now, video_id, title, thumbnail, channel_id}. Freshness: 60s.
    Uses lightweight scraping — no YouTube API key, no quota."""
    data = await _scrape_aathman_live()
    return data


class LiveAttendBody(BaseModel):
    session_id: str


@api.post("/live/attend")
async def live_attend(body: LiveAttendBody, user: dict = Depends(get_current_user)):
    """Mark a user as attended for a live session. Idempotent per user/session."""
    existing = await db.live_attend.find_one({"user_id": user["id"], "session_id": body.session_id}, {"_id": 0})
    if existing:
        pts = await _compute_points(user["id"])
        return {"ok": True, "already_attended": True, "points": pts["total"]}
    session = await db.live_sessions.find_one({"id": body.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Session not found")
    # Only award attendance while the stream is actually broadcasting.
    if not (await _scrape_aathman_live()).get("is_live_now"):
        pts = await _compute_points(user["id"])
        return {"ok": False, "not_live": True, "points": pts["total"]}
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "session_id": body.session_id,
        "session_title": session.get("title"),
        "created_at": now_utc(),
    }
    await db.live_attend.insert_one(doc.copy())
    pts = await _compute_points(user["id"])
    return {"ok": True, "awarded_points": POINTS_PER_LIVE, "points": pts["total"]}


# ------------ Books ------------
@api.get("/books")
async def list_books():
    rows = await db.books.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return rows


@api.get("/books/{book_id}")
async def get_book(book_id: str):
    b = await db.books.find_one({"id": book_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    return b


@api.post("/orders/create")
async def create_order(body: CheckoutBody, user: dict = Depends(get_current_user)):
    total = 0
    items_snapshot = []
    for it in body.items:
        b = await db.books.find_one({"id": it.book_id}, {"_id": 0})
        if not b:
            raise HTTPException(400, f"Book {it.book_id} not found")
        total += int(b["price"]) * it.quantity
        items_snapshot.append({
            "book_id": b["id"], "title": b["title"], "price": b["price"],
            "quantity": it.quantity, "cover": b.get("cover"),
        })
    order_id = new_id()
    razorpay_order_id = None
    # If razorpay keys present, create actual order
    if body.payment_method == "razorpay" and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        try:
            import razorpay
            rp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            r_order = rp.order.create({
                "amount": total * 100,
                "currency": "INR",
                "receipt": order_id,
                "payment_capture": 1,
            })
            razorpay_order_id = r_order.get("id")
        except Exception as e:
            logger.error(f"Razorpay order create error: {e}")
    doc = {
        "id": order_id,
        "user_id": user["id"],
        "items": items_snapshot,
        "amount": total,
        "currency": "INR",
        "address": body.address,
        "payment_method": body.payment_method,
        "razorpay_order_id": razorpay_order_id,
        # COD orders are confirmed immediately and paid on delivery
        "status": "cod_confirmed" if body.payment_method == "cod" else "pending",
        "created_at": now_utc(),
    }
    await db.orders.insert_one(doc.copy())
    doc["created_at"] = iso(doc["created_at"])
    return {
        "order": doc,
        "razorpay_key_id": RAZORPAY_KEY_ID or None,
        "mock_mode": not (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET),
    }


@api.post("/orders/verify")
async def verify_order(body: VerifyPaymentBody, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": body.order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    verified = False
    if order.get("razorpay_order_id") and body.razorpay_payment_id and body.razorpay_signature and RAZORPAY_KEY_SECRET:
        try:
            expected = hmac.new(
                RAZORPAY_KEY_SECRET.encode(),
                f"{order['razorpay_order_id']}|{body.razorpay_payment_id}".encode(),
                hashlib.sha256,
            ).hexdigest()
            verified = hmac.compare_digest(expected, body.razorpay_signature)
        except Exception:
            verified = False
    if order.get("payment_method") == "cod":
        return {"ok": True, "status": order.get("status")}
    await db.orders.update_one(
        {"id": body.order_id},
        {"$set": {"status": "paid" if verified else "failed", "paid_at": now_utc(), "razorpay_payment_id": body.razorpay_payment_id}},
    )
    return {"ok": verified, "status": "paid" if verified else "failed"}


@api.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    """Permanently delete the signed-in user's account and personal data (Google Play requirement)."""
    uid = user["id"]
    for coll in (db.diary, db.moods, db.sessions, db.mantras, db.live_attend, db.orders, db.qa):
        await coll.delete_many({"user_id": uid})
    if user.get("identifier"):
        await db.otps.delete_many({"identifier": user["identifier"]})
    await db.users.delete_one({"id": uid})
    return {"ok": True}


@api.get("/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    rows = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = iso(r["created_at"])
        if r.get("paid_at") and isinstance(r["paid_at"], datetime):
            r["paid_at"] = iso(r["paid_at"])
    return rows


# ------------ Guru content ------------
@api.get("/guru/messages")
async def guru_messages():
    rows = await db.guru_messages.find({}, {"_id": 0}).sort("published_at", -1).to_list(50)
    for r in rows:
        if isinstance(r.get("published_at"), datetime):
            r["published_at"] = iso(r["published_at"])
    return rows


@api.get("/guru/quote-today")
async def quote_today():
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(200)
    if not quotes:
        return {"text": "Silence is the language of God.", "author": "Guruji Sundar"}
    idx = now_utc().timetuple().tm_yday % len(quotes)
    return quotes[idx]


# ------------ Q&A ------------
@api.get("/qa")
async def list_qa():
    rows = await db.qa.find({"answer": {"$ne": None}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = iso(r["created_at"])
    return rows


@api.post("/qa")
async def post_qa(body: QAPost, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "user_name": user.get("name") or "Seeker",
        "question": body.question,
        "answer": None,
        "created_at": now_utc(),
    }
    await db.qa.insert_one(doc.copy())
    doc["created_at"] = iso(doc["created_at"])
    return doc


# ------------ Sleep content ------------
@api.get("/sleep/content")
async def sleep_content(kind: Optional[str] = None):
    q = {}
    if kind:
        q["kind"] = kind
    rows = await db.sleep_content.find(q, {"_id": 0}).to_list(100)
    return rows


# ------------ Music ------------
@api.get("/music")
async def list_music():
    rows = await db.music.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return rows


# ------------ Community (Aathman Awareness Centre) ------------
@api.get("/community/info")
async def community_info():
    """Info about Aathman Awareness Centre and Guruji Sundar's teachings.
    Sourced from https://www.aathmanawarenesscentre.com/ and https://gurujisundar.com/"""
    return {
        "name": "Aathman Awareness Centre",
        "founder": "HH Guruji Sundar",
        "tagline": "A sanctuary for seekers of truth to venture on the path of self-realisation.",
        "quote": "Every living being is qualified to get enlightened. It is their birthright.",
        "quote_author": "HH Guruji Sundar",
        "guru_quote": "'I' ceased to exist long time ago. Only 'He' dwells in my body. 'I' exists only as a namesake.",
        "about": "At Aathman Awareness Centre (AAC), we are dedicated to guiding individuals on the path of self-realisation under the direct guidance of His Holiness Guruji Sundar. We help seekers from all walks of life discover their true selves through techniques ranging from Chakra Meditation to Awareness About Atman.",
        "hero_image": "https://static.wixstatic.com/media/82dd0e_1c4089b01f1848a397079660959c5249~mv2.jpg/v1/fill/w_953,h_683,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/82dd0e_1c4089b01f1848a397079660959c5249~mv2.jpg",
        "guru_image": GURUJI_IMAGE,
        "website": "https://www.aathmanawarenesscentre.com/",
        "shop": "https://gurujisundar.com/shop/",
        "courses": [
            {
                "id": "bky",
                "title": "Basic Kundalini Yoga (BKY)",
                "description": "Learn the art of balancing the Kundalini energy in your body.",
                "cover": "https://static.wixstatic.com/media/nsplsh_a68ac7432d6c45c7a59274d20431bd24~mv2.jpg/v1/fill/w_400,h_400,fp_0.50_0.50,q_80,usm_0.66_1.00_0.01,enc_auto/nsplsh_a68ac7432d6c45c7a59274d20431bd24~mv2.jpg",
                "url": "https://www.aathmanawarenesscentre.com/service-page/basic-kundalini-yoga-bky",
            },
            {
                "id": "dky",
                "title": "Dynamic Kundalini Yoga (DKY)",
                "description": "Explore the life within the chakras.",
                "cover": "https://static.wixstatic.com/media/nsplsh_df0ffbb9feca40e4a824a8b34bac1c69~mv2.jpg/v1/fill/w_400,h_400,fp_0.50_0.50,q_80,usm_0.66_1.00_0.01,enc_auto/nsplsh_df0ffbb9feca40e4a824a8b34bac1c69~mv2.jpg",
                "url": "https://www.aathmanawarenesscentre.com/service-page/dynamic-kundalini-yoga-dky",
            },
            {
                "id": "iky",
                "title": "Intensified Kundalini Yoga (IKY)",
                "description": "Unravel the wisdom of chakras and know your 'Real Home'.",
                "cover": "https://static.wixstatic.com/media/nsplsh_7566747146626657474659~mv2_d_3483_4354_s_4_2.jpg/v1/fill/w_400,h_400,fp_0.50_0.50,q_80,usm_0.66_1.00_0.01,enc_auto/nsplsh_7566747146626657474659~mv2_d_3483_4354_s_4_2.jpg",
                "url": "https://www.aathmanawarenesscentre.com/service-page/intensified-kundalini-yoga-iky",
            },
            {
                "id": "chakra-breathing",
                "title": "Chakra Breathing",
                "description": "Master conscious breathing techniques through the chakras.",
                "cover": "https://static.wixstatic.com/media/nsplsh_333842684858304d43364d~mv2_d_5184_3456_s_4_2.jpg/v1/fill/w_400,h_400,fp_0.50_0.50,q_80,usm_0.66_1.00_0.01,enc_auto/nsplsh_333842684858304d43364d~mv2_d_5184_3456_s_4_2.jpg",
                "url": "https://www.aathmanawarenesscentre.com/service-page/chakra-breathing",
            },
        ],
        "articles": [
            {
                "title": "Beyond The Seven: Discovering the Hidden Chakras",
                "excerpt": "Only through the grace of HH Guruji Sundar have these hidden chakras been revealed: Pidari Kan (Mane) and Manonmaniyam.",
                "cover": "https://static.wixstatic.com/media/82dd0e_9795acf08f254e05bc09b27fe52f9bd3~mv2.png/v1/fill/w_600,h_600,fp_0.50_0.50,q_95,enc_avif,quality_auto/82dd0e_9795acf08f254e05bc09b27fe52f9bd3~mv2.webp",
                "url": "https://www.aathmanawarenesscentre.com/post/what-is-the-nine-chakra-system-hidden-chakras-revealed",
            },
            {
                "title": "Staying in the Middle",
                "excerpt": "You can never ever stay in the middle. Only fools claim to function from the middle.",
                "cover": "https://static.wixstatic.com/media/nsplsh_67373737228544e88831f0762abb42e3~mv2.jpg/v1/fill/w_600,h_600,fp_0.50_0.50,q_90,enc_avif,quality_auto/nsplsh_67373737228544e88831f0762abb42e3~mv2.webp",
                "url": "https://www.aathmanawarenesscentre.com/post/staying-in-the-middle",
            },
            {
                "title": "The Art of Living Full Day in Awareness",
                "excerpt": "HH Guruji Sundar shares his divine wisdom on how to live in awareness the entire day.",
                "cover": "https://static.wixstatic.com/media/82dd0e_aa4d6bbfafd94cdfbf7689a5d001012e~mv2.jpeg/v1/fill/w_600,h_600,fp_0.50_0.50,q_90,enc_avif,quality_auto/82dd0e_aa4d6bbfafd94cdfbf7689a5d001012e~mv2.webp",
                "url": "https://www.aathmanawarenesscentre.com/post/the-art-of-living-full-day-in-awareness",
            },
        ],
        "socials": [
            {"platform": "Instagram", "url": "https://www.instagram.com/aathmanawarenesscentre"},
            {"platform": "Facebook", "url": "https://www.facebook.com/profile.php?id=100067466078286"},
            {"platform": "WhatsApp", "url": "https://whatsapp.com/channel/0029VaGgAh57tkj8zdcA8o03"},
            {"platform": "YouTube", "url": "https://www.youtube.com/c/aathmanawarenesscentre"},
            {"platform": "LinkedIn", "url": "https://www.linkedin.com/company/aathman-awareness-centre-aac/"},
            {"platform": "Reddit", "url": "https://www.reddit.com/r/AatmanAwarenessCentre/"},
            {"platform": "Amazon", "url": "https://www.amazon.in/Kindle-Store-Guruji-Sundar/s?rh=n%3A1571277031%2Cp_27%3AGuruji%2BSundar"},
        ],
        "testimonials": [
            {"name": "Sudharsun Kannan",
             "text": "Whatever I know in meditation today or spirituality today is only because of His Holiness. Just merely being with Him is the miracle."},
            {"name": "Rajagopalan KS",
             "text": "I can find no words to match his divinity, love, grace, compassion. Come and dissolve yourselves in our beloved HH to find the real You."},
        ],
    }


# ------------ Admin & Push ------------
def is_admin_user(user: dict) -> bool:
    email = (user.get("email") or "").strip().lower()
    return bool(email) and email in ADMIN_EMAILS


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_admin_user(user):
        raise HTTPException(403, "Admin access required")
    return user


@api.get("/admin/whoami")
async def admin_whoami(user: dict = Depends(require_admin)):
    return {"ok": True, "email": user.get("email"), "name": user.get("name")}


@api.get("/admin/users")
async def admin_users(q: Optional[str] = None, admin: dict = Depends(require_admin)):
    query: dict = {}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"name": rx}, {"email": rx}, {"phone": rx}, {"identifier": rx}]
    rows = await db.users.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = iso(r["created_at"])
        if r.get("last_active_date") and isinstance(r["last_active_date"], datetime):
            r["last_active_date"] = iso(r["last_active_date"])
    return rows


@api.get("/admin/qa")
async def admin_qa_list(only_unanswered: bool = False, admin: dict = Depends(require_admin)):
    q: dict = {}
    if only_unanswered:
        q["$or"] = [{"answer": None}, {"answer": ""}]
    rows = await db.qa.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = iso(r["created_at"])
    return rows


class QaReplyBody(BaseModel):
    answer: str


@api.post("/admin/qa/{qa_id}/reply")
async def admin_qa_reply(qa_id: str, body: QaReplyBody, admin: dict = Depends(require_admin)):
    entry = await db.qa.find_one({"id": qa_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Question not found")
    await db.qa.update_one({"id": qa_id}, {"$set": {"answer": body.answer, "answered_at": now_utc(), "answered_by": admin.get("email")}})
    # Push the seeker who asked
    try:
        recipients = [entry["user_id"]] if entry.get("user_id") and entry["user_id"] != "seed" else []
        if recipients:
            await send_push(
                recipients=recipients,
                data={"title": "Guruji answered your question 🙏", "message": (body.answer or "")[:120], "action_url": "/qa"},
            )
    except Exception as e:
        logger.warning(f"Push (qa reply) failed: {e}")
    return {"ok": True}


class GuruMessageBody(BaseModel):
    title: str
    body: str
    cover: Optional[str] = None


@api.post("/admin/guru-messages")
async def admin_publish_guru(body: GuruMessageBody, admin: dict = Depends(require_admin)):
    doc = {
        "id": new_id(),
        "title": body.title,
        "body": body.body,
        "author": "HH Guruji Sundar",
        "cover": body.cover or GURUJI_IMAGE_LEGACY,
        "published_at": now_utc(),
    }
    await db.guru_messages.insert_one(doc.copy())
    # Broadcast push to all registered users (chunk 100)
    all_ids = [u["id"] async for u in db.users.find({}, {"id": 1, "_id": 0})]
    sent = 0
    for i in range(0, len(all_ids), 100):
        chunk = all_ids[i:i + 100]
        try:
            await send_push(
                recipients=chunk,
                data={
                    "title": f"Message from Guruji: {body.title}",
                    "message": (body.body or "")[:140],
                    "action_url": "/guru-messages",
                },
                idempotency_key=f"guru-{doc['id']}-{i}",
            )
            sent += len(chunk)
        except Exception as e:
            logger.warning(f"Push broadcast chunk {i} failed: {e}")
    doc["published_at"] = iso(doc["published_at"])
    return {"ok": True, "message": doc, "push_sent_to": sent}


# --- Push relay ---
_push_client: Optional[Any] = None


def _push_http():
    global _push_client
    if _push_client is None:
        import httpx as _h
        _push_client = _h.AsyncClient(
            base_url=EMERGENT_PUSH_BASE_URL,
            headers={"X-Push-Key": EMERGENT_PUSH_KEY},
            timeout=10.0,
        )
    return _push_client


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, user: dict = Depends(get_current_user)):
    # A user can only register a push token for their own account
    if body.user_id != user["id"]:
        raise HTTPException(403, "user_id mismatch")
    if EMERGENT_PUSH_KEY == "placeholder":
        # Preview mode — accept silently so client flow works during development
        return {"status": "registered", "mode": "preview"}
    try:
        resp = await _push_http().post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"register-push relay failed: {e}")
        raise HTTPException(502, "Push provider unavailable")
    return {"status": "registered"}


async def send_push(recipients: list, data: dict, idempotency_key: Optional[str] = None) -> None:
    if EMERGENT_PUSH_KEY == "placeholder":
        logger.info(f"[PREVIEW] would push to {len(recipients)} recipients: {data.get('title')}")
        return
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_http().post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


# ------------ Root ------------
@api.get("/")
async def root():
    return {"message": "Aathman API is awake", "time": iso(now_utc())}


AATHMAN_YOUTUBE_CHANNEL_ID = "UCkDostBKd39l9lz8UxpSxBg"
AATHMAN_YOUTUBE_STREAMS_URL = "https://www.youtube.com/@Aathmanawarenesscentre/streams"

GURUJI_IMAGE_LEGACY = "https://customer-assets.emergentagent.com/job_mantra-connect-3/artifacts/y2tp1enp_GurujiSundar.jpeg"

# ------------ Seed ------------
async def seed_data():
    # Meditations
    if await db.meditations.count_documents({}) == 0:
        await db.meditations.insert_many([
            {"id": new_id(), "title": "Inner Peace Meditation", "duration_minutes": 10, "category": "sleep",
             "cover": "https://images.pexels.com/photos/13849283/pexels-photo-13849283.jpeg",
             "description": "A gentle practice to calm your mind and connect within.", "bell_default": 60},
            {"id": new_id(), "title": "Body Scan", "duration_minutes": 15, "category": "sleep",
             "cover": "https://images.unsplash.com/photo-1544592218-b546f7b9ddb4",
             "description": "Release tension from head to toe.", "bell_default": 900},
            {"id": new_id(), "title": "Gratitude Meditation", "duration_minutes": 8, "category": "focus",
             "cover": "https://images.pexels.com/photos/10205915/pexels-photo-10205915.jpeg",
             "description": "Cultivate a heart of gratitude.", "bell_default": 0},
            {"id": new_id(), "title": "Shanti Breath", "duration_minutes": 12, "category": "peace",
             "cover": "https://images.unsplash.com/photo-1608900203293-ebc770fac3f9",
             "description": "Rest in the stillness within.", "bell_default": 300},
            {"id": new_id(), "title": "Morning Awakening", "duration_minutes": 10, "category": "focus",
             "cover": GURUJI_IMAGE,
             "description": "Start your day with clarity.", "bell_default": 300},
            {"id": new_id(), "title": "Third Eye Focus", "duration_minutes": 20, "category": "focus",
             "cover": "https://images.pexels.com/photos/10255271/pexels-photo-10255271.jpeg",
             "description": "Deep concentration practice.", "bell_default": 900},
        ])
    # Music library (uploaded meditation tracks)
    if await db.music.count_documents({}) == 0:
        await db.music.insert_many([
            {"id": new_id(), "title": "Call From Within", "url": "https://customer-assets-39nsmqrw.emergentagent.net/job_mantra-connect-3/artifacts/gq6t50ik_call%20from%20within.mp3", "cover": "https://images.unsplash.com/photo-1544924406-c8a4b1d8b0be", "order": 1},
            {"id": new_id(), "title": "By The Waves", "url": "https://customer-assets-39nsmqrw.emergentagent.net/job_mantra-connect-3/artifacts/9dxrbva1_By%20The%20Waves.mp3", "cover": "https://images.pexels.com/photos/13849283/pexels-photo-13849283.jpeg", "order": 2},
            {"id": new_id(), "title": "By The Waterfall", "url": "https://customer-assets-39nsmqrw.emergentagent.net/job_mantra-connect-3/artifacts/c97asdsy_By%20The%20Waterfall.mp3", "cover": "https://images.unsplash.com/photo-1544592218-b546f7b9ddb4", "order": 3},
            {"id": new_id(), "title": "Birds in Nature", "url": "https://customer-assets-39nsmqrw.emergentagent.net/job_mantra-connect-3/artifacts/d8fs5rkn_Birds%20in%20Nature.mp3", "cover": "https://images.pexels.com/photos/10205915/pexels-photo-10205915.jpeg", "order": 4},
        ])
    # Sleep content
    if await db.sleep_content.count_documents({}) == 0:
        await db.sleep_content.insert_many([
            {"id": new_id(), "kind": "music", "title": "Deep Sleep", "duration_minutes": 45,
             "cover": "https://images.pexels.com/photos/10255271/pexels-photo-10255271.jpeg"},
            {"id": new_id(), "kind": "music", "title": "Rain & Thunder", "duration_minutes": 60,
             "cover": "https://images.unsplash.com/photo-1608900203293-ebc770fac3f9"},
            {"id": new_id(), "kind": "music", "title": "Ocean Waves", "duration_minutes": 60,
             "cover": "https://images.pexels.com/photos/13849283/pexels-photo-13849283.jpeg"},
            {"id": new_id(), "kind": "music", "title": "Night Piano", "duration_minutes": 30,
             "cover": "https://images.unsplash.com/photo-1544592218-b546f7b9ddb4"},
            {"id": new_id(), "kind": "story", "title": "The Story of Hanuman", "duration_minutes": 20,
             "cover": "https://images.unsplash.com/photo-1543934776-32d1cc654abb"},
            {"id": new_id(), "kind": "story", "title": "The Wise King", "duration_minutes": 15,
             "cover": "https://images.pexels.com/photos/10205915/pexels-photo-10205915.jpeg"},
            {"id": new_id(), "kind": "story", "title": "Journey to the Stars", "duration_minutes": 18,
             "cover": "https://images.pexels.com/photos/10255271/pexels-photo-10255271.jpeg"},
            {"id": new_id(), "kind": "counting_sheep", "title": "Counting Sheep", "duration_minutes": 10,
             "cover": "https://images.unsplash.com/photo-1608900203293-ebc770fac3f9"},
        ])
    # Live sessions
    if await db.live_sessions.count_documents({}) == 0:
        base = now_utc()
        await db.live_sessions.insert_many([
            {"id": new_id(), "kind": "satsang", "title": "Weekly Satsang with Guruji",
             "description": "Live discourse from HH Guruji Sundar on the Aathman YouTube channel.",
             "host": "Guruji Sundar",
             "start_at": base + timedelta(days=1, hours=2),
             "cover": GURUJI_IMAGE,
             "youtube_channel_id": AATHMAN_YOUTUBE_CHANNEL_ID, "is_live": True},
            {"id": new_id(), "kind": "satsang", "title": "Living in Awareness",
             "description": "Weekly discourse on presence.", "host": "Guruji Sundar",
             "start_at": base + timedelta(days=8),
             "cover": GURUJI_IMAGE,
             "youtube_channel_id": AATHMAN_YOUTUBE_CHANNEL_ID, "is_live": False},
            {"id": new_id(), "kind": "yoga", "title": "Morning Yoga Flow",
             "description": "Find balance in body and mind.", "host": "Yogini Radha",
             "start_at": base + timedelta(days=2),
             "cover": "https://images.pexels.com/photos/10205915/pexels-photo-10205915.jpeg",
             "youtube_channel_id": AATHMAN_YOUTUBE_CHANNEL_ID, "is_live": True},
            {"id": new_id(), "kind": "yoga", "title": "Evening Restore",
             "description": "Gentle poses for deep relaxation.", "host": "Yogini Radha",
             "start_at": base + timedelta(days=4),
             "cover": "https://images.pexels.com/photos/10255271/pexels-photo-10255271.jpeg",
             "youtube_channel_id": AATHMAN_YOUTUBE_CHANNEL_ID, "is_live": False},
        ])
    # Books - real Brahmatheerth magazine issues from gurujisundar.com/shop
    BRAHMATHEERTH = [
        ("Brahmatheerth Issue 1 – BRAHMAM",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/02/BRAHMATHEERTH-FEB-25-ISSUE-1.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue1-brahmam/"),
        ("Brahmatheerth Issue 2 – BRAHMAM PERSONIFIED",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/02/Brahmatheerth-FEB-25-Issue-2.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-2-brahmam-personified/"),
        ("Brahmatheerth Issue 3 – THE MAKING OF A YOGI",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/02/Brahmatheerth-feb-28-1.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-3-the-making-of-a-yogi/"),
        ("Brahmatheerth Issue 4 – DREAM WORLD",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/03/Brahma-theerth-issue-4.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-4-dream-world/"),
        ("Brahmatheerth Issue 5 – DEMYSTIFYING THE MIND",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/03/Brahmatheerth-Issue-5-March-14-2025.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-5-demystifying-the-mind/"),
        ("Brahmatheerth Issue 6 – TOPOGRAPHY OF THE MIND",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/03/Brahmatheerth-Issue-6-March-21-1.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-6-topography-of-the-mind/"),
        ("Brahmatheerth Issue 7 – SISHYAHOOD REDEFINED",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/03/Brahmatheerth-March-Issue-7.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-7-sishyahood-redefined/"),
        ("Brahmatheerth Issue 8 – DHYAN SIMPLIFIED",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/04/Cover-Page-Final.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-8-dhyan-simplified/"),
        ("Brahmatheerth Issue 9 – BAKTHI UNRAVELLED (Special Edition)",
         "https://i0.wp.com/gurujisundar.com/wp-content/uploads/2025/05/Front-Cover.jpg",
         "https://gurujisundar.com/product/brahmatheerth-issue-9-bakthi-unravelled-special-edition/"),
    ]
    # Ensure books collection matches the shop exactly (reseed if titles do not match)
    existing_titles = {b["title"] async for b in db.books.find({}, {"title": 1, "_id": 0})}
    desired_titles = {t for t, _, _ in BRAHMATHEERTH}
    if existing_titles != desired_titles:
        await db.books.delete_many({})
        await db.books.insert_many([
            {
                "id": new_id(),
                "title": t,
                "author": "HH Guruji Sundar",
                "price": 500, "currency": "INR", "rating": 4.9,
                "cover": c,
                "description": "Saint Sundar's Elixir of Divine Wisdom — a spontaneous outpouring of wisdom from the beyond. Published by Aathman Awareness Centre.",
                "kind": "magazine",
                "external_url": u,
                "order": i + 1,
            }
            for i, (t, c, u) in enumerate(BRAHMATHEERTH)
        ])
    # Guru messages
    if await db.guru_messages.count_documents({}) == 0:
        base = now_utc()
        await db.guru_messages.insert_many([
            {"id": new_id(), "title": "You are not your thoughts",
             "body": "Remember, you are not your thoughts. You are the awareness behind them. Rest in that.",
             "author": "Guruji Sundar",
             "cover": GURUJI_IMAGE,
             "published_at": base - timedelta(days=1)},
            {"id": new_id(), "title": "The path of silence",
             "body": "In silence, the noise of the world falls away and truth begins to speak.",
             "author": "Guruji Sundar",
             "cover": GURUJI_IMAGE,
             "published_at": base - timedelta(days=3)},
            {"id": new_id(), "title": "Devotion is remembrance",
             "body": "To love the divine is to remember it in every breath.",
             "author": "Guruji Sundar",
             "cover": GURUJI_IMAGE,
             "published_at": base - timedelta(days=6)},
        ])
    # Quotes
    if await db.quotes.count_documents({}) == 0:
        await db.quotes.insert_many([
            {"text": "The mind is everything. What you think you become.", "author": "Buddha"},
            {"text": "Silence is the language of God, all else is poor translation.", "author": "Rumi"},
            {"text": "You yourself, as much as anybody in the entire universe, deserve your love and affection.", "author": "Buddha"},
            {"text": "Yoga is the journey of the self, through the self, to the self.", "author": "Bhagavad Gita"},
            {"text": "When you realize nothing is lacking, the whole world belongs to you.", "author": "Lao Tzu"},
            {"text": "The wound is the place where the light enters you.", "author": "Rumi"},
            {"text": "Peace comes from within. Do not seek it without.", "author": "Buddha"},
        ])
    # Q&A seed
    if await db.qa.count_documents({}) == 0:
        base = now_utc()
        await db.qa.insert_many([
            {"id": new_id(), "user_id": "seed", "user_name": "A Seeker",
             "question": "How do I quiet my mind during meditation?",
             "answer": "Do not fight the thoughts. Watch them arise and dissolve like clouds. The witness is already still.",
             "created_at": base - timedelta(days=2)},
            {"id": new_id(), "user_id": "seed", "user_name": "A Devotee",
             "question": "How many rounds of mantra should I do daily?",
             "answer": "One round of 108 done with love is greater than 1000 done mechanically. Begin with 108.",
             "created_at": base - timedelta(days=4)},
        ])


@app.on_event("startup")
async def on_startup():
    # Migration: replace the old placeholder meditation music with the 4 uploaded MP3s.
    # If the DB still has any legacy track (freesound / actions.google.com URLs, or any of
    # the retired titles), drop the whole collection so seed_data re-inserts the new set.
    legacy_titles = {
        "Himalayan Singing Bowls", "Om Drone", "Temple Bells Ambient", "Tibetan Bowls",
        "River & Birds", "Rain Meditation", "Deep Space Meditation",
        "Wind Chimes", "Forest Ambience", "Ocean Waves",
    }
    if await db.music.count_documents({"$or": [
        {"title": {"$in": list(legacy_titles)}},
        {"url": {"$regex": "actions\\.google\\.com|freesound\\.org"}},
    ]}) > 0:
        await db.music.delete_many({})
    await seed_data()
    # Migration: force-update Guruji-related covers to the new uploaded image
    await db.guru_messages.update_many({"author": "Guruji Sundar"}, {"$set": {"cover": GURUJI_IMAGE}})
    await db.live_sessions.update_many({"host": "Guruji Sundar"}, {"$set": {"cover": GURUJI_IMAGE}})
    await db.meditations.update_many({"title": "Morning Awakening"}, {"$set": {"cover": GURUJI_IMAGE}})
    # Migrate legacy bell_default values (were in odd small numbers) to seconds-based defaults
    # Migration: devotional rename of the former anxiety session
    await db.meditations.update_many(
        {"title": "Anxiety Relief Breath"},
        {"$set": {"title": "Shanti Breath", "category": "peace", "description": "Rest in the stillness within."}},
    )
    bell_map = {
        "Inner Peace Meditation": 300,
        "Body Scan": 900,
        "Gratitude Meditation": 0,
        "Shanti Breath": 300,
        "Morning Awakening": 300,
        "Third Eye Focus": 900,
    }
    for title, val in bell_map.items():
        await db.meditations.update_many({"title": title}, {"$set": {"bell_default": val}})
    # Migration: attach Aathman YouTube channel to all live sessions & remove stale hardcoded videos
    await db.live_sessions.update_many(
        {},
        {
            "$set": {"youtube_channel_id": AATHMAN_YOUTUBE_CHANNEL_ID},
            "$unset": {"youtube_id": ""},
        },
    )
    logger.info("Aathman API started, data seeded, guruji images synced.")


app.include_router(api)

# Serve the admin dashboard (separate web-only single-page HTML) under /api/*
# so the ingress routes it to the backend (all other paths go to Expo).
from fastapi.staticfiles import StaticFiles
_admin_dir = Path(__file__).parent / "admin_static"
if _admin_dir.exists():
    app.mount("/api/admin-panel", StaticFiles(directory=str(_admin_dir), html=True), name="admin")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
