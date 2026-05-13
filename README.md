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

### Entity Relationship Diagram

```mermaid
erDiagram
    categories ||--o{ categories : "parent_id"
    categories ||--o{ attribute_definitions : "category_id"
    categories ||--o{ products : "category_id"
    products ||--o{ product_images : "product_id"
    products }o--o{ tags : "product_tags"

    categories {
        uuid id PK
        varchar255 name "NOT NULL"
        varchar255 slug "UNIQUE, NOT NULL"
        text description "nullable"
        uuid parent_id "FK categories.id, nullable"
        boolean is_active "DEFAULT true"
        integer sort_order "DEFAULT 0"
        timestamptz created_at
        timestamptz updated_at
    }

    attribute_definitions {
        uuid id PK
        uuid category_id "FK categories.id, NOT NULL"
        varchar255 name "NOT NULL"
        varchar255 slug "NOT NULL"
        enum attribute_type "NOT NULL"
        boolean is_required "DEFAULT false"
        boolean is_filterable "DEFAULT false"
        jsonb options "nullable"
        integer sort_order "DEFAULT 0"
        timestamptz created_at
        timestamptz updated_at
    }

    products {
        uuid id PK
        varchar255 name "NOT NULL"
        varchar255 slug "UNIQUE, NOT NULL"
        text description "nullable"
        uuid category_id "FK categories.id, NOT NULL"
        numeric_12_2 base_price "NOT NULL"
        enum status "DEFAULT draft"
        jsonb attributes "DEFAULT {}, GIN-indexed"
        timestamptz created_at
        timestamptz updated_at
    }

    product_images {
        uuid id PK
        uuid product_id "FK products.id, CASCADE"
        text url "NOT NULL"
        varchar255 alt_text "nullable"
        integer sort_order "DEFAULT 0"
        timestamptz created_at
    }

    tags {
        uuid id PK
        varchar100 name "NOT NULL"
        varchar100 slug "UNIQUE, NOT NULL"
    }

    product_tags {
        uuid product_id "FK products.id, CASCADE"
        uuid tag_id "FK tags.id, CASCADE"
    }
```

### Table Details

#### `categories`

Self-referencing hierarchical table. Root categories have `parent_id = NULL`.

- `id` — `UUID` PRIMARY KEY, auto-generated
- `name` — `VARCHAR(255)` NOT NULL
- `slug` — `VARCHAR(255)` UNIQUE NOT NULL, auto-generated from name
- `description` — `TEXT`, nullable
- `parent_id` — `UUID` FK → `categories.id` ON DELETE SET NULL, nullable, indexed
- `is_active` — `BOOLEAN` DEFAULT `true`, used for soft deletes
- `sort_order` — `INTEGER` DEFAULT `0`
- `created_at` — `TIMESTAMPTZ`, auto-set on creation
- `updated_at` — `TIMESTAMPTZ`, auto-set on creation and update

#### `attribute_definitions`

Defines what dynamic fields a category supports. Subcategories inherit parent definitions.

- `id` — `UUID` PRIMARY KEY, auto-generated
- `category_id` — `UUID` FK → `categories.id` ON DELETE CASCADE, NOT NULL, indexed
- `name` — `VARCHAR(255)` NOT NULL
- `slug` — `VARCHAR(255)` NOT NULL, auto-generated from name (separator: `_`)
- `attribute_type` — `ENUM('text','number','boolean','select','multi_select')` NOT NULL
- `is_required` — `BOOLEAN` DEFAULT `false`
- `is_filterable` — `BOOLEAN` DEFAULT `false`
- `options` — `JSONB`, nullable, stores allowed values for `select`/`multi_select` (e.g. `["Red","Blue"]`)
- `sort_order` — `INTEGER` DEFAULT `0`
- `created_at` — `TIMESTAMPTZ`, auto-set on creation
- `updated_at` — `TIMESTAMPTZ`, auto-set on creation and update
- **Constraint**: `UNIQUE(category_id, slug)`

#### `products`

- `id` — `UUID` PRIMARY KEY, auto-generated
- `name` — `VARCHAR(255)` NOT NULL
- `slug` — `VARCHAR(255)` UNIQUE NOT NULL, auto-generated from name
- `description` — `TEXT`, nullable
- `category_id` — `UUID` FK → `categories.id` ON DELETE RESTRICT, NOT NULL, indexed
- `base_price` — `NUMERIC(12,2)` NOT NULL
- `status` — `ENUM('draft','active','archived')` DEFAULT `'draft'`
- `attributes` — `JSONB` DEFAULT `'{}'`, stores dynamic attribute key-value pairs
- `created_at` — `TIMESTAMPTZ`, auto-set on creation
- `updated_at` — `TIMESTAMPTZ`, auto-set on creation and update
- **Index**: GIN index on `attributes` column for fast JSONB filtering

#### `product_images`

- `id` — `UUID` PRIMARY KEY, auto-generated
- `product_id` — `UUID` FK → `products.id` ON DELETE CASCADE, NOT NULL, indexed
- `url` — `TEXT` NOT NULL
- `alt_text` — `VARCHAR(255)`, nullable
- `sort_order` — `INTEGER` DEFAULT `0`
- `created_at` — `TIMESTAMPTZ`, auto-set on creation

#### `tags`

- `id` — `UUID` PRIMARY KEY, auto-generated
- `name` — `VARCHAR(100)` NOT NULL
- `slug` — `VARCHAR(100)` UNIQUE NOT NULL, auto-generated from name

#### `product_tags` (join table)

- `product_id` — `UUID` FK → `products.id` ON DELETE CASCADE
- `tag_id` — `UUID` FK → `tags.id` ON DELETE CASCADE
- **Constraint**: composite PRIMARY KEY `(product_id, tag_id)`

## Attribute Inheritance

When a subcategory is created under a parent, it **inherits all attribute definitions** from its ancestors.

### How it works

1. Walk from root → current category via `parent_id`
2. Collect `attribute_definitions` from each ancestor (root → leaf order)
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

## API Reference

Base URL: `http://localhost:8000`

All request/response bodies are JSON. UUIDs are strings in `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` format.

### Error Responses

All errors return a consistent format:

```json
{"detail": "Error message"}
```

Attribute validation errors return:

```json
{"detail": {"attribute_errors": ["Missing required attribute: 'brand'", "Attribute 'color' must be one of: ['Red', 'Blue']"]}}
```

---

### Categories

#### `POST /api/v1/categories` — Create category

**Request body:**

```json
{
  "name": "Electronics",
  "description": "All electronic products",
  "parent_id": null,
  "is_active": true,
  "sort_order": 0
}
```

- `name` (string, **required**) — 1–255 characters
- `description` (string, optional)
- `parent_id` (uuid, optional) — set to create a subcategory
- `is_active` (boolean, optional) — default `true`
- `sort_order` (integer, optional) — default `0`

**Response:** `201 Created`

```json
{
  "id": "a1b2c3d4-...",
  "name": "Electronics",
  "slug": "electronics",
  "description": "All electronic products",
  "parent_id": null,
  "is_active": true,
  "sort_order": 0,
  "created_at": "2026-05-13T07:00:00Z",
  "updated_at": "2026-05-13T07:00:00Z"
}
```

**Errors:** `404` if `parent_id` doesn't exist, `422` if validation fails

---

#### `GET /api/v1/categories` — List categories

**Query parameters:**

- `tree` (boolean, optional) — if `true`, returns nested tree starting from root categories

**Response (flat, `tree=false`):** `200 OK`

```json
{
  "items": [ { "id": "...", "name": "...", "slug": "...", ... } ],
  "total": 25
}
```

**Response (tree, `tree=true`):** `200 OK`

```json
[
  {
    "id": "...",
    "name": "Electronics",
    "slug": "electronics",
    "parent_id": null,
    "children": [
      {
        "id": "...",
        "name": "Phones",
        "slug": "phones",
        "children": [ ... ]
      }
    ]
  }
]
```

---

#### `GET /api/v1/categories/{id}` — Get single category

**Response:** `200 OK` — same shape as the create response

**Errors:** `404` if not found

---

#### `PUT /api/v1/categories/{id}` — Update category

**Request body:** all fields optional (only provided fields are updated)

```json
{
  "name": "New Name",
  "description": "Updated description",
  "parent_id": "<uuid>",
  "is_active": false,
  "sort_order": 5
}
```

**Response:** `200 OK` — updated category object

**Errors:** `400` if self-referencing or circular parent, `404` if not found

---

#### `DELETE /api/v1/categories/{id}` — Soft-delete category

Sets `is_active = false`. Does not remove the record.

**Response:** `204 No Content`

**Errors:** `404` if not found

---

#### `GET /api/v1/categories/{id}/children` — Get direct children

**Response:** `200 OK`

```json
[
  { "id": "...", "name": "Phones", "slug": "phones", "parent_id": "<parent-uuid>", ... },
  { "id": "...", "name": "Laptops", "slug": "laptops", "parent_id": "<parent-uuid>", ... }
]
```

---

#### `GET /api/v1/categories/{id}/ancestors` — Get ancestor chain

Returns ancestors in root-first order (breadcrumb path).

**Response:** `200 OK`

```json
[
  { "id": "...", "name": "Electronics", ... },
  { "id": "...", "name": "Phones", ... }
]
```

Returns `[]` for root categories.

---

#### `GET /api/v1/categories/{id}/attributes` — Get effective attributes

Returns merged attribute definitions including inherited ones.

**Response:** `200 OK`

```json
[
  {
    "id": "...",
    "category_id": "<electronics-uuid>",
    "name": "Brand",
    "slug": "brand",
    "attribute_type": "text",
    "is_required": true,
    "is_filterable": true,
    "options": null,
    "sort_order": 0,
    "created_at": "...",
    "updated_at": "...",
    "inherited_from_category_id": "<electronics-uuid>"
  },
  {
    "id": "...",
    "category_id": "<phones-uuid>",
    "name": "Storage",
    "slug": "storage",
    "attribute_type": "select",
    "is_required": true,
    "is_filterable": false,
    "options": ["64GB", "128GB", "256GB"],
    "sort_order": 0,
    "created_at": "...",
    "updated_at": "...",
    "inherited_from_category_id": null
  }
]
```

- `inherited_from_category_id` — UUID of the ancestor category this attribute was inherited from, or `null` if the attribute belongs to this category directly

---

### Attribute Definitions

#### `POST /api/v1/categories/{id}/attributes` — Create attribute

**Request body:**

```json
{
  "name": "Color",
  "attribute_type": "select",
  "is_required": false,
  "is_filterable": true,
  "options": ["Red", "Blue", "Green"],
  "sort_order": 0
}
```

- `name` (string, **required**) — 1–255 characters
- `attribute_type` (string, **required**) — one of: `text`, `number`, `boolean`, `select`, `multi_select`
- `is_required` (boolean, optional) — default `false`
- `is_filterable` (boolean, optional) — default `false`
- `options` (array of strings, optional) — **required** when `attribute_type` is `select` or `multi_select`
- `sort_order` (integer, optional) — default `0`

**Response:** `201 Created`

```json
{
  "id": "...",
  "category_id": "<category-uuid>",
  "name": "Color",
  "slug": "color",
  "attribute_type": "select",
  "is_required": false,
  "is_filterable": true,
  "options": ["Red", "Blue", "Green"],
  "sort_order": 0,
  "created_at": "...",
  "updated_at": "..."
}
```

**Errors:** `400` if select/multi_select without options, `404` if category not found, `409` if duplicate slug in category

---

#### `PUT /api/v1/categories/{id}/attributes/{attr_id}` — Update attribute

**Request body:** all fields optional

```json
{
  "name": "Updated Name",
  "is_required": true
}
```

**Response:** `200 OK` — updated attribute object

**Errors:** `404` if attribute not found in this category

---

#### `DELETE /api/v1/categories/{id}/attributes/{attr_id}` — Delete attribute

**Response:** `204 No Content`

**Errors:** `404` if attribute not found in this category

---

### Products

#### `POST /api/v1/products` — Create product

Validates `attributes` against the category's effective attribute definitions (own + inherited).

**Request body:**

```json
{
  "name": "iPhone 15 Pro",
  "description": "Latest Apple smartphone",
  "category_id": "<smartphones-uuid>",
  "base_price": 999.99,
  "status": "active",
  "attributes": {
    "brand": "Apple",
    "storage": "256GB"
  }
}
```

- `name` (string, **required**) — 1–255 characters
- `description` (string, optional)
- `category_id` (uuid, **required**)
- `base_price` (number, **required**) — must be > 0
- `status` (string, optional) — `draft` (default), `active`, or `archived`
- `attributes` (object, optional) — key-value pairs matching the category's attribute definitions

**Attribute validation rules:**
- All `is_required` attributes must be present
- `text` attributes must be strings
- `number` attributes must be numbers (int or float)
- `boolean` attributes must be booleans
- `select` values must be one of the defined `options`
- `multi_select` values must be an array, each element in `options`
- Unknown attribute keys are rejected

**Response:** `201 Created`

```json
{
  "id": "...",
  "name": "iPhone 15 Pro",
  "slug": "iphone-15-pro",
  "description": "Latest Apple smartphone",
  "category_id": "<smartphones-uuid>",
  "base_price": 999.99,
  "status": "active",
  "attributes": { "brand": "Apple", "storage": "256GB" },
  "images": [],
  "tags": [],
  "created_at": "...",
  "updated_at": "..."
}
```

**Errors:** `400` if attribute validation fails, `404` if category not found, `422` if body validation fails

---

#### `GET /api/v1/products` — List products (with filtering)

**Query parameters:**

- `category_id` (uuid, optional) — filter by category
- `status` (string, optional) — `draft`, `active`, or `archived`
- `min_price` (number, optional) — minimum price inclusive
- `max_price` (number, optional) — maximum price inclusive
- `attrs[<key>]=<value>` (string, optional) — filter by dynamic attribute value, can specify multiple
- `limit` (integer, optional) — 1–100, default `20`
- `offset` (integer, optional) — default `0`

**Example:**

```
GET /api/v1/products?category_id=<uuid>&status=active&min_price=500&max_price=1500&attrs[brand]=Apple&attrs[storage]=256GB&limit=10&offset=0
```

**Response:** `200 OK`

```json
{
  "items": [
    {
      "id": "...",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "description": "...",
      "category_id": "...",
      "base_price": 999.99,
      "status": "active",
      "attributes": { "brand": "Apple", "storage": "256GB" },
      "images": [],
      "tags": [],
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}
```

---

#### `GET /api/v1/products/search` — Text search

**Query parameters:**

- `q` (string, **required**) — search term (matches against product name and description, case-insensitive)
- `limit` (integer, optional) — default `20`
- `offset` (integer, optional) — default `0`

**Response:** `200 OK` — same shape as product list response

**Errors:** `422` if `q` is empty

---

#### `GET /api/v1/products/{id}` — Get single product

**Response:** `200 OK` — full product object including images and tags

**Errors:** `404` if not found

---

#### `PUT /api/v1/products/{id}` — Update product

**Request body:** all fields optional (only provided fields are updated)

```json
{
  "name": "iPhone 15 Pro Max",
  "base_price": 1199.99,
  "status": "active",
  "attributes": { "brand": "Apple", "storage": "512GB" }
}
```

If `attributes` is provided, it is re-validated against the category's effective attribute definitions.

**Response:** `200 OK` — updated product object

**Errors:** `400` if attribute validation fails, `404` if not found

---

#### `DELETE /api/v1/products/{id}` — Delete product

Hard delete — permanently removes the product and its images.

**Response:** `204 No Content`

**Errors:** `404` if not found

---

### Product Images

#### `POST /api/v1/products/{id}/images` — Add image

**Request body:**

```json
{
  "url": "https://cdn.example.com/products/iphone15.jpg",
  "alt_text": "iPhone 15 Pro front view",
  "sort_order": 0
}
```

- `url` (string, **required**)
- `alt_text` (string, optional)
- `sort_order` (integer, optional) — default `0`

**Response:** `201 Created`

```json
{
  "id": "...",
  "product_id": "...",
  "url": "https://cdn.example.com/products/iphone15.jpg",
  "alt_text": "iPhone 15 Pro front view",
  "sort_order": 0,
  "created_at": "..."
}
```

---

#### `DELETE /api/v1/products/{id}/images/{image_id}` — Remove image

**Response:** `204 No Content`

**Errors:** `404` if image not found for this product

---

#### `PUT /api/v1/products/{id}/images/reorder` — Reorder images

**Request body:**

```json
{
  "image_ids": ["<third-image-uuid>", "<first-image-uuid>", "<second-image-uuid>"]
}
```

Sets `sort_order` based on array position (0, 1, 2, ...).

**Response:** `200 OK` — ordered list of image objects

---

### Tags

#### `POST /api/v1/tags` — Create tag

**Request body:**

```json
{ "name": "Featured" }
```

- `name` (string, **required**) — 1–100 characters

**Response:** `201 Created`

```json
{ "id": "...", "name": "Featured", "slug": "featured" }
```

**Errors:** `409` if tag slug already exists

---

#### `GET /api/v1/tags` — List all tags

**Response:** `200 OK`

```json
[
  { "id": "...", "name": "Featured", "slug": "featured" },
  { "id": "...", "name": "Sale", "slug": "sale" }
]
```

---

#### `POST /api/v1/products/{id}/tags` — Attach tag

**Request body:**

```json
{ "tag_id": "<tag-uuid>" }
```

**Response:** `201 Created`

```json
{ "detail": "Tag attached" }
```

**Errors:** `404` if product or tag not found, `409` if tag already attached

---

#### `DELETE /api/v1/products/{id}/tags/{tag_id}` — Detach tag

**Response:** `204 No Content`

**Errors:** `404` if tag not attached to product

---

### Health Check

#### `GET /health`

**Response:** `200 OK`

```json
{ "status": "ok" }
```

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
