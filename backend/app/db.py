from sqlmodel import create_engine, Session, SQLModel, select
from app.config import settings
from app.models import Shop

engine = create_engine(
    settings.resolved_db_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.resolved_db_url else {}
)

def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
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

def get_session():
    with Session(engine) as session:
        yield session
