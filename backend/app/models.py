from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel

def get_utc_now():
    return datetime.now(timezone.utc)

class Shop(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="Gupta Kirana Store")
    owner_name: str = Field(default="Ramesh Gupta")
    owner_phone: Optional[str] = Field(default="9876543210")
    language: str = Field(default="hi-IN")
    voice_clone_embedding: Optional[str] = Field(default=None)
    voice_clone_enrolled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

class Customer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(default=1, foreign_key="shop.id", index=True)
    name: str = Field(index=True)
    phone: Optional[str] = Field(default=None)
    language: str = Field(default="hi-IN")
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)

class LedgerEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    shop_id: int = Field(default=1, foreign_key="shop.id", index=True)
    customer_id: int = Field(foreign_key="customer.id", index=True)
    type: str = Field(index=True)  # 'credit' (udhaar) or 'payment' (jama)
    amount: float
    date: str  # YYYY-MM-DD
    due_date: Optional[str] = Field(default=None)  # YYYY-MM-DD
    description: Optional[str] = Field(default=None)
    is_cancelled: bool = Field(default=False, index=True)
    transcript: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=get_utc_now)

class Reminder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id", index=True)
    shop_id: int = Field(default=1, foreign_key="shop.id", index=True)
    amount: float
    text: str
    audio_filename: Optional[str] = Field(default=None)
    voice_type: str = Field(default="stock")  # 'cloned' or 'stock'
    language: str = Field(default="hi-IN")
    created_at: datetime = Field(default_factory=get_utc_now)

