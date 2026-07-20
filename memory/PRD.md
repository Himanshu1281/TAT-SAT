# Aathman - Awaken Within (PRD)

## Vision
A niche spiritual wellness mobile app for the Indian audience, inspired by Calm & Headspace, built around the teachings of **Guruji Sundar** at the Aathman Awareness Center. Every interaction is designed to feel like a quiet temple at dawn - saffron, calm, and rooted in Indian aesthetics.

## Tech Stack
- **Frontend:** React Native (Expo SDK 54, expo-router), TypeScript
- **Backend:** FastAPI + MongoDB (motor async), JWT auth
- **Design:** Saffron (#FFBA3D) / Purple (#7861FF) / Teal (#00BB84), Cormorant Garamond display + Inter text, 8pt grid

## Implemented Features (MVP)

### 1. Auth (Email/Phone OTP)
- `/api/auth/send-otp` sends 6-digit OTP via SendGrid (currently DEV MODE — returns `dev_otp` in response until `SENDGRID_API_KEY` is set)
- `/api/auth/verify-otp` verifies, issues JWT (30d), creates user
- Frontend: `login.tsx` → `verify.tsx` with 6-digit boxed input and 30s resend timer

### 2. Profile Setup
- Post-signup: name, age, gender, state (Indian states scroll chips), nationality
- Editable from Profile tab

### 3. Home Dashboard (Namaste + Guru's wisdom)
- Personalised greeting
- Mood check-in emojis (Happy / Calm / Grateful / Anxious / Sad)
- Quick actions: Meditate, Mantra, Sleep, Stats
- Daily meditation recommendations (horizontal cards)
- Message from Guruji card
- Quote of the Day (rotates daily, seeded)
- Explore row: Books, Satsang, Q&A
- Prominent **SOS** button (top-right red pill)

### 4. Guided Meditation
- Library with categories: All / Sleep / Anxiety / Focus
- Full-screen dark player with cover image, progress bar
- Duration selector (5/10/15/20/30 min)
- **Bell interval** (Off / 30 / 60 / 120 / 300 s) - haptic bell rings during session
- Session completion logs to `/api/meditation/complete` → updates stats & streak

### 5. Sleep
- Tabs: Music, Bedtime Stories, Counting Sheep
- Dark theme deep-purple gradient
- Seeded content (Deep Sleep, Rain & Thunder, Story of Hanuman, etc.)

### 6. Mantra Jaap Counter
- Full-screen glowing bead — tap to chant with light haptic
- 108-bead mala progress ring
- 5 preset mantras (Om Namah Shivaya, Hare Krishna, etc.)
- Save +N to backend `/api/mantra/increment`

### 7. Dear Diary (Spiritual Journal)
- Empty state with call-to-action
- List of entries with mood emoji + title + preview
- Compose screen: mood picker + optional title + long-form content
- CRUD via `/api/diary`

### 8. Mood Check-in
- Home + Journal share mood emojis
- Logged to `/api/mood`
- Weekly bar chart on Stats screen

### 9. My Stats & Rank
- Stats: Total Sessions, Minutes, Mantra Count, Streak
- Weekly mood bar chart
- Rank leaderboard tabs: **My Circle / State / National / International**
- User row highlighted

### 10. Weekly Satsang & Yoga (Live)
- Tabs: Satsang / Yoga
- Live badge (red pulsing) for currently-live sessions
- Opens YouTube-embedded WebView player (`/live-player`)
- Seeded upcoming schedule

### 11. Books & Magazines
- Store list with cover, author, price, rating
- Detail screen with cover + description
- Add to cart (AsyncStorage) with badge count
- Cart: qty +/-, remove, shipping address input
- Checkout: `/api/orders/create` + `/api/orders/verify` (Razorpay flow **MOCKED** to auto-succeed until keys are provided)
- Order success modal

### 12. Message from Guruji
- Dark elegant cards with cover + headline + wisdom body
- Seeded 3 messages

### 13. Q & A
- Ask Guruji form
- Recent answers feed (seeded 2 answers from Guruji)

### 14. SOS Depression Counselling
- Prominent SOS button on Home + Profile menu
- Form: name, phone, feeling (Overwhelmed / Depressed / Anxious / Lonely / Suicidal / Other), optional note
- **MOCKED** submission → success screen: "Our teacher will call you within 30 minutes. You are not alone."
- Includes iCall helpline reference for real emergencies

## Backend Data Models (MongoDB)
`users, otps, diary, moods, meditations, sessions, mantras, live_sessions, books, orders, guru_messages, quotes, qa, sleep_content, sos`

## Environment Vars (backend/.env)
- `MONGO_URL`, `DB_NAME=aathman_db`
- `JWT_SECRET`
- `SENDGRID_API_KEY` (empty → dev mode, OTP in response)
- `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (empty → payment mocked)
- `OTP_DEV_MODE=true`

## Test Credentials
See `/app/memory/test_credentials.md` — DEV OTP is returned inline in the `/api/auth/send-otp` response.

## Backend Test Report
93/93 tests passing after Iteration 7 (`/app/test_reports/pytest/pytest_results.xml`, `/app/test_reports/iteration_7.json`). Iteration 7 covered the new Admin Panel & push-relay endpoints.

## MVP Web Admin Panel
- Served at `/api/admin-panel/` (FastAPI StaticFiles + inline JS SPA at `/app/backend/admin_static/index.html`).
- Auth: Same Emergent Google Sign-In flow as the mobile app **plus** email whitelist from `ADMIN_EMAILS` env var.
- Sections: Users (search), SOS Requests (queued/pending/resolved), Q & A (view questions → reply), Message from Guruji (publish + broadcast push).
- All endpoints protected by `require_admin` dependency.

## Push Notifications
- `expo-notifications` on client (`app/_layout.tsx` sets handler, Android channel, and handles warm + cold-start taps).
- Register endpoint `POST /api/register-push` (JWT protected, enforces `body.user_id == current_user.id`).
- Guru-message publish and Q&A reply both call `send_push` via Emergent Push (SuprSend relay). Backend degrades gracefully to `[PREVIEW]` log in dev (when `EMERGENT_PUSH_KEY=placeholder`).
- Deep-link on tap: `data.action_url` → `router.push` (routes: `/qa`, `/guru-messages`).
- **Requires production build** + `google-services.json` (Android) + APNs cert (iOS) for real delivery; will not work in Expo Go.

## Deferred / Future
- Real SendGrid email delivery (drop-in when user provides API key)
- Real Razorpay checkout via React Native Web/native SDK
- Real live streaming (currently YouTube-embedded proxies)
- Twilio Voice for real SOS callback
- server.py router split (currently 1500+ lines — non-blocking refactor)
