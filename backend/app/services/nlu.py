from typing import List, Dict, Any, Optional
from sqlmodel import Session, select
from app.models import Customer
from app.schemas import LedgerEntryItem
from app.services import llm, ledger

COMMON_LEDGER_TERMS = [
    "उधार", "जमा", "रुपये", "सामान", "राशन", "खाता", "हिसाब", "बाकी", "दुकान",
    "credit", "payment", "udhaar", "jama", "baaki", "saaman", "ration", "rupaye"
]

def build_keyterms(session: Session, shop_id: int = 1) -> List[str]:
    """Builds keyterms list (up to 200 items) to boost Gnani STT accuracy."""
    customers = session.exec(select(Customer).where(Customer.shop_id == shop_id)).all()
    terms = [c.name for c in customers]
    for t in COMMON_LEDGER_TERMS:
        if t not in terms:
            terms.append(t)
    return terms[:200]

async def process_utterance_text(transcript: str, language_hint: str = "hi-IN") -> Dict[str, Any]:
    """Calls LLM service to parse utterance and resolves dates and entities."""
    raw = await llm.parse_utterance(transcript, language_hint)
    intent = raw.get("intent", "unknown")

    if intent == "log_entry":
        raw_entries = raw.get("entries", [])
        validated_entries: List[LedgerEntryItem] = []
        for item in raw_entries:
            act = item.get("action", "credit")
            c_name = item.get("customer_name", "").strip() or "ग्राहक"
            amt = float(item.get("amount", 0.0))
            hint = item.get("due_date_hint")
            due_d = ledger.resolve_relative_date(hint)
            desc = item.get("description", "saaman")
            validated_entries.append(
                LedgerEntryItem(
                    action=act,
                    customer_name=c_name,
                    amount=amt,
                    due_date=due_d,
                    description=desc
                )
            )
        return {
            "intent": "log_entry",
            "needs_confirmation": True,
            "entries": validated_entries
        }

    elif intent == "query":
        q = raw.get("query", {})
        return {
            "intent": "query",
            "needs_confirmation": False,
            "query_type": q.get("query_type", "customer_balance"),
            "customer_name": q.get("customer_name")
        }

    return {
        "intent": "unknown",
        "needs_confirmation": False
    }
