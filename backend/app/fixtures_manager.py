import base64
from app.services.audio import generate_tone_wav

def get_fallback_stt(wav: bytes) -> dict:
    return {
        "success": True,
        "request_id": "demo-mock-stt-req-123",
        "transcript": "शर्मा जी ने 450 का सामान लिया, शुक्रवार तक देगा",
        "detected_language_code": "hi-IN",
        "processing_time": 0.45,
        "end_to_end_latency": 0.52
    }

def get_fallback_tts(text: str, is_cloned: bool = False) -> bytes:
    # 2.5 seconds pleasant melodious wav for demonstration
    freq = 520.0 if is_cloned else 440.0
    return generate_tone_wav(duration=2.5, freq=freq)

def get_fallback_embedding() -> dict:
    # Mock 768-dim embedding
    mock_bytes = b"\x00\x3f" * 768
    b64 = base64.b64encode(mock_bytes).decode("ascii")
    return {
        "embedding": b64,
        "shape": [1, 768],
        "dtype": "torch.bfloat16"
    }
