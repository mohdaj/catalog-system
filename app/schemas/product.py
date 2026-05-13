import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.product import ProductStatus


# --- Request schemas ---

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category_id: uuid.UUID
    base_price: float = Field(..., gt=0)
    status: ProductStatus = ProductStatus.DRAFT
    attributes: Dict[str, Any] = Field(default_factory=dict)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    base_price: Optional[float] = Field(None, gt=0)
    status: Optional[ProductStatus] = None
    attributes: Optional[Dict[str, Any]] = None


class ProductImageCreate(BaseModel):
    url: str = Field(..., min_length=1)
    alt_text: Optional[str] = None
    sort_order: int = 0


class ProductImageReorder(BaseModel):
    image_ids: List[uuid.UUID]


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TagAttach(BaseModel):
    tag_id: uuid.UUID


# --- Response schemas ---

class TagResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}


class ProductImageResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    url: str
    alt_text: Optional[str]
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str]
    category_id: uuid.UUID
    base_price: float
    status: ProductStatus
    attributes: Dict[str, Any]
    images: List[ProductImageResponse] = []
    tags: List[TagResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    limit: int
    offset: int
