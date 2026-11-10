from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Shop
from app.schemas import ShopResponse, ShopUpdate

router = APIRouter(prefix="/api/shop", tags=["shop"])

@router.get("", response_model=ShopResponse)
def get_shop(session: Session = Depends(get_session)):
    shop = session.exec(select(Shop).where(Shop.id == 1)).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return ShopResponse(
        id=shop.id,
        name=shop.name,
        owner_name=shop.owner_name,
        owner_phone=shop.owner_phone,
        language=shop.language,
        voice_clone_enrolled=shop.voice_clone_enrolled
    )

@router.post("", response_model=ShopResponse)
def update_shop(update: ShopUpdate, session: Session = Depends(get_session)):
    shop = session.exec(select(Shop).where(Shop.id == 1)).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    if update.name is not None:
        shop.name = update.name
    if update.owner_name is not None:
        shop.owner_name = update.owner_name
    if update.owner_phone is not None:
        shop.owner_phone = update.owner_phone
    if update.language is not None:
        shop.language = update.language

    session.add(shop)
    session.commit()
    session.refresh(shop)

    return ShopResponse(
        id=shop.id,
        name=shop.name,
        owner_name=shop.owner_name,
        owner_phone=shop.owner_phone,
        language=shop.language,
        voice_clone_enrolled=shop.voice_clone_enrolled
    )
