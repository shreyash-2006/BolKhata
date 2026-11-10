from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, desc
from app.db import get_session
from app.models import Customer, LedgerEntry
from app.schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerDetailResponse,
    LedgerConfirmRequest, LedgerEntryResponse, LedgerSummaryResponse
)
from app.services import ledger

router = APIRouter(prefix="/api/ledger", tags=["ledger"])

def build_customer_response(c: Customer, entries: List[LedgerEntry], today_str: str) -> CustomerResponse:
    balance = ledger.calculate_customer_balance(entries)
    overdue_amt, is_overdue, _ = ledger.calculate_customer_overdue(entries, today_str)
    
    last_tx_date = None
    active_entries = [e for e in entries if not e.is_cancelled]
    if active_entries:
        active_entries.sort(key=lambda x: x.date, reverse=True)
        last_tx_date = active_entries[0].date

    return CustomerResponse(
        id=c.id,
        shop_id=c.shop_id,
        name=c.name,
        phone=c.phone,
        language=c.language,
        notes=c.notes,
        balance=balance,
        overdue_amount=overdue_amt,
        is_overdue=is_overdue,
        last_transaction_date=last_tx_date,
        created_at=c.created_at
    )

@router.get("/summary", response_model=LedgerSummaryResponse)
def get_ledger_summary(session: Session = Depends(get_session)):
    today_str = ledger.get_today()
    customers = session.exec(select(Customer).where(Customer.shop_id == 1)).all()
    entries = session.exec(select(LedgerEntry).where(LedgerEntry.shop_id == 1)).all()

    total_udhaar = 0.0
    collected_today = 0.0
    overdue_count = 0
    due_today_count = 0
    due_this_week_count = 0

    # Group entries by customer
    entries_by_cust: dict[int, list[LedgerEntry]] = {}
    for e in entries:
        entries_by_cust.setdefault(e.customer_id, []).append(e)

    for c in customers:
        c_entries = entries_by_cust.get(c.id, [])
        bal = ledger.calculate_customer_balance(c_entries)
        if bal > 0:
            total_udhaar += bal
        
        _, is_overdue, _ = ledger.calculate_customer_overdue(c_entries, today_str)
        if is_overdue:
            overdue_count += 1

    # Today & Week checks
    today_dt = ledger.get_today_date()
    from datetime import timedelta
    week_end = today_dt + timedelta(days=7)

    for e in entries:
        if e.is_cancelled:
            continue
        if e.type == "payment" and e.date == today_str:
            collected_today += e.amount
        if e.type == "credit" and e.due_date:
            try:
                d_dt = datetime.strptime(e.due_date, "%Y-%m-%d").date()
                if d_dt == today_dt:
                    due_today_count += 1
                elif today_dt <= d_dt <= week_end:
                    due_this_week_count += 1
            except Exception:
                pass

    return LedgerSummaryResponse(
        total_udhaar=round(total_udhaar, 2),
        collected_today=round(collected_today, 2),
        overdue_count=overdue_count,
        customers_count=len(customers),
        due_today_count=due_today_count,
        due_this_week_count=due_this_week_count
    )

@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(session: Session = Depends(get_session)):
    today_str = ledger.get_today()
    customers = session.exec(select(Customer).where(Customer.shop_id == 1)).all()
    entries = session.exec(select(LedgerEntry).where(LedgerEntry.shop_id == 1)).all()
    
    entries_by_cust: dict[int, list[LedgerEntry]] = {}
    for e in entries:
        entries_by_cust.setdefault(e.customer_id, []).append(e)

    results = []
    for c in customers:
        results.append(build_customer_response(c, entries_by_cust.get(c.id, []), today_str))
    
    # Sort: overdue first, then largest balance
    results.sort(key=lambda x: (not x.is_overdue, -x.balance))
    return results

@router.get("/customers/{customer_id}", response_model=CustomerDetailResponse)
def get_customer_detail(customer_id: int, session: Session = Depends(get_session)):
    today_str = ledger.get_today()
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    entries = session.exec(
        select(LedgerEntry).where(LedgerEntry.customer_id == customer_id).order_by(desc(LedgerEntry.id))
    ).all()

    c_resp = build_customer_response(c, entries, today_str)
    e_resp = [
        LedgerEntryResponse(
            id=e.id,
            customer_id=e.customer_id,
            customer_name=c.name,
            type=e.type,
            amount=e.amount,
            date=e.date,
            due_date=e.due_date,
            description=e.description,
            is_cancelled=e.is_cancelled,
            transcript=e.transcript,
            created_at=e.created_at
        )
        for e in entries
    ]

    return CustomerDetailResponse(customer=c_resp, entries=e_resp)

@router.post("/customers", response_model=CustomerResponse)
def create_customer(req: CustomerCreate, session: Session = Depends(get_session)):
    cust = Customer(
        shop_id=1,
        name=req.name.strip(),
        phone=req.phone,
        language=req.language or "hi-IN",
        notes=req.notes
    )
    session.add(cust)
    session.commit()
    session.refresh(cust)
    return build_customer_response(cust, [], ledger.get_today())

@router.post("/confirm", response_model=List[LedgerEntryResponse])
def confirm_ledger_entries(req: LedgerConfirmRequest, session: Session = Depends(get_session)):
    """Human-confirmed entries tap (Rule 6). Saves entries to database."""
    today_str = ledger.get_today()
    saved_responses = []

    for item in req.entries:
        c_name = item.customer_name.strip()
        # Find matching customer or create
        cust = session.exec(
            select(Customer).where(Customer.shop_id == 1, Customer.name.ilike(c_name))
        ).first()

        if not cust:
            cust = Customer(shop_id=1, name=c_name, language="hi-IN")
            session.add(cust)
            session.commit()
            session.refresh(cust)

        entry = LedgerEntry(
            shop_id=1,
            customer_id=cust.id,
            type=item.action,
            amount=item.amount,
            date=today_str,
            due_date=item.due_date,
            description=item.description,
            transcript=req.transcript
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)

        saved_responses.append(
            LedgerEntryResponse(
                id=entry.id,
                customer_id=cust.id,
                customer_name=cust.name,
                type=entry.type,
                amount=entry.amount,
                date=entry.date,
                due_date=entry.due_date,
                description=entry.description,
                is_cancelled=entry.is_cancelled,
                transcript=entry.transcript,
                created_at=entry.created_at
            )
        )

    return saved_responses

@router.post("/undo", response_model=LedgerEntryResponse)
def undo_last_entry(session: Session = Depends(get_session)):
    """Undoes the last uncancelled ledger entry (P1)."""
    last_entry = session.exec(
        select(LedgerEntry)
        .where(LedgerEntry.shop_id == 1, LedgerEntry.is_cancelled == False)
        .order_by(desc(LedgerEntry.id))
    ).first()

    if not last_entry:
        raise HTTPException(status_code=400, detail="No active entries to undo")

    last_entry.is_cancelled = True
    session.add(last_entry)
    session.commit()
    session.refresh(last_entry)

    cust = session.get(Customer, last_entry.customer_id)
    return LedgerEntryResponse(
        id=last_entry.id,
        customer_id=last_entry.customer_id,
        customer_name=cust.name if cust else "ग्राहक",
        type=last_entry.type,
        amount=last_entry.amount,
        date=last_entry.date,
        due_date=last_entry.due_date,
        description=last_entry.description,
        is_cancelled=last_entry.is_cancelled,
        transcript=last_entry.transcript,
        created_at=last_entry.created_at
    )
