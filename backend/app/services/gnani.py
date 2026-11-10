import asyncio
import json
import logging
import random
import uuid
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

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

async def _post(path: str, *, retries: int = 3, timeout: float = 60.0, **kw) -> httpx.Response:
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

async def stt(wav: bytes, language_code: str = "hi-IN,en-IN", keyterms: list[str] = None, topic: str | None = None) -> dict:
    if not settings.gnani_api_key:
        if settings.demo_fallback:
            from app.fixtures_manager import get_fallback_stt
            return get_fallback_stt(wav)
        raise GnaniError(401, 'MISSING_KEY', 'GNANI_API_KEY is not configured')

    data = {'model': 'prisma-v3.0', 'language_code': language_code, 'format': 'transcribe'}
    if keyterms:
        data['keyterms'] = json.dumps(keyterms[:200], ensure_ascii=False)
    if topic:
        data['topic'] = topic[:1600]
    try:
        r = await _post('/stt/v3', timeout=30, data=data,
                        files={'audio_file': ('audio.wav', wav, 'audio/wav')},
                        headers={'X-API-Request-ID': str(uuid.uuid4())})
        return r.json()
    except Exception as e:
        if settings.demo_fallback:
            logger.warning(f"Gnani STT error: {e}, falling back to fixture")
            from app.fixtures_manager import get_fallback_stt
            return get_fallback_stt(wav)
        raise

async def tts_stock(text: str, voice: str = "Shivani", language: str = "hi-IN", model: str = 'timbre-v3.0') -> bytes:
    if not settings.gnani_api_key:
        if settings.demo_fallback:
            from app.fixtures_manager import get_fallback_tts
            return get_fallback_tts(text)
        raise GnaniError(401, 'MISSING_KEY', 'GNANI_API_KEY is not configured')

    body = {
        'text': text,
        'voice': voice,
        'model': model,
        'language': language,
        'speed': 1.0,
        'audio_config': {
            'sample_rate': 24000,
            'num_channels': 1,
            'sample_width': 2,
            'encoding': 'linear_pcm',
            'container': 'wav'
        }
    }
    try:
        r = await _post('/api/v1/tts/inference', json=body)
        return _audio_or_raise(r)
    except Exception as e:
        if settings.demo_fallback:
            logger.warning(f"Gnani TTS stock error: {e}, falling back to fixture")
            from app.fixtures_manager import get_fallback_tts
            return get_fallback_tts(text)
        raise

async def clone_embedding(wav: bytes) -> dict:
    if not settings.gnani_api_key:
        if settings.demo_fallback:
            from app.fixtures_manager import get_fallback_embedding
            return get_fallback_embedding()
        raise GnaniError(401, 'MISSING_KEY', 'GNANI_API_KEY is not configured')

    try:
        r = await _post('/api/v1/tts/voice-clone/embeddings',
                        files={'audio_file': ('ref.wav', wav, 'audio/wav')})
        return r.json()['data']['voice_clone_embedding']
    except Exception as e:
        if settings.demo_fallback:
            logger.warning(f"Gnani clone embedding error: {e}, falling back to fixture")
            from app.fixtures_manager import get_fallback_embedding
            return get_fallback_embedding()
        raise

async def tts_clone(text: str, embedding: dict) -> bytes:
    if not settings.gnani_api_key:
        if settings.demo_fallback:
            from app.fixtures_manager import get_fallback_tts
            return get_fallback_tts(text, is_cloned=True)
        raise GnaniError(401, 'MISSING_KEY', 'GNANI_API_KEY is not configured')

    body = {
        'text': text,
        'model': 'vachana-vc-v1',
        'speaker_embedding': embedding,
        'audio_config': {
            'sample_rate': 44100,
            'num_channels': 1,
            'sample_width': 2,
            'encoding': 'linear_pcm',
            'container': 'wav'
        }
    }
    try:
        r = await _post('/api/v1/tts/inference', json=body)
        return _audio_or_raise(r)
    except Exception as e:
        if settings.demo_fallback:
            logger.warning(f"Gnani tts_clone error: {e}, falling back to fixture")
            from app.fixtures_manager import get_fallback_tts
            return get_fallback_tts(text, is_cloned=True)
        raise

