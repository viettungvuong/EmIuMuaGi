from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.item import Item
from models.clothes import Clothes
from models.food_and_drink import FoodAndDrink
from models.others import Others
from schemas import AnyItemCreate, AnyItemResponse

router = APIRouter(prefix="/api/items", tags=["items"])

_MODEL_MAP = {
    "clothes": Clothes,
    "food_and_drink": FoodAndDrink,
    "others": Others,
}


@router.get("", response_model=list[AnyItemResponse])
def get_items(db: Session = Depends(get_db)):
    return db.query(Item).all()


@router.post("", response_model=AnyItemResponse, status_code=201)
def create_item(item: AnyItemCreate, db: Session = Depends(get_db)):
    model_cls = _MODEL_MAP.get(item.item_type)
    if not model_cls:
        raise HTTPException(status_code=400, detail=f"Unknown item_type: {item.item_type}")

    db_item = model_cls(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
