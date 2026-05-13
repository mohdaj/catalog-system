from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.product import ProductStatus
from app.schemas.product import (
    ProductCreate,
    ProductImageCreate,
    ProductImageReorder,
    ProductImageResponse,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
    TagAttach,
    TagCreate,
    TagResponse,
)
from app.services import product_service

router = APIRouter(tags=["Products"])


# --- Products ---

@router.post("/api/v1/products", response_model=ProductResponse, status_code=201)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    return await product_service.create_product(db, data)


@router.get("/api/v1/products", response_model=ProductListResponse)
async def list_products(
    request: Request,
    category_id: Optional[uuid.UUID] = None,
    status: Optional[ProductStatus] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    # Extract dynamic attribute filters from query params: attrs[key]=value
    attr_filters: dict[str, str] = {}
    for key, value in request.query_params.items():
        if key.startswith("attrs[") and key.endswith("]"):
            attr_key = key[6:-1]
            attr_filters[attr_key] = value

    products, total = await product_service.list_products(
        db,
        category_id=category_id,
        status=status,
        min_price=min_price,
        max_price=max_price,
        attr_filters=attr_filters if attr_filters else None,
        limit=limit,
        offset=offset,
    )
    return ProductListResponse(items=products, total=total, limit=limit, offset=offset)


@router.get("/api/v1/products/search", response_model=ProductListResponse)
async def search_products(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    products, total = await product_service.search_products(db, q, limit=limit, offset=offset)
    return ProductListResponse(items=products, total=total, limit=limit, offset=offset)


@router.get("/api/v1/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await product_service.get_product(db, product_id)


@router.put("/api/v1/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID, data: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    return await product_service.update_product(db, product_id, data)


@router.delete("/api/v1/products/{product_id}", status_code=204)
async def delete_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await product_service.delete_product(db, product_id)


# --- Product Images ---

@router.post(
    "/api/v1/products/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=201,
)
async def add_image(
    product_id: uuid.UUID, data: ProductImageCreate, db: AsyncSession = Depends(get_db)
):
    return await product_service.add_product_image(db, product_id, data)


@router.delete("/api/v1/products/{product_id}/images/{image_id}", status_code=204)
async def delete_image(
    product_id: uuid.UUID, image_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    await product_service.delete_product_image(db, product_id, image_id)


@router.put(
    "/api/v1/products/{product_id}/images/reorder",
    response_model=list[ProductImageResponse],
)
async def reorder_images(
    product_id: uuid.UUID, data: ProductImageReorder, db: AsyncSession = Depends(get_db)
):
    return await product_service.reorder_product_images(db, product_id, data.image_ids)


# --- Tags ---

@router.post("/api/v1/tags", response_model=TagResponse, status_code=201)
async def create_tag(data: TagCreate, db: AsyncSession = Depends(get_db)):
    return await product_service.create_tag(db, data.name)


@router.get("/api/v1/tags", response_model=list[TagResponse])
async def list_tags(db: AsyncSession = Depends(get_db)):
    return await product_service.list_tags(db)


@router.post("/api/v1/products/{product_id}/tags", status_code=201)
async def attach_tag(
    product_id: uuid.UUID, data: TagAttach, db: AsyncSession = Depends(get_db)
):
    await product_service.attach_tag(db, product_id, data.tag_id)
    return {"detail": "Tag attached"}


@router.delete("/api/v1/products/{product_id}/tags/{tag_id}", status_code=204)
async def detach_tag(
    product_id: uuid.UUID, tag_id: uuid.UUID, db: AsyncSession = Depends(get_db)
):
    await product_service.detach_tag(db, product_id, tag_id)
