import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.attribute import (
    AttributeDefinitionCreate,
    AttributeDefinitionResponse,
    AttributeDefinitionUpdate,
    EffectiveAttributeResponse,
)
from app.services import attribute_service

router = APIRouter(prefix="/api/v1/categories/{category_id}/attributes", tags=["Attributes"])


@router.post("", response_model=AttributeDefinitionResponse, status_code=201)
async def create_attribute(
    category_id: uuid.UUID,
    data: AttributeDefinitionCreate,
    db: AsyncSession = Depends(get_db),
):
    return await attribute_service.create_attribute(db, category_id, data)


@router.get("", response_model=list[EffectiveAttributeResponse])
async def get_effective_attributes(
    category_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    """Returns effective attributes for this category, including inherited ones."""
    return await attribute_service.get_effective_attributes(db, category_id)


@router.put("/{attr_id}", response_model=AttributeDefinitionResponse)
async def update_attribute(
    category_id: uuid.UUID,
    attr_id: uuid.UUID,
    data: AttributeDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await attribute_service.update_attribute(db, category_id, attr_id, data)


@router.delete("/{attr_id}", status_code=204)
async def delete_attribute(
    category_id: uuid.UUID, attr_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    await attribute_service.delete_attribute(db, category_id, attr_id)
