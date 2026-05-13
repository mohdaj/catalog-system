# Dynamic Catalog System

A flexible, API-driven catalog system built with **FastAPI**, **SQLAlchemy 2.0** (async), and **PostgreSQL**. Designed for catalogs where different product categories require different sets of attributes — without schema changes.

## Key Features

- **Hierarchical categories** — unlimited nesting depth via self-referencing `parent_id`
- **Dynamic attributes** — each category defines its own attribute schema (text, number, boolean, select, multi-select)
- **Attribute inheritance** — subcategories automatically inherit parent category attributes, with override support
- **JSONB-powered products** — product attributes stored as JSONB, validated at the API layer against category definitions
- **Dynamic filtering** — filter products by any dynamic attribute via query params (`?attrs[color]=red`)
- **Full CRUD** — categories, products, attribute definitions, images, tags
- **Async throughout** — async SQLAlchemy + asyncpg for high concurrency

## Tech Stack

- **Python 3.9+**
- **FastAPI** — async web framework with auto-generated OpenAPI docs
- **SQLAlchemy 2.0** — async ORM with mapped columns
- **PostgreSQL** — relational DB with JSONB and GIN indexes
- **Alembic** — database migrations
- **Pydantic v2** — request/response validation
- **asyncpg** — async PostgreSQL driver

## Project Structure

```
catalog-system/
├── app/
│   ├── main.py                  # FastAPI app, lifespan, router registration
│   ├── config.py                # Pydantic settings (reads .env)
│   ├── database.py              # Async engine, session factory, Base
│   ├── models/
│   │   ├── category.py          # Category model (self-referencing tree)
│   │   ├── attribute.py         # AttributeDefinition model
│   │   └── product.py           # Product, ProductImage, Tag, ProductTag
│   ├── schemas/
│   │   ├── category.py          # Category request/response schemas
│   │   ├── attribute.py         # Attribute definition schemas
│   │   └── product.py           # Product, image, tag schemas
│   ├── routers/
│   │   ├── categories.py        # Category endpoints
│   │   ├── attributes.py        # Attribute definition endpoints
│   │   └── products.py          # Product, image, tag endpoints
│   └── services/
│       ├── category_service.py  # Category business logic + tree traversal
│       ├── attribute_service.py # Inheritance logic + attribute validation
│       └── product_service.py   # Product CRUD + image/tag management
├── tests/
│   ├── conftest.py              # Test fixtures (async DB, HTTP client)
│   ├── test_categories.py       # Category CRUD tests
│   ├── test_attributes.py       # Attribute + inheritance tests
│   └── test_products.py         # Product CRUD + validation tests
├── alembic/
│   ├── env.py                   # Async Alembic config
│   ├── script.py.mako           # Migration template
│   └── versions/                # Migration files
├── alembic.ini
├── requirements.txt
└── .env
```

## Setup

### 1. Prerequisites

- Python 3.9+
- PostgreSQL 13+ running locally (or accessible remotely)

### 2. Create a virtual environment

```powershell
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
pip install -r requirements.txt
```

### 4. Create the database

Connect to PostgreSQL and create the database:

```sql
CREATE DATABASE catalog_db;
```

For running tests, also create:

```sql
CREATE DATABASE catalog_db_test;
```

### 5. Configure environment

Edit `.env` with your PostgreSQL credentials:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/catalog_db
APP_NAME=Catalog System
DEBUG=true
```

### 6. Run the server

```powershell
uvicorn app.main:app --reload
```

The server starts at `http://localhost:8000`. On first startup, tables are auto-created (dev mode).

### 7. View API docs

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Database Schema

### Entity Relationship

```
categories (self-referencing)
    │
    ├── 1:N ── attribute_definitions
    │
    └── 1:N ── products
                    │
                    ├── 1:N ── product_images
                    │
                    └── N:M ── tags (via product_tags)
```

### Tables

**categories**
- `id` — UUID primary key
- `name` — display name
- `slug` — URL-friendly unique identifier (auto-generated)
- `description` — optional text
- `parent_id` — FK to `categories.id` (NULL = root category)
- `is_active` — soft-delete flag
- `sort_order` — display ordering
- `created_at`, `updated_at` — timestamps

**attribute_definitions** — defines what dynamic fields a category supports
- `id` — UUID primary key
- `category_id` — FK to `categories.id`
- `name`, `slug` — attribute name and slug (unique per category)
- `attribute_type` — enum: `text`, `number`, `boolean`, `select`, `multi_select`
- `is_required` — whether products must provide this attribute
- `is_filterable` — whether this attribute can be used as a filter
- `options` — JSONB array of allowed values (for select/multi_select)
- `sort_order` — display ordering

**products**
- `id` — UUID primary key
- `name`, `slug` — product name and unique slug
- `description` — optional text
- `category_id` — FK to `categories.id`
- `base_price` — decimal(12,2)
- `status` — enum: `draft`, `active`, `archived`
- `attributes` — JSONB object storing dynamic attribute values (GIN-indexed)
- `created_at`, `updated_at` — timestamps

**product_images** — ordered images per product
- `id`, `product_id`, `url`, `alt_text`, `sort_order`, `created_at`

**tags** / **product_tags** — many-to-many tagging

## Attribute Inheritance

When a subcategory is created under a parent, it **inherits all attribute definitions** from its ancestors.

### How it works

1. Walk from root → current category via `parent_id`
2. Collect `attribute_definitions` from each level
3. If a child defines an attribute with the **same slug** as an ancestor, the child's definition **overrides** it
4. The merged list = **effective attributes** for that category

### Example

```
Electronics                     → defines: brand (text, required), warranty_months (number)
  └── Phones                    → defines: screen_size (number), os (select: [Android, iOS])
       └── Smartphones          → defines: ram (number), storage (select: [64, 128, 256, 512])
```

Effective attributes for **Smartphones**:
- `brand` — inherited from Electronics (required, text)
- `warranty_months` — inherited from Electronics (number)
- `screen_size` — inherited from Phones (number)
- `os` — inherited from Phones (select)
- `ram` — own (number)
- `storage` — own (select)

When creating a product in Smartphones, all required inherited attributes must be provided.

### API endpoint

```
GET /api/v1/categories/{id}/attributes
```

Returns the full effective attribute list, with `inherited_from_category_id` indicating the source.

## API Reference

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/categories` | Create a category |
| GET | `/api/v1/categories` | List categories (add `?tree=true` for nested tree) |
| GET | `/api/v1/categories/{id}` | Get a single category |
| PUT | `/api/v1/categories/{id}` | Update a category |
| DELETE | `/api/v1/categories/{id}` | Soft-delete (deactivate) a category |
| GET | `/api/v1/categories/{id}/children` | Get direct child categories |
| GET | `/api/v1/categories/{id}/ancestors` | Get ancestor chain (breadcrumb) |
| GET | `/api/v1/categories/{id}/attributes` | Get effective attributes (own + inherited) |

### Attribute Definitions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/categories/{id}/attributes` | Add attribute to category |
| PUT | `/api/v1/categories/{id}/attributes/{attr_id}` | Update attribute |
| DELETE | `/api/v1/categories/{id}/attributes/{attr_id}` | Remove attribute |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/products` | Create product (validates attributes) |
| GET | `/api/v1/products` | List with filters (see below) |
| GET | `/api/v1/products/search?q=` | Text search on name/description |
| GET | `/api/v1/products/{id}` | Get single product |
| PUT | `/api/v1/products/{id}` | Update product |
| DELETE | `/api/v1/products/{id}` | Delete product |

**Product list filters:**

```
GET /api/v1/products?category_id=<uuid>&status=active&min_price=100&max_price=500&attrs[color]=red&attrs[brand]=Apple&limit=20&offset=0
```

### Product Images

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/products/{id}/images` | Add image |
| DELETE | `/api/v1/products/{id}/images/{image_id}` | Remove image |
| PUT | `/api/v1/products/{id}/images/reorder` | Reorder images |

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tags` | Create tag |
| GET | `/api/v1/tags` | List all tags |
| POST | `/api/v1/products/{id}/tags` | Attach tag to product |
| DELETE | `/api/v1/products/{id}/tags/{tag_id}` | Detach tag |

## Usage Examples

### Create a category hierarchy

```bash
# Root category
curl -X POST http://localhost:8000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Electronics"}'

# Subcategory (use the returned id as parent_id)
curl -X POST http://localhost:8000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Smartphones", "parent_id": "<electronics-uuid>"}'
```

### Define attributes for a category

```bash
curl -X POST http://localhost:8000/api/v1/categories/<electronics-uuid>/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Brand",
    "attribute_type": "text",
    "is_required": true,
    "is_filterable": true
  }'

curl -X POST http://localhost:8000/api/v1/categories/<smartphones-uuid>/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Storage",
    "attribute_type": "select",
    "is_required": true,
    "options": ["64GB", "128GB", "256GB", "512GB"]
  }'
```

### Create a product with dynamic attributes

```bash
curl -X POST http://localhost:8000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iPhone 15 Pro",
    "category_id": "<smartphones-uuid>",
    "base_price": 999.99,
    "status": "active",
    "attributes": {
      "brand": "Apple",
      "storage": "256GB"
    }
  }'
```

### Filter products by dynamic attributes

```bash
# Products with brand=Apple in a specific category
curl "http://localhost:8000/api/v1/products?category_id=<uuid>&attrs[brand]=Apple"

# Price range filter
curl "http://localhost:8000/api/v1/products?min_price=500&max_price=1500&status=active"
```

### Get category tree

```bash
curl "http://localhost:8000/api/v1/categories?tree=true"
```

## Running Tests

### Setup

```powershell
pip install pytest pytest-asyncio httpx aiosqlite
```

### Run

```powershell
pytest tests/ -v
```

Tests use an in-memory SQLite database — no PostgreSQL required for testing.

## Database Migrations (Alembic)

### Generate a migration after model changes

```powershell
alembic revision --autogenerate -m "description of changes"
```

### Apply migrations

```powershell
alembic upgrade head
```

### Rollback

```powershell
alembic downgrade -1
```

## Design Decisions

1. **JSONB for dynamic attributes** — avoids EAV pattern complexity while maintaining query performance via GIN indexes
2. **Attribute inheritance via parent traversal** — simpler than materialized path; works well for catalogs with moderate tree depth
3. **Slug-based override** — when a child category defines an attribute with the same slug as a parent's, the child's version takes precedence
4. **Soft delete for categories** — categories may have products; deactivation is safer than deletion
5. **Validation at API layer** — product attributes are validated against effective attribute definitions on every create/update

## License

MIT
