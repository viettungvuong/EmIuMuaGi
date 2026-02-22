from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Item(Base):
    """Base shopping item — all item types share these fields."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    buy_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    shop_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    # Discriminator column — tells SQLAlchemy which subclass to instantiate
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)

    __mapper_args__ = {
        "polymorphic_identity": "item",
        "polymorphic_on": "item_type",
    }

    def __repr__(self) -> str:
        return f"<Item id={self.id} name={self.item_name!r} qty={self.quantity}>"
