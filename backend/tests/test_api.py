import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from app.main import app
from app.db import get_session
from app.models import Shop, Customer, LedgerEntry
from app.services import ledger

@pytest.fixture(name="client")
def client_fixture():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(test_engine)

    with Session(test_engine) as session:
        shop = Shop(id=1, name="Gupta Kirana Store", owner_name="Ramesh Gupta", language="hi-IN")
        session.add(shop)
        session.commit()

    def get_test_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_shop_get_and_update(client):
    r = client.get("/api/shop")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Gupta Kirana Store"

    r = client.post("/api/shop", json={"name": "New Apna Kirana"})
    assert r.status_code == 200
    assert r.json()["name"] == "New Apna Kirana"

def test_ledger_math_pure():
    today = "2026-11-10"
    entries = [
        LedgerEntry(shop_id=1, customer_id=1, type="credit", amount=500.0, date="2026-11-01", due_date="2026-11-05"),
        LedgerEntry(shop_id=1, customer_id=1, type="payment", amount=200.0, date="2026-11-06"),
    ]
    bal = ledger.calculate_customer_balance(entries)
    assert bal == 300.0

    overdue_amt, is_overdue, days = ledger.calculate_customer_overdue(entries, today)
    assert is_overdue is True
    assert overdue_amt == 300.0
    assert days == 5

def test_confirm_entry_and_undo(client):
    # Confirm entry via card (Rule 6)
    payload = {
        "entries": [
            {
                "action": "credit",
                "customer_name": "Sharma Ji",
                "amount": 450.0,
                "due_date": "2026-11-14",
                "description": "saaman"
            }
        ],
        "transcript": "sharma ji ne 450 ka saaman liya"
    }
    r = client.post("/api/ledger/confirm", json=payload)
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1
    assert entries[0]["amount"] == 450.0
    assert entries[0]["customer_name"] == "Sharma Ji"

    # Verify customer was created
    r_cust = client.get("/api/ledger/customers")
    assert r_cust.status_code == 200
    custs = r_cust.json()
    assert any(c["name"] == "Sharma Ji" and c["balance"] == 450.0 for c in custs)

    # Undo last entry (P1)
    r_undo = client.post("/api/ledger/undo")
    assert r_undo.status_code == 200
    assert r_undo.json()["is_cancelled"] is True

    # Balance should now be 0
    r_cust = client.get("/api/ledger/customers")
    assert r_cust.json()[0]["balance"] == 0.0

def test_voice_process_log_entry(client):
    r = client.post("/api/voice/process", json={"transcript": "Sharma ji ne 450 ka saaman liya Friday tak dega"})
    assert r.status_code == 200
    data = r.json()
    assert data["intent"] == "log_entry"
    assert data["needs_confirmation"] is True
    assert len(data["confirmation_entries"]) > 0
    entry = data["confirmation_entries"][0]
    assert entry["action"] == "credit"
    assert entry["amount"] == 450.0

def test_voice_process_query(client):
    # First create Verma ji with balance
    client.post("/api/ledger/confirm", json={
        "entries": [{"action": "credit", "customer_name": "Verma ji", "amount": 600.0}]
    })

    r = client.post("/api/voice/process", json={"transcript": "Verma ji ka kitna baaki hai?"})
    assert r.status_code == 200
    data = r.json()
    assert data["intent"] == "query"
    assert "वर्मा" in data["query_answer"] or "Verma" in data["query_answer"] or "600" in data["query_answer"]

def test_reminder_draft_and_speak(client):
    # Create customer with credit
    client.post("/api/ledger/confirm", json={
        "entries": [{"action": "credit", "customer_name": "Ramesh", "amount": 350.0}]
    })
    custs = client.get("/api/ledger/customers").json()
    ramesh = [c for c in custs if c["name"] == "Ramesh"][0]

    r_draft = client.post("/api/reminders/draft", json={"customer_id": ramesh["id"]})
    assert r_draft.status_code == 200
    draft_data = r_draft.json()
    assert draft_data["amount"] == 350.0
    assert len(draft_data["draft_text"]) > 10

    r_speak = client.post("/api/reminders/speak", json={
        "customer_id": ramesh["id"],
        "text": draft_data["draft_text"],
        "voice_type": "stock",
        "language": "hi-IN"
    })
    assert r_speak.status_code == 200
    speak_data = r_speak.json()
    assert "audio_url" in speak_data
