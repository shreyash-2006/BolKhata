import json
import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select
from app.db import get_session
from app.models import Customer, LedgerEntry, Shop
from app.schemas import (
    VoiceTranscribeResponse, VoiceProcessRequest, VoiceProcessResponse, VoiceEnrollResponse
)
from app.services import audio, gnani, ledger, llm, nlu

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

@router.post("/transcribe", response_model=VoiceTranscribeResponse)
async def transcribe_voice(
    audio_file: UploadFile = File(...),
    language_code: str = "hi-IN,en-IN",
    session: Session = Depends(get_session)
):
    try:
        content = await audio_file.read()
        if len(content) < 100:
            raise HTTPException(status_code=400, detail="Audio file too short or empty")

        wav_bytes = audio.convert_to_wav_16k(content)
        keyterms = nlu.build_keyterms(session, shop_id=1)

        result = await gnani.stt(
            wav=wav_bytes,
            language_code=language_code,
            keyterms=keyterms,
            topic="Kirana store credit ledger transactions"
        )

        transcript = result.get("transcript", "")
        detected_lang = result.get("detected_language_code", "hi-IN")
        proc_time = result.get("processing_time")

        return VoiceTranscribeResponse(
            success=True,
            transcript=transcript,
            detected_language=detected_lang,
            processing_time=proc_time
        )
    except gnani.GnaniError as e:
        raise HTTPException(status_code=e.status, detail=f"{e.code}: {e.message}")
    except Exception as e:
        logger.exception("Transcription error")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process", response_model=VoiceProcessResponse)
async def process_voice_command(
    req: VoiceProcessRequest,
    session: Session = Depends(get_session)
):
    """Processes transcript: returns confirm card for entries, or answers queries."""
    parsed = await nlu.process_utterance_text(req.transcript, req.language_hint or "hi-IN")
    intent = parsed.get("intent", "unknown")

    if intent == "log_entry":
        return VoiceProcessResponse(
            intent="log_entry",
            needs_confirmation=True,
            confirmation_entries=parsed.get("entries", []),
            meta={"raw_transcript": req.transcript}
        )

    elif intent == "query":
        query_type = parsed.get("query_type", "customer_balance")
        target_name = parsed.get("customer_name")
        today_str = ledger.get_today()

        customers = session.exec(select(Customer).where(Customer.shop_id == 1)).all()
        entries = session.exec(select(LedgerEntry).where(LedgerEntry.shop_id == 1)).all()

        entries_by_cust: dict[int, list[LedgerEntry]] = {}
        for e in entries:
            entries_by_cust.setdefault(e.customer_id, []).append(e)

        answer_data: dict = {}

        if query_type == "customer_balance":
            matched_cust = None
            if target_name:
                for c in customers:
                    if target_name.lower() in c.name.lower() or c.name.lower() in target_name.lower():
                        matched_cust = c
                        break
            if not matched_cust and customers:
                matched_cust = customers[0]

            if matched_cust:
                c_entries = entries_by_cust.get(matched_cust.id, [])
                bal = ledger.calculate_customer_balance(c_entries)
                answer_data = {
                    "customer_name": matched_cust.name,
                    "balance": bal
                }
            else:
                answer_data = {"customer_name": target_name or "ग्राहक", "balance": 0.0}

        elif query_type == "overdue_list":
            overdue_names = []
            for c in customers:
                c_entries = entries_by_cust.get(c.id, [])
                _, is_overdue, _ = ledger.calculate_customer_overdue(c_entries, today_str)
                if is_overdue:
                    overdue_names.append(c.name)
            answer_data = {
                "overdue_count": len(overdue_names),
                "overdue_names": overdue_names
            }

        elif query_type == "due_today":
            today_dt = ledger.get_today_date()
            due_names = []
            for e in entries:
                if not e.is_cancelled and e.type == "credit" and e.due_date == today_str:
                    c = session.get(Customer, e.customer_id)
                    if c and c.name not in due_names:
                        due_names.append(c.name)
            answer_data = {
                "due_today_count": len(due_names),
                "due_today_names": due_names
            }

        answer_text = llm.format_query_answer(query_type, answer_data, req.language_hint or "hi-IN")
        
        # Synthesize spoken answer audio
        audio_url = None
        try:
            tts_bytes = await gnani.tts_stock(
                text=answer_text,
                language=req.language_hint or "hi-IN"
            )
            filename = audio.save_audio(tts_bytes, prefix="ans")
            audio_url = f"/api/audio/{filename}"
        except Exception as e:
            logger.warning(f"Could not synthesize query answer audio: {e}")

        return VoiceProcessResponse(
            intent="query",
            needs_confirmation=False,
            query_answer=answer_text,
            query_audio_url=audio_url,
            meta={"query_type": query_type, "data": answer_data}
        )

    return VoiceProcessResponse(
        intent="unknown",
        needs_confirmation=False,
        query_answer="माफ कीजिए, आपका संदेश समझ नहीं आया। कृपया दोबारा बोलें।"
    )

@router.post("/enroll-clone", response_model=VoiceEnrollResponse)
async def enroll_voice_clone(
    audio_file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Enrolls shopkeeper voice clone using reference audio (8-30s)."""
    try:
        content = await audio_file.read()
        if len(content) < 1000:
            raise HTTPException(status_code=400, detail="Voice recording too short. Please speak for at least 8-10 seconds.")

        wav_bytes = audio.convert_to_wav_16k(content)
        embedding_dict = await gnani.clone_embedding(wav_bytes)

        shop = session.exec(select(Shop).where(Shop.id == 1)).first()
        if not shop:
            raise HTTPException(status_code=404, detail="Shop not found")

        shop.voice_clone_embedding = json.dumps(embedding_dict)
        shop.voice_clone_enrolled = True
        session.add(shop)
        session.commit()

        return VoiceEnrollResponse(
            success=True,
            enrolled=True,
            message="Voice clone successfully enrolled! Reminders can now be spoken in your voice."
        )
    except gnani.GnaniError as e:
        raise HTTPException(status_code=e.status, detail=f"{e.code}: {e.message}")
    except Exception as e:
        logger.exception("Voice clone enrollment error")
        raise HTTPException(status_code=500, detail=str(e))
