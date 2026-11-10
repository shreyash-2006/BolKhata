import json
import logging
from typing import Optional, Tuple
from sqlmodel import Session, select
from app.config import settings
from app.models import Customer, LedgerEntry, Reminder, Shop
from app.services import audio, gnani, ledger, llm

logger = logging.getLogger(__name__)

async def prepare_reminder_draft(session: Session, customer_id: int, custom_lang: Optional[str] = None) -> Tuple[Customer, float, int, str]:
    customer = session.get(Customer, customer_id)
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")
    
    shop = session.get(Shop, customer.shop_id)
    shop_name = shop.name if shop else "किराना स्टोर"

    entries = session.exec(
        select(LedgerEntry).where(LedgerEntry.customer_id == customer_id)
    ).all()

    balance = ledger.calculate_customer_balance(entries)
    overdue_amt, is_overdue, days_overdue = ledger.calculate_customer_overdue(entries)

    lang = custom_lang or customer.language or "hi-IN"
    text = await llm.draft_reminder_text(
        customer_name=customer.name,
        shop_name=shop_name,
        amount=balance,
        days_overdue=days_overdue,
        language=lang
    )

    return customer, balance, days_overdue, text

async def synthesize_reminder(
    session: Session,
    customer_id: int,
    text: str,
    voice_type: str = "stock",
    language: str = "hi-IN"
) -> Tuple[str, str]:
    """Returns (audio_filename, voice_used)"""
    customer = session.get(Customer, customer_id)
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    shop = session.get(Shop, customer.shop_id)
    voice_used = "stock"
    audio_data = None

    if voice_type == "cloned" and shop and shop.voice_clone_enrolled and shop.voice_clone_embedding:
        try:
            embedding = json.loads(shop.voice_clone_embedding)
            audio_data = await gnani.tts_clone(text, embedding)
            voice_used = "cloned"
        except Exception as e:
            logger.warning(f"Cloned TTS failed ({e}), falling back to stock voice")
            voice_used = "stock_fallback"

    if not audio_data:
        audio_data = await gnani.tts_stock(
            text=text,
            voice=settings.tts_stock_voice,
            language=language,
            model=settings.tts_stock_model
        )
        if voice_used != "stock_fallback":
            voice_used = "stock"

    filename = audio.save_audio(audio_data, prefix=f"rem_{customer_id}")
    
    entries = session.exec(select(LedgerEntry).where(LedgerEntry.customer_id == customer_id)).all()
    balance = ledger.calculate_customer_balance(entries)

    rem_entry = Reminder(
        customer_id=customer_id,
        shop_id=customer.shop_id,
        amount=balance,
        text=text,
        audio_filename=filename,
        voice_type=voice_used,
        language=language
    )
    session.add(rem_entry)
    session.commit()

    return filename, voice_used
