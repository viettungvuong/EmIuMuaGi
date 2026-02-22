from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import ConfigDict
from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from models.item import Item, ItemBase, ItemResponse


class FoodAndDrink(Item):
    """Food & drink items."""

    __tablename__ = "food_and_drink"

    id: Mapped[int] = mapped_column(ForeignKey("items.id"), primary_key=True)

    sugar: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    toppings: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    __mapper_args__ = {"polymorphic_identity": "food_and_drink"}

    def __repr__(self) -> str:
        return (
            f"<FoodAndDrink id={self.id} name={self.item_name!r} "
            f"size={self.size!r} toppings={self.toppings}>"
        )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class FoodAndDrinkCreate(ItemBase):
    item_type: Literal["food_and_drink"] = "food_and_drink"
    sugar: Optional[str] = None
    size: Optional[str] = None
    notes: Optional[str] = None
    toppings: Optional[List[str]] = None


class FoodAndDrinkResponse(ItemResponse):
    item_type: Literal["food_and_drink"]
    sugar: Optional[str] = None
    size: Optional[str] = None
    notes: Optional[str] = None
    toppings: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)
