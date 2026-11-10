import sys
from pathlib import Path
from datetime import timedelta

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.db import init_db, engine
from app.models import Shop, Customer, LedgerEntry
from app.services import ledger

def seed_data():
    init_db()
    today_dt = ledger.get_today_date()
    today_str = today_dt.strftime("%Y-%m-%d")

    with Session(engine) as session:
        # 1. Ensure Shop exists
        shop = session.exec(select(Shop).where(Shop.id == 1)).first()
        if not shop:
            shop = Shop(
                id=1,
                name="Gupta Kirana Store",
                owner_name="Ramesh Gupta",
                owner_phone="9876543210",
                language="hi-IN"
            )
            session.add(shop)
            session.commit()

        # Clear existing seed customers if any
        existing_customers = session.exec(select(Customer).where(Customer.shop_id == 1)).all()
        if existing_customers:
            print(f"Database already contains {len(existing_customers)} customers. Skipping seed.")
            return

        print("Seeding BolKhata Kirana demo data...")

        # 2. Customers
        c1 = Customer(shop_id=1, name="Sharma ji", phone="9876543210", language="hi-IN", notes="Gali no. 3")
        c2 = Customer(shop_id=1, name="Verma ji", phone="9812345678", language="hi-IN", notes="Paan shop owner, overdue")
        c3 = Customer(shop_id=1, name="Gupta ji", phone="9988776655", language="hi-IN", notes="Due today")
        c4 = Customer(shop_id=1, name="Suresh Patil", phone="9123456780", language="mr-IN", notes="Speaks Marathi")
        c5 = Customer(shop_id=1, name="Patel Bhai", phone="9765432109", language="gu-IN", notes="Speaks Gujarati")

        session.add_all([c1, c2, c3, c4, c5])
        session.commit()
        for c in [c1, c2, c3, c4, c5]:
            session.refresh(c)

        # 3. Transactions
        entries = [
            # Sharma ji: balance 200
            LedgerEntry(
                shop_id=1, customer_id=c1.id, type="credit", amount=300.0,
                date=(today_dt - timedelta(days=5)).strftime("%Y-%m-%d"),
                description="chawal aur tel"
            ),
            LedgerEntry(
                shop_id=1, customer_id=c1.id, type="payment", amount=100.0,
                date=(today_dt - timedelta(days=2)).strftime("%Y-%m-%d"),
                description="rokad diya"
            ),

            # Verma ji: balance 1550, overdue by 7 days
            LedgerEntry(
                shop_id=1, customer_id=c2.id, type="credit", amount=1200.0,
                date=(today_dt - timedelta(days=15)).strftime("%Y-%m-%d"),
                due_date=(today_dt - timedelta(days=7)).strftime("%Y-%m-%d"),
                description="ghee and dry fruits"
            ),
            LedgerEntry(
                shop_id=1, customer_id=c2.id, type="credit", amount=350.0,
                date=(today_dt - timedelta(days=8)).strftime("%Y-%m-%d"),
                description="atta packet"
            ),

            # Gupta ji: balance 400, due today
            LedgerEntry(
                shop_id=1, customer_id=c3.id, type="credit", amount=400.0,
                date=(today_dt - timedelta(days=3)).strftime("%Y-%m-%d"),
                due_date=today_str,
                description="shakkar aur chai patti"
            ),

            # Suresh Patil: balance 650, Marathi customer
            LedgerEntry(
                shop_id=1, customer_id=c4.id, type="credit", amount=650.0,
                date=(today_dt - timedelta(days=18)).strftime("%Y-%m-%d"),
                due_date=(today_dt - timedelta(days=4)).strftime("%Y-%m-%d"),
                description="kirana saaman"
            ),

            # Patel Bhai: balance 820, Gujarati customer
            LedgerEntry(
                shop_id=1, customer_id=c5.id, type="credit", amount=820.0,
                date=(today_dt - timedelta(days=12)).strftime("%Y-%m-%d"),
                due_date=(today_dt - timedelta(days=2)).strftime("%Y-%m-%d"),
                description="masale aur besan"
            ),

            # A payment received today from someone else for summary testing
            LedgerEntry(
                shop_id=1, customer_id=c1.id, type="payment", amount=150.0,
                date=today_str,
                description="aaj ka jama"
            ),
        ]

        session.add_all(entries)
        session.commit()
        print("Demo seed data successfully populated!")

if __name__ == "__main__":
    seed_data()
