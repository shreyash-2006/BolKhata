import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings, BASE_DIR
from app.db import init_db
from app.routers import shop, ledger, voice, reminders, audio

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("bolkhata")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing BolKhata database...")
    init_db()
    logger.info("BolKhata ready.")
    yield

app = FastAPI(
    title="BolKhata (Udhaar Khata Voice)",
    description="Voice-first mobile ledger for Kirana shopkeepers",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(shop.router)
app.include_router(ledger.router)
app.include_router(voice.router)
app.include_router(reminders.router)
app.include_router(audio.router)

# Mount frontend/dist if available
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "app": "BolKhata API",
            "status": "online",
            "docs": "/docs",
            "frontend": "Run 'npm run build' in frontend/ to serve the SPA from FastAPI, or 'npm run dev' on :5173"
        }
