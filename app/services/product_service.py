from __future__ import annotations

import uuid
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException
from slugify import slugify
from sqlalchemy import select, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product, ProductImage, ProductStatus, Tag, ProductTag
from app.schemas.product import ProductCreate, ProductUpdate, ProductImageCreate
from app.services.attribute_service import validate_product_attributes
from app.services.category_service import get_category


async def create_product(db: AsyncSession, data: ProductCreate) -> Product:
    # Validate category exists
    await get_category(db, data.category_id)

    # Validate dynamic attributes
    errors = await validate_product_attributes(db, data.category_id, data.attributes)
    if errors:
        raise HTTPException(status_code=400, detail={"attribute_errors": errors})

    slug = slugify(data.name)
    existing = await db.execute(select(Product).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    product = Product(
        name=data.name,
        slug=slug,
        description=data.description,
        category_id=data.category_id,
        base_price=data.base_price,
        status=data.status,
        attributes=data.attributes,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


async def get_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.images),
            selectinload(Product.tags),
            selectinload(Product.category),
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


async def list_products(
    db: AsyncSession,
    *,
    category_id: Optional[uuid.UUID] = None,
    status: Optional[ProductStatus] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    attr_filters: Optional[Dict[str, str]] = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[Product], int]:
    query = select(Product)
    count_query = select(func.count(Product.id))

    # Apply filters
    if category_id:
        query = query.where(Product.category_id == category_id)
        count_query = count_query.where(Product.category_id == category_id)
    if status:
        query = query.where(Product.status == status)
        count_query = count_query.where(Product.status == status)
    if min_price is not None:
        query = query.where(Product.base_price >= min_price)
        count_query = count_query.where(Product.base_price >= min_price)
    if max_price is not None:
        query = query.where(Product.base_price <= max_price)
        count_query = count_query.where(Product.base_price <= max_price)

    # Dynamic attribute filtering via JSONB
    if attr_filters:
        for key, value in attr_filters.items():
            query = query.where(
                cast(Product.attributes[key].astext, String) == value
            )
            count_query = count_query.where(
                cast(Product.attributes[key].astext, String) == value
            )

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = (
        query
        .options(selectinload(Product.images), selectinload(Product.tags))
        .order_by(Product.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    products = list(result.scalars().all())

    return products, total


async def update_product(
    db: AsyncSession, product_id: uuid.UUID, data: ProductUpdate
) -> Product:
    product = await get_product(db, product_id)
    update_data = data.model_dump(exclude_unset=True)

    # If category or attributes changed, re-validate
    category_id = update_data.get("category_id", product.category_id)
    if "attributes" in update_data:
        errors = await validate_product_attributes(db, category_id, update_data["attributes"])
        if errors:
            raise HTTPException(status_code=400, detail={"attribute_errors": errors})

    if "name" in update_data and update_data["name"]:
        update_data["slug"] = slugify(update_data["name"])

    for key, value in update_data.items():
        setattr(product, key, value)

    await db.flush()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, product_id: uuid.UUID) -> None:
    product = await get_product(db, product_id)
    await db.delete(product)
    await db.flush()


async def search_products(
    db: AsyncSession, query_text: str, limit: int = 20, offset: int = 0
) -> Tuple[List[Product], int]:
    """Basic search on product name and description."""
    search_filter = Product.name.ilike(f"%{query_text}%") | Product.description.ilike(
        f"%{query_text}%"
    )

    count_result = await db.execute(
        select(func.count(Product.id)).where(search_filter)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Product)
        .where(search_filter)
        .options(selectinload(Product.images), selectinload(Product.tags))
        .order_by(Product.name)
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all()), total


# --- Product Images ---

async def add_product_image(
    db: AsyncSession, product_id: uuid.UUID, data: ProductImageCreate
) -> ProductImage:
    await get_product(db, product_id)
    image = ProductImage(
        product_id=product_id,
        url=data.url,
        alt_text=data.alt_text,
        sort_order=data.sort_order,
    )
    db.add(image)
    await db.flush()
    await db.refresh(image)
    return image


async def delete_product_image(
    db: AsyncSession, product_id: uuid.UUID, image_id: uuid.UUID
) -> None:
    image = await db.get(ProductImage, image_id)
    if not image or image.product_id != product_id:
        raise HTTPException(status_code=404, detail="Image not found")
    await db.delete(image)
    await db.flush()


async def reorder_product_images(
    db: AsyncSession, product_id: uuid.UUID, image_ids: list[uuid.UUID]
) -> list[ProductImage]:
    await get_product(db, product_id)
    for idx, image_id in enumerate(image_ids):
        image = await db.get(ProductImage, image_id)
        if not image or image.product_id != product_id:
            raise HTTPException(status_code=404, detail=f"Image {image_id} not found")
        image.sort_order = idx
    await db.flush()

    result = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order)
    )
    return list(result.scalars().all())


# --- Tags ---

async def create_tag(db: AsyncSession, name: str) -> Tag:
    slug = slugify(name)
    existing = await db.execute(select(Tag).where(Tag.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag already exists")

    tag = Tag(name=name, slug=slug)
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


async def list_tags(db: AsyncSession) -> list[Tag]:
    result = await db.execute(select(Tag).order_by(Tag.name))
    return list(result.scalars().all())


async def attach_tag(db: AsyncSession, product_id: uuid.UUID, tag_id: uuid.UUID) -> None:
    await get_product(db, product_id)
    tag = await db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if already attached
    from sqlalchemy import and_
    existing = await db.execute(
        select(ProductTag).where(
            and_(ProductTag.c.product_id == product_id, ProductTag.c.tag_id == tag_id)
        )
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="Tag already attached")

    await db.execute(ProductTag.insert().values(product_id=product_id, tag_id=tag_id))
    await db.flush()


async def detach_tag(db: AsyncSession, product_id: uuid.UUID, tag_id: uuid.UUID) -> None:
    from sqlalchemy import and_
    result = await db.execute(
        select(ProductTag).where(
            and_(ProductTag.c.product_id == product_id, ProductTag.c.tag_id == tag_id)
        )
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Tag not attached to product")

    await db.execute(
        ProductTag.delete().where(
            and_(ProductTag.c.product_id == product_id, ProductTag.c.tag_id == tag_id)
        )
    )
    await db.flush()
