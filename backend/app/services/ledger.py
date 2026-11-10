from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List
from app.config import settings
from app.models import LedgerEntry

WEEKDAYS = {
    "monday": 0, "somwar": 0, "somvaar": 0, "सोमवार": 0,
    "tuesday": 1, "mangalwar": 1, "mangalvaar": 1, "मंगलवार": 1,
    "wednesday": 2, "budhwar": 2, "budhvaar": 2, "बुधवार": 2,
    "thursday": 3, "guruwar": 3, "guruvaar": 3, "brihaspatiwar": 3, "गुरुवार": 3,
    "friday": 4, "shukrawar": 4, "shukravaar": 4, "शुक्रवार": 4,
    "saturday": 5, "shaniwar": 5, "shanivaar": 5, "शनिवार": 5,
    "sunday": 6, "raviwar": 6, "ravivaar": 6, "रविवार": 6,
}

def get_today_date() -> date:
    if settings.fake_today:
        try:
            return datetime.strptime(settings.fake_today, "%Y-%m-%d").date()
        except Exception:
            pass
    try:
        tz = ZoneInfo(settings.timezone)
        return datetime.now(tz).date()
    except Exception:
        return datetime.now().date()

def get_today() -> str:
    return get_today_date().strftime("%Y-%m-%d")

def calculate_customer_balance(entries: List[LedgerEntry]) -> float:
    total_credit = 0.0
    total_payment = 0.0
    for e in entries:
        if e.is_cancelled:
            continue
        if e.type == "credit":
            total_credit += e.amount
        elif e.type == "payment":
            total_payment += e.amount
    return round(total_credit - total_payment, 2)

def calculate_customer_overdue(entries: List[LedgerEntry], today_str: Optional[str] = None) -> tuple[float, bool, int]:
    if not today_str:
        today_str = get_today()
    today_dt = datetime.strptime(today_str, "%Y-%m-%d").date()
    
    balance = calculate_customer_balance(entries)
    if balance <= 0:
        return 0.0, False, 0

    overdue_credit_sum = 0.0
    max_days_overdue = 0

    for e in entries:
        if e.is_cancelled or e.type != "credit":
            continue
        if e.due_date:
            try:
                due_dt = datetime.strptime(e.due_date, "%Y-%m-%d").date()
                if due_dt < today_dt:
                    overdue_credit_sum += e.amount
                    diff = (today_dt - due_dt).days
                    if diff > max_days_overdue:
                        max_days_overdue = diff
            except Exception:
                pass
        else:
            # If no due_date, check if entry date is older than 30 days
            try:
                entry_dt = datetime.strptime(e.date, "%Y-%m-%d").date()
                if (today_dt - entry_dt).days > 30:
                    overdue_credit_sum += e.amount
                    diff = (today_dt - entry_dt).days - 30
                    if diff > max_days_overdue:
                        max_days_overdue = diff
            except Exception:
                pass

    overdue_amount = min(balance, overdue_credit_sum)
    is_overdue = overdue_amount > 0 or max_days_overdue > 0
    return round(overdue_amount if overdue_amount > 0 else (balance if max_days_overdue > 0 else 0.0), 2), is_overdue, max_days_overdue

def resolve_relative_date(hint: Optional[str], today_str: Optional[str] = None) -> Optional[str]:
    if not hint:
        return None
    
    clean = hint.strip().lower()
    # Check if already YYYY-MM-DD
    if len(clean) == 10 and clean[4] == '-' and clean[7] == '-':
        return clean

    if not today_str:
        today_str = get_today()
    curr = datetime.strptime(today_str, "%Y-%m-%d").date()

    if any(k in clean for k in ["aaj", "today", "आज"]):
        return curr.strftime("%Y-%m-%d")
    
    if any(k in clean for k in ["kal", "tomorrow", "कल"]):
        return (curr + timedelta(days=1)).strftime("%Y-%m-%d")
    
    if any(k in clean for k in ["parso", "parson", "day after tomorrow", "परसों"]):
        return (curr + timedelta(days=2)).strftime("%Y-%m-%d")
    
    if any(k in clean for k in ["next week", "agle hafte", "agle hafte tak", "अगले हफ्ते"]):
        return (curr + timedelta(days=7)).strftime("%Y-%m-%d")

    # Match weekdays
    for name, target_weekday in WEEKDAYS.items():
        if name in clean:
            current_weekday = curr.weekday()
            days_ahead = target_weekday - current_weekday
            if days_ahead <= 0:  # Target day already happened this week, choose next week
                days_ahead += 7
            return (curr + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # Match "X din" or "X days"
    import re
    match = re.search(r'(\d+)\s*(din|days|दिन)', clean)
    if match:
        days = int(match.group(1))
        return (curr + timedelta(days=days)).strftime("%Y-%m-%d")

    return None
