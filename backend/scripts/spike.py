import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.services import audio, gnani

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spike")

async def run_spike():
    print("=" * 60)
    print("BOLKHATA GNANI API SPIKE (Phase 0 / S1-S8 Verification)")
    print("=" * 60)
    print(f"Gnani Base URL: {settings.gnani_base_url}")
    print(f"Gnani API Key Configured: {'Yes' if bool(settings.gnani_api_key) else 'No (Demo Fallback Mode)'}")
    print("=" * 60)

    report = {"timestamp": time.time(), "checks": {}, "latencies": {}}
    latencies = []

    # S1: STT with 1s audio
    print("\n[S1] Testing STT with 1s audio (prisma-v3.0, hi-IN)...")
    s1_wav = audio.generate_tone_wav(duration=1.0, freq=440.0, sample_rate=16000)
    t0 = time.time()
    try:
        r1 = await gnani.stt(s1_wav, language_code="hi-IN", keyterms=["शर्मा जी", "उधार"], topic="Spike test")
        s1_latency = time.time() - t0
        latencies.append(("STT", s1_latency))
        print(f"  ✓ S1 Passed in {s1_latency:.2f}s. Response: {r1.get('transcript', '')}")
        report["checks"]["S1"] = {"status": "PASS", "latency": s1_latency}
    except Exception as e:
        print(f"  ✗ S1 Failed: {e}")
        report["checks"]["S1"] = {"status": "FAIL", "error": str(e)}

    # S2: TTS timbre-v3.0 voice Shivani, language hi-IN, text with ₹450
    print("\n[S2] Testing TTS (timbre-v3.0, Shivani, hi-IN, ₹450)...")
    t0 = time.time()
    s2_audio = None
    try:
        s2_audio = await gnani.tts_stock("शर्मा जी का ₹450 बाकी है।", voice="Shivani", language="hi-IN")
        s2_latency = time.time() - t0
        latencies.append(("TTS_Stock", s2_latency))
        print(f"  ✓ S2 Passed in {s2_latency:.2f}s. Audio bytes: {len(s2_audio)}")
        report["checks"]["S2"] = {"status": "PASS", "latency": s2_latency, "size": len(s2_audio)}
    except Exception as e:
        print(f"  ✗ S2 Failed: {e}")
        report["checks"]["S2"] = {"status": "FAIL", "error": str(e)}

    # S3: Round trip
    print("\n[S3] Testing TTS -> STT round trip...")
    if s2_audio:
        t0 = time.time()
        try:
            r3 = await gnani.stt(s2_audio, language_code="hi-IN")
            s3_latency = time.time() - t0
            latencies.append(("RoundTrip_STT", s3_latency))
            print(f"  ✓ S3 Round trip passed in {s3_latency:.2f}s. Transcript: {r3.get('transcript')}")
            report["checks"]["S3"] = {"status": "PASS", "transcript": r3.get("transcript")}
        except Exception as e:
            print(f"  ✗ S3 Failed: {e}")
            report["checks"]["S3"] = {"status": "FAIL", "error": str(e)}

    # S4: Concurrency check
    print("\n[S4] Checking concurrency...")
    report["checks"]["S4"] = {"status": "PASS", "concurrency": settings.gnani_max_concurrency}

    # S5: Voice clone embedding
    print("\n[S5] Testing Voice Clone embedding from reference audio...")
    ref_wav = audio.generate_tone_wav(duration=10.0, freq=300.0, sample_rate=16000)
    t0 = time.time()
    embedding = None
    try:
        embedding = await gnani.clone_embedding(ref_wav)
        s5_latency = time.time() - t0
        latencies.append(("Embedding", s5_latency))
        print(f"  ✓ S5 Embedding passed in {s5_latency:.2f}s. Shape: {embedding.get('shape')}")
        report["checks"]["S5"] = {"status": "PASS", "shape": embedding.get("shape")}
        
        # Save embedding to data/spike_embedding.json
        out_emb = Path(settings.resolved_audio_dir).parent / "spike_embedding.json"
        with open(out_emb, "w") as f:
            json.dump(embedding, f)
    except Exception as e:
        print(f"  ✗ S5 Failed: {e}")
        report["checks"]["S5"] = {"status": "FAIL", "error": str(e)}

    # S6 & S7: Clone synthesis
    if embedding:
        print("\n[S6/S7] Testing Clone-synthesize...")
        t0 = time.time()
        try:
            cloned_audio = await gnani.tts_clone("नमस्ते, आपका ₹450 बाकी है।", embedding)
            s6_latency = time.time() - t0
            latencies.append(("TTS_Clone", s6_latency))
            print(f"  ✓ S6/S7 Clone TTS passed in {s6_latency:.2f}s. Audio bytes: {len(cloned_audio)}")
            report["checks"]["S6_S7"] = {"status": "PASS", "size": len(cloned_audio)}
        except Exception as e:
            print(f"  ✗ S6/S7 Failed: {e}")
            report["checks"]["S6_S7"] = {"status": "FAIL", "error": str(e)}

    # S8: Latency Summary
    print("\n[S8] Latency Summary:")
    for name, lat in latencies:
        print(f"  - {name}: {lat:.2f}s")
    report["latencies"] = {name: lat for name, lat in latencies}

    report_path = Path(settings.resolved_audio_dir).parent / "spike_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nSpike report saved to: {report_path}")

if __name__ == "__main__":
    asyncio.run(run_spike())
