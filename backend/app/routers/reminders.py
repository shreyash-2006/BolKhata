import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc
from app.db import get_session
from app.models import Reminder
from app.schemas import (
    ReminderDraftRequest, ReminderDraftResponse, ReminderSpeakRequest, ReminderSpeakResponse
)
from app.services import reminders

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

@router.post("/draft", response_model=ReminderDraftResponse)
async def draft_reminder(req: ReminderDraftRequest, session: Session = Depends(get_session)):
    try:
        customer, balance, days_overdue, text = await reminders.prepare_reminder_draft(
            session=session,
            customer_id=req.customer_id,
            custom_lang=req.language
        )
        return ReminderDraftResponse(
            customer_id=customer.id,
            customer_name=customer.name,
            amount=balance,
            language=req.language or customer.language or "hi-IN",
            draft_text=text,
            days_overdue=days_overdue
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error drafting reminder")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/speak", response_model=ReminderSpeakResponse)
async def speak_reminder(req: ReminderSpeakRequest, session: Session = Depends(get_session)):
    try:
        filename, voice_used = await reminders.synthesize_reminder(
            session=session,
            customer_id=req.customer_id,
            text=req.text,
            voice_type=req.voice_type,
            language=req.language
        )
        return ReminderSpeakResponse(
            audio_url=f"/api/audio/{filename}",
            voice_used=voice_used,
            language=req.language
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Error synthesizing reminder")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{customer_id}", response_model=List[Reminder])
def get_reminders_history(customer_id: int, session: Session = Depends(get_session)):
    rems = session.exec(
        select(Reminder).where(Reminder.customer_id == customer_id).order_by(desc(Reminder.id))
    ).all()
    return rems
