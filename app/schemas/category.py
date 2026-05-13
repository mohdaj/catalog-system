import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# --- Request schemas ---

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    is_active: bool = True
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# --- Response schemas ---

class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    parent_id: Optional[uuid.UUID]
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoryTreeResponse(CategoryResponse):
    children: List["CategoryTreeResponse"] = []

    model_config = {"from_attributes": True}


# Rebuild model to resolve the forward reference
CategoryTreeResponse.model_rebuild()


class CategoryListResponse(BaseModel):
    items: List[CategoryResponse]
    total: int
