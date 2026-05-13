from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.schemas.category import CategoryResponse
from app.schemas.product import ProductResponse
from app.services.category_service import build_ref_path, resolve_ref_path

router = APIRouter(prefix="/api/v1/lookup", tags=["Lookup"])


@router.get("")
async def lookup_by_ref(
    ref: str = Query(..., min_length=1, description="Dotted reference path, e.g. electronics.phones.smartphones"),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve a dotted reference path to a category or product.

    Examples:
    - `electronics.phones.smartphones` → returns the Smartphones category
    - `electronics.phones.smartphones.iphone-15` → returns the iPhone 15 product
    """
    result = await resolve_ref_path(db, ref)

    if result is None:
        raise HTTPException(status_code=404, detail=f"Nothing found for ref path: '{ref}'")

    if isinstance(result, Category):
        ref_path = await build_ref_path(db, result.id)
        resp = CategoryResponse.model_validate(result)
        resp.ref_path = ref_path
        return {"type": "category", "data": resp}

    if isinstance(result, Product):
        cat_path = await build_ref_path(db, result.category_id)
        resp = ProductResponse.model_validate(result)
        resp.ref_path = f"{cat_path}.{result.slug}"
        return {"type": "product", "data": resp}

    raise HTTPException(status_code=404, detail=f"Nothing found for ref path: '{ref}'")
