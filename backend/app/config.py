from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    gnani_api_key: str = ""
    gnani_base_url: str = "https://api.vachana.ai"
    gnani_max_concurrency: int = 1
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5-5"
    timezone: str = "Asia/Kolkata"
    fake_today: Optional[str] = None
    database_url: str = "sqlite:///./data/bolkhata.db"
    audio_dir: str = "./data/audio"
    tts_stock_model: str = "timbre-v3.0"
    tts_stock_voice: str = "Shivani"
    vc_supported_langs: str = "hi-IN,en-IN"
    vc_number_mode: str = "digits"
    demo_fallback: bool = True

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", str(BACKEND_DIR / ".env"), str(BASE_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def resolved_audio_dir(self) -> Path:
        p = Path(self.audio_dir)
        if not p.is_absolute():
            # Check relative to BASE_DIR first
            candidate = BASE_DIR / p
            if candidate.exists() or (BASE_DIR / "data").exists():
                return candidate
            return BACKEND_DIR / p
        return p

    @property
    def resolved_db_url(self) -> str:
        if self.database_url.startswith("sqlite:///./"):
            rel_path = self.database_url.replace("sqlite:///./", "")
            db_path = BASE_DIR / rel_path
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{db_path.as_posix()}"
        return self.database_url

settings = Settings()
settings.resolved_audio_dir.mkdir(parents=True, exist_ok=True)
