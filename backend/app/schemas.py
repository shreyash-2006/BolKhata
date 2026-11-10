from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class ShopResponse(BaseModel):
    id: int
    name: str
    owner_name: str
    owner_phone: Optional[str] = None
    language: str
    voice_clone_enrolled: bool

class ShopUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    language: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    language: str = "hi-IN"
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None

class CustomerResponse(BaseModel):
    id: int
    shop_id: int
    name: str
    phone: Optional[str] = None
    language: str
    notes: Optional[str] = None
    balance: float
    overdue_amount: float
    is_overdue: bool
    next_due_date: Optional[str] = None
    is_due_today: bool = False
    is_due_this_week: bool = False
    last_transaction_date: Optional[str] = None
    created_at: datetime

class LedgerEntryItem(BaseModel):
    action: str  # 'credit' (udhaar) or 'payment' (jama)
    customer_name: str
    amount: float
    due_date: Optional[str] = None
    description: Optional[str] = None

class LedgerConfirmRequest(BaseModel):
    entries: List[LedgerEntryItem]
    transcript: Optional[str] = None

class LedgerEntryResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    type: str
    amount: float
    date: str
    due_date: Optional[str] = None
    description: Optional[str] = None
    is_cancelled: bool
    transcript: Optional[str] = None
    created_at: datetime

class CustomerDetailResponse(BaseModel):
    customer: CustomerResponse
    entries: List[LedgerEntryResponse]

class LedgerSummaryResponse(BaseModel):
    total_udhaar: float
    collected_today: float
    overdue_count: int
    customers_count: int
    due_today_count: int
    due_this_week_count: int

class VoiceTranscribeResponse(BaseModel):
    success: bool
    transcript: str
    detected_language: str
    processing_time: Optional[float] = None

class VoiceProcessRequest(BaseModel):
    transcript: str
    language_hint: Optional[str] = "hi-IN"

class VoiceProcessResponse(BaseModel):
    intent: str  # 'log_entry', 'query', 'unknown'
    needs_confirmation: bool = False
    confirmation_entries: Optional[List[LedgerEntryItem]] = None
    query_answer: Optional[str] = None
    query_audio_url: Optional[str] = None
    meta: Optional[dict[str, Any]] = None

class ReminderDraftRequest(BaseModel):
    customer_id: int
    language: Optional[str] = None

class ReminderDraftResponse(BaseModel):
    customer_id: int
    customer_name: str
    amount: float
    language: str
    draft_text: str
    days_overdue: int

class ReminderSpeakRequest(BaseModel):
    customer_id: int
    text: str
    voice_type: str = "stock"  # 'cloned' or 'stock'
    language: str = "hi-IN"

class ReminderSpeakResponse(BaseModel):
    audio_url: str
    voice_used: str
    language: str
    duration: Optional[float] = None

class VoiceEnrollResponse(BaseModel):
    success: bool
    enrolled: bool
    message: str
