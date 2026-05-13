import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.category import (
    CategoryCreate,
    CategoryListResponse,
    CategoryResponse,
    CategoryTreeResponse,
    CategoryUpdate,
)
from app.services import category_service

router = APIRouter(prefix="/api/v1/categories", tags=["Categories"])


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await category_service.create_category(db, data)


@router.get("")
async def list_categories(
    tree: bool = Query(False, description="Return nested tree structure"),
    db: AsyncSession = Depends(get_db),
):
    categories = await category_service.list_categories(db, tree=tree)
    if tree:
        return [CategoryTreeResponse.model_validate(c) for c in categories]
    total = await category_service.get_category_count(db)
    return CategoryListResponse(
        items=[CategoryResponse.model_validate(c) for c in categories],
        total=total,
    )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await category_service.get_category(db, category_id)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID, data: CategoryUpdate, db: AsyncSession = Depends(get_db)
):
    return await category_service.update_category(db, category_id, data)


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await category_service.delete_category(db, category_id)


@router.get("/{category_id}/children", response_model=list[CategoryResponse])
async def get_children(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await category_service.get_children(db, category_id)


@router.get("/{category_id}/ancestors", response_model=list[CategoryResponse])
async def get_ancestors(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await category_service.get_ancestors(db, category_id)
