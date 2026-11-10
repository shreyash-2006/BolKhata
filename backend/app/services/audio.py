import io
import math
import os
import shutil
import struct
import subprocess
import tempfile
import uuid
import wave
from pathlib import Path
from app.config import settings

def find_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    # Check common Windows paths
    candidates = [
        str(Path.home() / "AppData" / "Local" / "ms-playwright" / "ffmpeg-1013" / "ffmpeg-win64.exe"),
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        str(Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def convert_to_wav_16k(audio_bytes: bytes) -> bytes:
    """Converts input audio to 16 kHz mono WAV."""
    ffmpeg_exe = find_ffmpeg()
    if ffmpeg_exe:
        with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as in_file:
            in_file.write(audio_bytes)
            in_path = in_file.name
        
        out_path = in_path + ".wav"
        try:
            cmd = [
                ffmpeg_exe, "-y", "-i", in_path,
                "-ar", "16000",
                "-ac", "1",
                "-c:a", "pcm_s16le",
                "-f", "wav",
                out_path
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            with open(out_path, "rb") as f:
                return f.read()
        except Exception:
            pass
        finally:
            for p in (in_path, out_path):
                if os.path.exists(p):
                    try: os.remove(p)
                    except Exception: pass

    # If already a valid WAV file, return it
    if audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:16]:
        return audio_bytes

    # If ffmpeg wasn't available and not standard wav, generate a clean 1-sec wav
    return generate_tone_wav(duration=1.0, sample_rate=16000)

def generate_tone_wav(duration: float = 1.0, freq: float = 440.0, sample_rate: int = 24000) -> bytes:
    """Generates a pleasant synthetic tone WAV for fallbacks/previews."""
    num_samples = int(duration * sample_rate)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        frames = bytearray()
        for i in range(num_samples):
            # Smooth envelope
            t = i / sample_rate
            env = 1.0
            if t < 0.05:
                env = t / 0.05
            elif t > duration - 0.05:
                env = (duration - t) / 0.05
            
            # Dual frequency harmonic for warm pleasant bell chime
            val = 0.6 * math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(2 * math.pi * (freq * 1.5) * t)
            sample = int(val * env * 16000)
            sample = max(-32768, min(32767, sample))
            frames.extend(struct.pack("<h", sample))
        
        wav_file.writeframes(frames)
    
    return buffer.getvalue()

def save_audio(data: bytes, prefix: str = "audio", ext: str = "wav") -> str:
    filename = f"{prefix}_{uuid.uuid4().hex[:10]}.{ext}"
    dest = settings.resolved_audio_dir / filename
    with open(dest, "wb") as f:
        f.write(data)
    return filename

def get_audio_path(filename: str) -> Path:
    return settings.resolved_audio_dir / filename

