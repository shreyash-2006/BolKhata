from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.services.audio import get_audio_path

router = APIRouter(prefix="/api/audio", tags=["audio"])

@router.get("/{filename}")
async def stream_audio(filename: str):
    path = get_audio_path(filename)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path, media_type="audio/wav")
