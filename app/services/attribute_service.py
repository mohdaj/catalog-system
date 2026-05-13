import uuid
from typing import Any

from fastapi import HTTPException
from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attribute import AttributeDefinition, AttributeType
from app.models.category import Category
from app.schemas.attribute import (
    AttributeDefinitionCreate,
    AttributeDefinitionUpdate,
    EffectiveAttributeResponse,
)
from app.services.category_service import get_ancestors, get_category


async def create_attribute(
    db: AsyncSession, category_id: uuid.UUID, data: AttributeDefinitionCreate
) -> AttributeDefinition:
    await get_category(db, category_id)  # Ensure category exists

    slug = slugify(data.name, separator="_")

    # Check unique within category
    existing = await db.execute(
        select(AttributeDefinition).where(
            AttributeDefinition.category_id == category_id,
            AttributeDefinition.slug == slug,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Attribute '{slug}' already exists in this category")

    # Validate options for select types
    if data.attribute_type in (AttributeType.SELECT, AttributeType.MULTI_SELECT):
        if not data.options or len(data.options) == 0:
            raise HTTPException(
                status_code=400,
                detail="Options are required for select/multi_select attribute types",
            )

    attr = AttributeDefinition(
        category_id=category_id,
        name=data.name,
        slug=slug,
        attribute_type=data.attribute_type,
        is_required=data.is_required,
        is_filterable=data.is_filterable,
        options=data.options,
        sort_order=data.sort_order,
    )
    db.add(attr)
    await db.flush()
    await db.refresh(attr)
    return attr


async def update_attribute(
    db: AsyncSession, category_id: uuid.UUID, attr_id: uuid.UUID, data: AttributeDefinitionUpdate
) -> AttributeDefinition:
    attr = await db.get(AttributeDefinition, attr_id)
    if not attr or attr.category_id != category_id:
        raise HTTPException(status_code=404, detail="Attribute not found in this category")

    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["slug"] = slugify(update_data["name"], separator="_")

    for key, value in update_data.items():
        setattr(attr, key, value)

    await db.flush()
    await db.refresh(attr)
    return attr


async def delete_attribute(db: AsyncSession, category_id: uuid.UUID, attr_id: uuid.UUID) -> None:
    attr = await db.get(AttributeDefinition, attr_id)
    if not attr or attr.category_id != category_id:
        raise HTTPException(status_code=404, detail="Attribute not found in this category")
    await db.delete(attr)
    await db.flush()


async def get_effective_attributes(
    db: AsyncSession, category_id: uuid.UUID
) -> list[EffectiveAttributeResponse]:
    """
    Get merged attribute definitions for a category, including inherited ones.
    Walk from root -> current category. Child definitions override parent ones (by slug).
    """
    category = await get_category(db, category_id)
    ancestors = await get_ancestors(db, category_id)

    # Build chain: [root, ..., parent, current]
    chain = ancestors + [category]

    # Merge: later entries override earlier by slug
    merged: dict[str, EffectiveAttributeResponse] = {}

    for cat in chain:
        result = await db.execute(
            select(AttributeDefinition)
            .where(AttributeDefinition.category_id == cat.id)
            .order_by(AttributeDefinition.sort_order)
        )
        attrs = result.scalars().all()

        for attr in attrs:
            inherited_from = cat.id if cat.id != category_id else None
            merged[attr.slug] = EffectiveAttributeResponse(
                id=attr.id,
                category_id=attr.category_id,
                name=attr.name,
                slug=attr.slug,
                attribute_type=attr.attribute_type,
                is_required=attr.is_required,
                is_filterable=attr.is_filterable,
                options=attr.options,
                sort_order=attr.sort_order,
                created_at=attr.created_at,
                updated_at=attr.updated_at,
                inherited_from_category_id=inherited_from,
            )

    return list(merged.values())


async def validate_product_attributes(
    db: AsyncSession, category_id: uuid.UUID, attributes: dict[str, Any]
) -> list[str]:
    """
    Validate product attributes against the effective attribute definitions.
    Returns a list of error messages (empty = valid).
    """
    effective_attrs = await get_effective_attributes(db, category_id)
    errors: list[str] = []

    attr_map = {a.slug: a for a in effective_attrs}

    # Check required fields
    for attr_def in effective_attrs:
        if attr_def.is_required and attr_def.slug not in attributes:
            errors.append(f"Missing required attribute: '{attr_def.slug}'")

    # Validate provided values
    for key, value in attributes.items():
        if key not in attr_map:
            errors.append(f"Unknown attribute: '{key}'")
            continue

        attr_def = attr_map[key]

        if attr_def.attribute_type == AttributeType.TEXT:
            if not isinstance(value, str):
                errors.append(f"Attribute '{key}' must be a string")

        elif attr_def.attribute_type == AttributeType.NUMBER:
            if not isinstance(value, (int, float)):
                errors.append(f"Attribute '{key}' must be a number")

        elif attr_def.attribute_type == AttributeType.BOOLEAN:
            if not isinstance(value, bool):
                errors.append(f"Attribute '{key}' must be a boolean")

        elif attr_def.attribute_type == AttributeType.SELECT:
            if attr_def.options and value not in attr_def.options:
                errors.append(f"Attribute '{key}' must be one of: {attr_def.options}")

        elif attr_def.attribute_type == AttributeType.MULTI_SELECT:
            if not isinstance(value, list):
                errors.append(f"Attribute '{key}' must be a list")
            elif attr_def.options:
                invalid = [v for v in value if v not in attr_def.options]
                if invalid:
                    errors.append(f"Attribute '{key}' contains invalid options: {invalid}")

    return errors
