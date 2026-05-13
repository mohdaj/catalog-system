import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.attribute import AttributeType


# --- Request schemas ---

class AttributeDefinitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    attribute_type: AttributeType
    is_required: bool = False
    is_filterable: bool = False
    options: Optional[List[str]] = None  # For select / multi_select
    sort_order: int = 0


class AttributeDefinitionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    attribute_type: Optional[AttributeType] = None
    is_required: Optional[bool] = None
    is_filterable: Optional[bool] = None
    options: Optional[List[str]] = None
    sort_order: Optional[int] = None


# --- Response schemas ---

class AttributeDefinitionResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    slug: str
    attribute_type: AttributeType
    is_required: bool
    is_filterable: bool
    options: Optional[List[str]]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EffectiveAttributeResponse(AttributeDefinitionResponse):
    """Includes source info for inherited attributes."""
    inherited_from_category_id: Optional[uuid.UUID] = None
