from __future__ import annotations

from typing import Literal, Optional

from pydantic import ConfigDict
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from models.item import Item, ItemBase, ItemResponse


class Clothes(Item):
    """Clothing items — adds size, color, and brand."""

    __tablename__ = "clothes"

    id: Mapped[int] = mapped_column(ForeignKey("items.id"), primary_key=True)

    size: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    __mapper_args__ = {"polymorphic_identity": "clothes"}

    def __repr__(self) -> str:
        return (
            f"<Clothes id={self.id} name={self.item_name!r} "
            f"size={self.size!r} color={self.color!r}>"
        )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ClothesCreate(ItemBase):
    item_type: Literal["clothes"] = "clothes"
    size: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None


class ClothesResponse(ItemResponse):
    item_type: Literal["clothes"]
    size: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
