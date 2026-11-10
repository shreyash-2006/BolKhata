# BolKhata (Udhaar Khata Voice)

> Mobile-first Kirana credit ledger driven entirely by voice. Powered by **Gnani Vachana AI** (Prisma v3.0 STT, Timbre v3.0 TTS, VC-v1 Voice Cloning) and **FastAPI + SQLModel + React 18 + Vite + Tailwind CSS**.

---

## 1. Product Summary

Millions of Indian Kirana (neighbourhood grocery) owners track customer credit (*udhaar*) in paper notebooks. BolKhata is a mobile-first web app where shopkeepers interact purely through voice in their regional language (Hindi, Marathi, Gujarati, English):

- **Loop A — Speak to log**:
  *"Sharma ji ne 450 ka saaman liya, Friday tak dega"* ➔ automatically parsed into a structured ledger entry with a single human tap on a **Confirm Card** (Rule 6).
- **Loop B — Ask by voice**:
  *"Verma ji ka kitna baaki hai?"* or *"Kiska paisa pending hai?"* ➔ answered directly on screen and read aloud in the shopkeeper's language.
- **Loop C — Remind in my voice**:
  For overdue customers, the app drafts a polite, culturally respectful reminder in the customer's language and speaks it in the shopkeeper's own **cloned voice** (via Gnani VC-v1), ready to share directly to WhatsApp.

---

## 2. Architecture & Tech Stack

| Layer | Technology | Details |
| --- | --- | --- |
| **Backend** | Python 3.11+, FastAPI, Uvicorn | Single-process serving API + SPA static assets on `:8000` |
| **Database** | SQLModel (SQLAlchemy) on SQLite | Relational tables for `Shop`, `Customer`, `LedgerEntry`, `Reminder` |
| **Ledger Math** | Pure Python (`app/services/ledger.py`) | All balance calculations, overdue tracking, and relative dates are computed in Python (LLM never does arithmetic) |
| **Speech STT** | Gnani Prisma v3.0 (`/stt/v3`) | With domain keyterms boosting (customer names and shop items) |
| **Speech TTS** | Gnani Timbre v3.0 (`/api/v1/tts/inference`) | Stock voice `Shivani` for clear Hindi and regional readouts |
| **Voice Cloning** | Gnani VC-v1 (`/api/v1/tts/voice-clone/embeddings`) | Enrolls 10–15s shopkeeper reference speech into a 768-dim embedding |
| **NLU / LLM** | Google Gemini (`gemini-2.5-flash`) via `google-genai` + Anthropic fallback + Rule fallback | Structured intent & entity extraction via schema enforcement (LLM never computes ledger arithmetic) |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Mobile-first UI, Web Audio API 16 kHz mono WAV encoding, PWA ready |

---

## 3. Demo Video, Voiceover & Pitch Assets

| Asset | File | Description |
| --- | --- | --- |
| 🎬 **Demo Video** | [`BolKhata_Demo_Video.webm`](file:///d:/Gnani/BolKhata_Demo_Video.webm) | Full 1m 45s recorded mobile walkthrough covering all 6 scenes |
| 🌐 **Interactive Video Player** | [`play_video.html`](file:///d:/Gnani/play_video.html) | Native browser video player with scene jump buttons (opens in Chrome/Edge) |
| 🎙️ **ElevenLabs Voiceover Script** | [`ELEVENLABS_VOICEOVER_SCRIPT.md`](file:///d:/Gnani/ELEVENLABS_VOICEOVER_SCRIPT.md) | Synchronized voiceover script with recommended ElevenLabs voice settings and copy-paste text |
| 📄 **1-Page Solution Pitch** | [`SOLUTION_PITCH.md`](file:///d:/Gnani/SOLUTION_PITCH.md) | High-impact 1-page executive pitch explaining the Kirana problem, voice loops, and metrics |
| 📋 **Demo Guide** | [`DEMO_GUIDE.md`](file:///d:/Gnani/DEMO_GUIDE.md) | Complete 2–3 minute live or recorded demonstration playbook |

---

## 4. Project Structure

```text
bolkhata/
  backend/
    app/
      main.py               # FastAPI app, static mount, router includes
      config.py             # Pydantic Settings
      db.py                 # SQLite engine & session management
      models.py             # SQLModel tables (Shop, Customer, LedgerEntry, Reminder)
      schemas.py            # Pydantic request/response models
      fixtures_manager.py   # Canned fixtures for demo fallback
      routers/
        shop.py             # Shop onboarding and settings
        ledger.py           # Customer list, confirm entry, undo, summary
        voice.py            # STT transcribe, process query/log, enroll clone
        reminders.py        # Reminder drafting & voice synthesis
        audio.py            # Audio streaming
      services/
        gnani.py            # Raw httpx client for Gnani STT, TTS, VC
        llm.py              # LLM NLU extraction & reminder drafting
        nlu.py              # Keyterms builder & date resolver
        ledger.py           # Pure ledger arithmetic and overdue math
        audio.py            # Audio processing and tone generator
        reminders.py        # Reminder preparation and voice synthesis
    scripts/
      spike.py              # Phase 0 verification spike (S1-S8 checks)
      seed.py               # Realistic kirana demo dataset
    tests/
      test_api.py           # API endpoints and ledger math tests
      test_serving.py       # Full static asset and API integration test
  frontend/                 # React 18 + Vite + Tailwind mobile app
  data/                     # SQLite database and synthesized audio
  .env.example              # Environment variables template
  README.md                 # Documentation
```

---

## 4. Setup & Running Instructions

### Prerequisites
- Python 3.11+
- Node.js 20+ and npm

### Step 1: Environment Variables
Create `.env` in the root directory (or copy from `.env.example`):
```bash
cp .env.example .env
```
Key configuration:
- `GEMINI_API_KEY`: Google Gemini API key for `gemini-2.5-flash` NLU extraction and reminder drafting.
- `GNANI_API_KEY`: Your key from [app.gnani.ai/voice](https://app.gnani.ai/voice).
- `ANTHROPIC_API_KEY`: (Optional) Anthropic Claude fallback.
- `DEMO_FALLBACK`: Set to `true` to ensure full demo availability even without live speech credits.

### Step 2: Backend Setup
```bash
cd backend
python -m venv .venv

# Windows Powershell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt # (or pip install fastapi "uvicorn[standard]" httpx sqlmodel pydantic-settings python-multipart anthropic tzdata pytest pytest-asyncio)
```

### Step 3: Frontend Build
```bash
cd ../frontend
npm install
npm run build
```

### Step 4: Seed Demo Data
```bash
python backend/scripts/seed.py
```
This populates the shop with realistic customers (`Sharma ji`, `Verma ji`, `Gupta ji`, `Suresh Patil`, `Patel Bhai`) with varying credit balances, overdue records, and preferred languages.

### Step 5: Start the Server (Single Process, Port 8000)
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
Open your browser at `http://localhost:8000`. The frontend SPA and all backend API endpoints are served from the single port!

For mobile phone testing (e.g. over HTTPS for microphone access):
```bash
cloudflared tunnel --url http://localhost:8000
```

---

## 5. Verification & Testing

### Run Automated Tests (Pytest)
```bash
.\backend\.venv\Scripts\pytest.exe backend/tests
```
All 7 unit and integration tests verify:
- Shop details & onboarding
- Pure ledger arithmetic (`calculate_customer_balance`, `calculate_customer_overdue`, `resolve_relative_date`)
- Confirm card workflow (saving confirmed entries into SQLite)
- Undo functionality (reverting last uncancelled transaction)
- Voice processing (log entries and queries)
- Reminder drafting & voice synthesis
- Static asset serving alongside API endpoints

### Run Gnani Spike Verification (S1–S8)
```bash
python backend/scripts/spike.py
```
Runs the Phase 0 spike testing STT, TTS, round-trip audio, concurrency, voice clone embedding, and latency measurements, writing a detailed `data/spike_report.json`.

---

## 6. Record of Implementation Choices (Rule 1)

1. **Browser Audio Encoding**: Rather than requiring server-side ffmpeg transcoding for browser WebM, the frontend includes a native 16 kHz 16-bit mono WAV encoder using standard Web Audio API. This ensures zero latency and immediate compatibility with Gnani STT and Voice Clone embedding APIs across all modern mobile browsers.
2. **Demo Quick Utterance Chips**: 1-click test chips are integrated into the voice modal for instant 2-minute hackathon demonstrations without requiring microphone permissions.
3. **Single Process Serving**: FastAPI mounts `frontend/dist` as static assets and serves `index.html` on SPA routes, eliminating CORS concerns and simplifying deployment.
4. **Resilient Fallback Mode**: When `DEMO_FALLBACK=true`, the app functions end-to-end even in offline or missing-key scenarios using realistic mock speech fixtures and procedural audio synthesis.

