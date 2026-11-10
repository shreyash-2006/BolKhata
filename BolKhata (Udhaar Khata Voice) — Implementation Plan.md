# BolKhata (Udhaar Khata Voice) — Implementation Plan

Build specification for an autonomous coding agent · Hackathon edition · Prepared 29 October 2026 · Gnani Vachana API details verified against docs.gnani.ai on this date

## 0. Rules for the building agent (read first)

1. This document is the single source of truth. Technologies, endpoints, field names and defaults are already decided. Do not ask the user questions. Where something is unspecified, choose the simplest option and record the choice in README.md.
2. Build in the phase order of Section 13. Do not start a phase until the previous phase’s acceptance checks pass.
3. Phase 0 is a spike that tests every uncertain API assumption with real calls (Section 5.6 lists them as U1–U7). Never code around an unverified assumption without running the spike first.
4. API keys exist only in backend environment variables. The browser never calls Gnani or the LLM directly.
5. The LLM never does arithmetic on money. Balances, overdue amounts and date validation are computed in Python (Section 6). The LLM only extracts intent and entities, and phrases text.
6. No voice entry is saved without a human tap on a confirm card.
7. If an external API is down or a key is missing, build against the fixtures in backend/fixtures (Section 12) so work is never blocked.
8. Commit after every phase. Keep README.md current with run instructions.

## 1. Product summary

**Problem.** Millions of kirana (neighbourhood grocery) owners track customer credit (udhaar) in paper notebooks. Entries are slow to write, balances are hard to check, and asking for money is socially awkward, so money is lost or relationships are strained.

**Solution.** A mobile-first web app where the shopkeeper only talks. Three loops:

- **Loop A — Speak to log.** “Sharma ji ne 450 ka saaman liya, Friday tak dega” becomes a structured ledger entry after one confirm tap.
- **Loop B — Ask by voice.** “Verma ji ka kitna baaki hai?” or “Kiska paisa pending hai?” is answered on screen and out loud, in the shopkeeper’s language.
- **Loop C — Remind in my voice.** For an overdue customer the app writes a polite reminder in the customer’s language and speaks it in the shopkeeper’s own cloned voice, ready to share on WhatsApp.

**Primary user:** shopkeeper aged 35–60, speaks Hindi or a regional language mixed with English, uses only a phone, avoids typing. **Secondary user:** the customer who receives the voice note.

**The two-minute demo must show:** seeded dashboard → voice entry in Hindi → confirm → voice query in a second language → overdue customer → reminder in cloned voice → share. Everything in this plan serves that flow.

## 2. Scope

| Priority | Feature |
| --- | --- |
| P0 | Shop onboarding; voice entry with confirm card (add credit, record payment); dashboard and customer detail; voice queries (balance, overdue list); reminder drafting and spoken reminder (stock voice); voice-clone enrollment with consent and cloned reminders (with stock-voice fallback); share/download audio; seed data; demo fallback fixtures |
| P1 | Multi-action utterances (up to 5); spoken read-back of an entry; Hindi and English UI; undo last entry; due-today and due-this-week lists; PWA manifest |
| P2 | Real outbound phone calls (LiveKit or Pipecat plugin), WhatsApp Business API, UPI payment link in reminders, multi-shop auth, analytics |

Out of scope for the MVP: user accounts and login (single shop, shop id 1), real payments, real phone calls, STT WebSocket streaming, STT batch.

## 3. Fixed technology stack

| Layer | Choice |
| --- | --- |
| Backend | Python 3.11+, FastAPI, Uvicorn, SQLModel on SQLite, httpx (async), pydantic-settings |
| Audio | ffmpeg and ffprobe command-line tools (must be installed on the machine) |
| Speech | Gnani Vachana REST APIs called with raw httpx. Do NOT use the gnani-vachana SDK or the LiveKit/Pipecat plugins in the MVP |
| LLM | Anthropic API via the anthropic Python SDK with forced tool use for structured output. Model comes from env LLM\_MODEL, default claude-sonnet-5-5 (claude-haiku-5-5 is acceptable if latency matters more). All LLM calls go through one module, app/services/llm.py, so another provider can replace it |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS, mobile-first, no router library (state-based screens) |
| Serving | FastAPI also serves frontend/dist as static files: one process, one port (8000) |
| HTTPS for phones | cloudflared or ngrok tunnel. Browsers only allow microphone access on HTTPS or localhost, so a phone on the LAN over plain http will not work |
| Tests | pytest + pytest-asyncio |

## 4. Repository layout, setup and configuration

```text
bolkhata/
  backend/
    app/
      main.py            # FastAPI app, static mount, router includes
      config.py          # pydantic-settings Settings
      db.py              # engine, session dependency, create_all
      models.py          # SQLModel tables (Section 6)
      schemas.py         # pydantic request/response models
      routers/           # shop.py voice.py ledger.py reminders.py audio.py
      services/
        gnani.py         # Section 5 (the only file that talks to Gnani)
        llm.py           # Section 8 (the only file that talks to the LLM)
        nlu.py           # builds prompts, validates LLM output
        ledger.py        # Section 6 math (pure functions)
        audio.py         # Section 9 ffmpeg helpers
        reminders.py     # draft, validate, synthesize, cache
    scripts/ spike.py seed.py make_fixtures.py
    fixtures/            # canned STT/LLM/TTS outputs for DEMO_FALLBACK
    tests/
  frontend/              # Vite React TS app
  data/                  # sqlite db and audio output (gitignored)
  .env.example  README.md
```

Setup commands:

```bash
# prerequisites: Python 3.11+, Node 20+, ffmpeg (apt install ffmpeg  or  brew install ffmpeg)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install fastapi 'uvicorn[standard]' httpx sqlmodel pydantic-settings python-multipart anthropic tzdata pytest pytest-asyncio
cd ../frontend && npm create vite@latest . -- --template react-ts && npm install && npm install -D tailwindcss @tailwindcss/vite
# run: uvicorn app.main:app --reload --port 8000   (backend)   and   npm run dev   (frontend, proxy /api to :8000)
# phone testing: cloudflared tunnel --url http://localhost:8000
```

`.env.example`:

```text
GNANI_API_KEY=
GNANI_BASE_URL=https://api.vachana.ai
GNANI_MAX_CONCURRENCY=1
ANTHROPIC_API_KEY=
LLM_MODEL=claude-sonnet-5-5
TIMEZONE=Asia/Kolkata
FAKE_TODAY=                    # YYYY-MM-DD, tests and demo only
DATABASE_URL=sqlite:///./data/bolkhata.db
AUDIO_DIR=./data/audio
TTS_STOCK_MODEL=timbre-v3.0    # fallback timbre-v2.5, decided by spike
TTS_STOCK_VOICE=Shivani        # v2.5 fallback voices: table in 5.3
VC_SUPPORTED_LANGS=hi-IN,en-IN # decided by spike
VC_NUMBER_MODE=digits          # digits or words, decided by spike
DEMO_FALLBACK=true
```

Get the Gnani key from https://app.gnani.ai/voice. A key can be scoped per service, so confirm it covers STT, TTS and voice cloning (Phase 0 checks this).

## 5. Gnani API contract (the only external speech dependency)

Base URL: `https://api.vachana.ai`. Every request carries header `X-API-Key-ID: <key>`. Docs: https://docs.gnani.ai/api/introduction/introduction

### 5.1 Behaviours that apply to every call

- Error bodies come in four shapes, and `gnani.py` must normalise all of them: (a) `{success:false, error:{type,message}}`; (b) `{detail:{error_code,message,status_code}}` for 401, 403, 429; (c) `{detail:[...]}` for 422 validation; (d) `{error,code,message}` for the STT 504 timeout.
- Status meanings: 401 missing or invalid key; 402 insufficient credit; 403 key lacks scope for this service; 429 rate limited (some accounts allow only one active request at a time, with no Retry-After header, so back off yourself); 5xx and 504 are retryable.
- Because of the possible one-request-at-a-time limit, `gnani.py` uses a process-wide semaphore (size from GNANI\_MAX\_CONCURRENCY, default 1) and retries 429/5xx up to 3 times with exponential backoff.

### 5.2 Speech-to-text (STT) — Prisma v3.0

`POST /stt/v3` as multipart/form-data.

| Field | Value we send |
| --- | --- |
| audio\_file | 16 kHz mono WAV, at most 30 seconds. Supported upload formats are WAV, MP3, OGG, FLAC, AAC, M4A. Browser WebM is NOT supported, so always convert with ffmpeg first |
| model | `prisma-v3.0` (needed for language detection and context hints; omitting it selects Prisma v2.5) |
| language\_code | Shop setting, default `hi-IN,en-IN`. Valid values are `indic-auto`, a single code, or a comma list of 1–4 codes from bn-IN, en-IN, gu-IN, hi-IN, kn-IN, ml-IN, mr-IN, pa-IN, ta-IN, te-IN. They are hints, not locks. Codes are case-sensitive: `hi` or `hi-in` returns 400 |
| format | `transcribe` (numbers, currency and dates come back in written form, such as ₹450) |
| keyterms | JSON array string of up to 200 customer names and ledger words. This boosts recognition of names |
| topic | Short description, up to 1,600 characters |
| header X-API-Request-ID | Optional uuid for tracing |

Response (200): `success`, `request_id`, `transcript` (string, empty when there is no speech, which is not an error), `model`, `detected_language_code` (absent when empty), `truncated` (present only when true), `processing_time`, `end_to_end_latency`. Audio under about one second is unreliable.

Useful errors: 400 INVALID\_LANGUAGE\_CODE, MODEL\_UNSUPPORTED\_LANGUAGE, INVALID\_CONTEXT, EMPTY\_AUDIO, UNSUPPORTED\_AUDIO\_FORMAT, AUDIO\_CONVERSION\_ERROR, MAX\_AUDIO\_DURATION\_EXCEEDED; 500 TRANSCRIPTION\_FAILED; 504 UPSTREAM\_TIMEOUT.

### 5.3 Text-to-speech (TTS) with stock voices — Timbre

`POST /api/v1/tts/inference`, JSON body, returns binary audio.

| Field | Value |
| --- | --- |
| text | Text to speak. Write every non-English language in its native script. Pure Latin text is treated as English even if the words are romanised Hindi |
| model | `timbre-v3.0` (default; every voice speaks all 10 languages) or `timbre-v2.5` (fallback; 42 voices, one preferred language each). Do NOT use timbre-v2.0 (deprecated) |
| voice | v3.0: Shivani (warm, default), Chetana, Kalpana, Tarika, Lakshmi, Vasudha, Riyaa (female); Avinash, Harshad, Prakash, Shubham, Devansh, Yashraj (male). Voices are not interchangeable between models (400 if mismatched) |
| language | `hi-IN`, `en-IN`, `mr-IN`, `gu-IN`, `ta-IN`, `te-IN`, `kn-IN`, `ml-IN`, `pa-IN`, `bn-IN`, `hi-en` (Hinglish) or `auto` (detects from script) |
| speed | 1.0 (range 0.85 to 1.15) |
| audio\_config | sample\_rate 24000, num\_channels 1, sample\_width 2, encoding linear\_pcm, container wav |

v2.5 fallback voice per language: hi-IN Nalini, en-IN Kaveri, hi-en Poorvi, mr-IN Zahira, ta-IN Trisha, te-IN Suhana, kn-IN Saanvi, ml-IN Reshma, bn-IN Kirra, gu-IN Falak, pa-IN Mehuli.

Text normalisation is automatic on this endpoint. Amounts such as ₹450 or ₹2,50,000 are read as rupee amounts using Indian lakh grouping; 6-plus-digit runs and numbers next to words like account, OTP or PIN are read digit by digit. Keep reminder text short (under about 280 characters).

### 5.4 Voice cloning (two steps)

**Step 1 — embedding.** `POST /api/v1/tts/voice-clone/embeddings`, multipart with `audio_file` (WAV or MP3, 5–30 seconds of clean single-speaker speech). Response: `data.voice_clone_embedding` = `{embedding: <base64 string>, shape: [1, 768], dtype: 'torch.bfloat16'}`. Store this whole object as JSON and reuse it forever.

**Step 2 — synthesis.** `POST /api/v1/tts/inference` with JSON `{text, model: 'vachana-vc-v1', speaker_embedding: <the stored object>, audio_config}`. There is no documented `language` or `voice` field for cloning. `audio_config` is required, the maximum sample\_rate is 44100 (not 48000), and the documented example is: sample\_rate 44100, num\_channels 1, sample\_width 2, encoding linear\_pcm, container wav. Use exactly that.

### 5.5 Reference client (write this as app/services/gnani.py)

```python
import asyncio, json, random, uuid
import httpx
from app.config import settings

class GnaniError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(f'{status} {code}: {message}')
        self.status, self.code, self.message = status, code, message

_sem = asyncio.Semaphore(settings.gnani_max_concurrency)   # default 1
RETRYABLE = {429, 500, 502, 503, 504}

def _parse_error(r: httpx.Response) -> GnaniError:
    code, msg = 'UNKNOWN', r.text[:300]
    try:
        b = r.json()
        if isinstance(b.get('error'), dict):        # shape (a)
            code, msg = b['error'].get('type', code), b['error'].get('message', msg)
        elif isinstance(b.get('detail'), dict):     # shape (b)
            code, msg = b['detail'].get('error_code', code), b['detail'].get('message', msg)
        elif isinstance(b.get('detail'), list):     # shape (c)
            code, msg = 'VALIDATION', json.dumps(b['detail'])[:300]
        elif 'code' in b:                           # shape (d)
            code, msg = b['code'], b.get('message', msg)
    except Exception:
        pass
    return GnaniError(r.status_code, code, msg)

async def _post(path, *, retries=3, timeout=60, **kw) -> httpx.Response:
    headers = {'X-API-Key-ID': settings.gnani_api_key, **kw.pop('headers', {})}
    async with _sem:                                # hold the slot across retries
        for attempt in range(retries):
            async with httpx.AsyncClient(base_url=settings.gnani_base_url, timeout=timeout) as c:
                r = await c.post(path, headers=headers, **kw)
            if r.status_code == 200:
                return r
            if r.status_code in RETRYABLE and attempt < retries - 1:
                await asyncio.sleep(0.6 * (2 ** attempt) + random.random() * 0.3)
                continue
            raise _parse_error(r)

def _audio_or_raise(r: httpx.Response) -> bytes:
    if 'json' in r.headers.get('content-type', ''):
        raise _parse_error(r)
    if len(r.content) < 1000:
        raise GnaniError(502, 'EMPTY_AUDIO', 'TTS returned too little audio')
    return r.content

async def stt(wav: bytes, language_code: str, keyterms: list[str], topic: str | None) -> dict:
    data = {'model': 'prisma-v3.0', 'language_code': language_code, 'format': 'transcribe'}
    if keyterms: data['keyterms'] = json.dumps(keyterms[:200], ensure_ascii=False)
    if topic: data['topic'] = topic[:1600]
    r = await _post('/stt/v3', timeout=30, data=data,
                    files={'audio_file': ('audio.wav', wav, 'audio/wav')},
                    headers={'X-API-Request-ID': str(uuid.uuid4())})
    return r.json()

async def tts_stock(text: str, voice: str, language: str, model: str = 'timbre-v3.0') -> bytes:
    body = {'text': text, 'voice': voice, 'model': model, 'language': language, 'speed': 1.0,
            'audio_config': {'sample_rate': 24000, 'num_channels': 1, 'sample_width': 2,
                             'encoding': 'linear_pcm', 'container': 'wav'}}
    return _audio_or_raise(await _post('/api/v1/tts/inference', json=body))

async def clone_embedding(wav: bytes) -> dict:
    r = await _post('/api/v1/tts/voice-clone/embeddings',
                    files={'audio_file': ('ref.wav', wav, 'audio/wav')})
    return r.json()['data']['voice_clone_embedding']

async def tts_clone(text: str, embedding: dict) -> bytes:
    body = {'text': text, 'model': 'vachana-vc-v1', 'speaker_embedding': embedding,
            'audio_config': {'sample_rate': 44100, 'num_channels': 1, 'sample_width': 2,
                             'encoding': 'linear_pcm', 'container': 'wav'}}
    return _audio_or_raise(await _post('/api/v1/tts/inference', json=body))
```

Timeouts: STT 30 s, TTS 60 s, embeddings 60 s. Log status, latency and request id for every call. Never log API keys or embedding strings.

User-facing error mapping (the API returns `{status:'error', code, message_key}` and the UI shows a friendly localised string): 401 or 403 → voice service not configured (also log loudly); 402 → voice credits finished; 429 after retries → busy, try again; 5xx or 504 after retries → voice service had a problem, tap to retry.

### 5.6 Known inconsistencies and unverified assumptions (resolved in Phase 0)

| ID | Issue | How it is resolved |
| --- | --- | --- |
| U1 | Older doc pages mention a 60 s STT limit and models named vachana-voice-v2; current pages say 30 s and timbre-v2.5/v3.0 | Use this plan (current pages). Spike confirms by a successful call |
| U2 | Which languages the cloned voice (vachana-vc-v1) can speak is undocumented; every example is Hindi | Spike S6 tests 7 languages and writes VC\_SUPPORTED\_LANGS. For other languages, fall back to a stock timbre-v3.0 voice and show a small notice in the UI |
| U3 | Not documented whether automatic number normalisation (₹450 → words) also runs on the cloning path | Spike S7 decides VC\_NUMBER\_MODE. In `words` mode the LLM writes the amount in words in the target language |
| U4 | Account access to prisma-v3.0 and timbre-v3.0, and the account concurrency limit, are unknown | Spike S1, S2, S4. Fallbacks: timbre-v2.5, GNANI\_MAX\_CONCURRENCY=1 |
| U5 | Embedding quality on noisy or short audio is unknown | Onboarding enforces 8–30 s, shows a quiet-room hint, and lets the user re-record |
| U6 | Whether Latin-script Hinglish is spoken well | Avoid it. Always write Hindi in Devanagari with English words in Latin |
| U7 | A cloned voice is not guaranteed to match the original perfectly | UI always offers Play before Share, and a switch to stock voice |

### 5.7 Phase 0 spike (scripts/spike.py)

Run with real keys. Print a table and write `spike_report.json` plus recommended `.env` lines. A test fixture WAV of 12 seconds of the owner’s own voice is optional; without it S5–S7 run on a stock-voice sample just to prove the plumbing.

| Check | Action | Pass means |
| --- | --- | --- |
| S1 | STT with 1 s of silence, prisma-v3.0, hi-IN | HTTP 200 and empty transcript. 403 means missing scope |
| S2 | TTS timbre-v3.0 voice Shivani, language hi-IN, text with ₹450 | Audio over 1 KB. On 400 or 403 retry timbre-v2.5 voice Nalini and set TTS\_STOCK\_MODEL accordingly |
| S3 | Round trip: TTS then ffmpeg to 16k WAV then STT, for one sentence each in hi, mr, gu, ta, te | Transcript contains 450 or the spoken form; detected\_language\_code matches |
| S4 | Fire 3 STT calls concurrently without the semaphore | If any 429, keep GNANI\_MAX\_CONCURRENCY=1; if none, allow 3 |
| S5 | Create an embedding from the reference WAV | 200 with shape \[1, 768\]; save it to data/spike\_embedding.json |
| S6 | Clone-synthesize one sentence in hi, en, mr, gu, ta, te, bn, then STT round trip | Language detected and content recognisable; list passing languages as VC\_SUPPORTED\_LANGS |
| S7 | Clone-synthesize a sentence containing ₹450 as digits, then STT round trip | Transcript contains 450 or चार सौ पचास → VC\_NUMBER\_MODE=digits, else words |
| S8 | Record the latency of every call | Report p50 for each call type |
