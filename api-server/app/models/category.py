import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    labels: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    parent: Mapped[Optional["Category"]] = relationship(
        "Category", remote_side="Category.id", back_populates="children", lazy="selectin"
    )
    children: Mapped[list["Category"]] = relationship(
        "Category", back_populates="parent", lazy="selectin"
    )
    attribute_definitions: Mapped[list["AttributeDefinition"]] = relationship(
        "AttributeDefinition", back_populates="category", lazy="selectin",
        cascade="all, delete-orphan",
    )
    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="category", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name='{self.name}', parent_id={self.parent_id})>"
