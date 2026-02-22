from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from models.item import Item


class Clothes(Item):
    """Clothing items — adds size, color, brand, material, and gender."""

    __tablename__ = "clothes"

    id: Mapped[int] = mapped_column(ForeignKey("items.id"), primary_key=True)

    size: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)      # e.g. S, M, L, XL, 42
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    __mapper_args__ = {"polymorphic_identity": "clothes"}

    def __repr__(self) -> str:
        return (
            f"<Clothes id={self.id} name={self.item_name!r} "
            f"size={self.size!r} color={self.color!r}>"
        )
