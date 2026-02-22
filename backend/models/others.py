from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from models.item import Item


class Others(Item):
    """Catch-all for items that don't fit any other category."""

    __tablename__ = "others"

    id: Mapped[int] = mapped_column(ForeignKey("items.id"), primary_key=True)

    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    __mapper_args__ = {"polymorphic_identity": "others"}

    def __repr__(self) -> str:
        return (
            f"<Others id={self.id} name={self.item_name!r} "
            f"category={self.category!r}>"
        )
