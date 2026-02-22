from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.item import Item
from models.clothes import Clothes
from models.food_and_drink import FoodAndDrink
from models.others import Others
from schemas import AnyItemCreate, AnyItemResponse

router = APIRouter(prefix="/api/items", tags=["items"])

# Maps item_type → SQLAlchemy model class
_MODEL_MAP = {
    "clothes": Clothes,
    "food_and_drink": FoodAndDrink,
    "others": Others,
}


@router.get("", response_model=list[AnyItemResponse])
async def get_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item))
    return result.scalars().all()


@router.post("", response_model=AnyItemResponse, status_code=201)
async def create_item(item: AnyItemCreate, db: AsyncSession = Depends(get_db)):
    model_cls = _MODEL_MAP.get(item.item_type)
    if not model_cls:
        raise HTTPException(status_code=400, detail=f"Unknown item_type: {item.item_type}")

    db_item = model_cls(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()
