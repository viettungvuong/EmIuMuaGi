import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from schemas import ItemResponse, ItemCreate

router = APIRouter(prefix="/api/items", tags=["items"])

# In-memory store
items_db: list[ItemResponse] = []


@router.get("", response_model=list[ItemResponse])
async def get_items():
    return items_db


@router.post("", response_model=ItemResponse, status_code=201)
async def create_item(item: ItemCreate):
    new_item = ItemResponse(
        id=str(uuid.uuid4()),
        name=item.name,
        description=item.description,
        created_at=datetime.utcnow(),
    )
    items_db.append(new_item)
    return new_item


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: str):
    global items_db
    original_len = len(items_db)
    items_db = [i for i in items_db if i.id != item_id]
    if len(items_db) == original_len:
        raise HTTPException(status_code=404, detail="Item not found")
