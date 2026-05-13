import uuid

from fastapi import HTTPException, status
from slugify import slugify
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


async def create_category(db: AsyncSession, data: CategoryCreate) -> Category:
    slug = slugify(data.name)

    # Ensure unique slug
    existing = await db.execute(select(Category).where(Category.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    # Validate parent exists
    if data.parent_id:
        parent = await db.get(Category, data.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    category = Category(
        name=data.name,
        slug=slug,
        description=data.description,
        labels=data.labels,
        parent_id=data.parent_id,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def get_category(db: AsyncSession, category_id: uuid.UUID) -> Category:
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


async def list_categories(db: AsyncSession, tree: bool = False) -> list[Category]:
    if tree:
        # Return only root categories; children loaded via relationship
        result = await db.execute(
            select(Category)
            .where(Category.parent_id.is_(None))
            .options(selectinload(Category.children, recursion_depth=5))
            .order_by(Category.sort_order, Category.name)
        )
        return list(result.scalars().all())

    result = await db.execute(
        select(Category).order_by(Category.sort_order, Category.name)
    )
    return list(result.scalars().all())


async def update_category(
    db: AsyncSession, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = await get_category(db, category_id)

    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["slug"] = slugify(update_data["name"])

    # Prevent circular parent reference
    if "parent_id" in update_data and update_data["parent_id"]:
        if update_data["parent_id"] == category_id:
            raise HTTPException(status_code=400, detail="Category cannot be its own parent")
        # Check the new parent isn't a descendant
        descendants = await _get_descendant_ids(db, category_id)
        if update_data["parent_id"] in descendants:
            raise HTTPException(status_code=400, detail="Circular reference: new parent is a descendant")

    for key, value in update_data.items():
        setattr(category, key, value)

    await db.flush()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category_id: uuid.UUID) -> None:
    category = await get_category(db, category_id)
    # Soft delete: deactivate
    category.is_active = False
    await db.flush()


async def get_children(db: AsyncSession, category_id: uuid.UUID) -> list[Category]:
    await get_category(db, category_id)  # Ensure parent exists
    result = await db.execute(
        select(Category)
        .where(Category.parent_id == category_id)
        .order_by(Category.sort_order, Category.name)
    )
    return list(result.scalars().all())


async def get_ancestors(db: AsyncSession, category_id: uuid.UUID) -> list[Category]:
    """Walk up the tree from category to root. Returns [root, ..., parent]."""
    ancestors: list[Category] = []
    current = await get_category(db, category_id)

    while current.parent_id:
        parent = await db.get(Category, current.parent_id)
        if not parent:
            break
        ancestors.append(parent)
        current = parent

    ancestors.reverse()
    return ancestors


async def get_category_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Category.id)))
    return result.scalar_one()


async def _get_descendant_ids(db: AsyncSession, category_id: uuid.UUID) -> set[uuid.UUID]:
    """Get all descendant IDs of a category (BFS)."""
    descendants: set[uuid.UUID] = set()
    queue = [category_id]

    while queue:
        current_id = queue.pop(0)
        result = await db.execute(
            select(Category.id).where(Category.parent_id == current_id)
        )
        child_ids = [row[0] for row in result.all()]
        for cid in child_ids:
            if cid not in descendants:
                descendants.add(cid)
                queue.append(cid)

    return descendants


async def build_ref_path(db: AsyncSession, category_id: uuid.UUID) -> str:
    """Build dotted reference path from root to this category, e.g. 'electronics.phones.smartphones'."""
    ancestors = await get_ancestors(db, category_id)
    category = await get_category(db, category_id)
    parts = [a.slug for a in ancestors] + [category.slug]
    return ".".join(parts)


async def resolve_ref_path(db: AsyncSession, ref_path: str):
    """
    Resolve a dotted reference path to a category or product.
    e.g. 'electronics.phones.smartphones' -> Category
    e.g. 'electronics.phones.smartphones.iphone-15' -> Product
    """
    from app.models.product import Product

    slugs = ref_path.strip().split(".")
    if not slugs:
        return None

    # Walk the category chain
    current_parent_id = None
    resolved_category = None

    for i, slug in enumerate(slugs):
        query = select(Category).where(
            Category.slug == slug,
            Category.parent_id == current_parent_id if current_parent_id else Category.parent_id.is_(None),
        )
        result = await db.execute(query)
        cat = result.scalar_one_or_none()

        if cat:
            resolved_category = cat
            current_parent_id = cat.id
        else:
            # Last segment might be a product slug
            if i == len(slugs) - 1 and resolved_category:
                prod_result = await db.execute(
                    select(Product).where(
                        Product.slug == slug,
                        Product.category_id == resolved_category.id,
                    )
                )
                product = prod_result.scalar_one_or_none()
                if product:
                    return product
            return None

    return resolved_category
