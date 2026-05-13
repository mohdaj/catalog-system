# Dynamic Catalog System

A flexible, API-driven catalog system with an **admin web app**. Built with **FastAPI** + **PostgreSQL** (backend) and **React** + **TypeScript** (frontend). Designed for catalogs where different product categories require different sets of attributes — without schema changes.

## Key Features

- **Hierarchical categories** — unlimited nesting via self-referencing `parent_id`
- **Dynamic attributes** — each category defines its own attribute schema (text, number, boolean, select, multi-select)
- **Attribute inheritance** — subcategories inherit parent attributes, with slug-based override
- **Multi-language labels** — optional `labels` JSONB on categories, products, and attributes (e.g. `{"en": "Electronics", "ar": "إلكترونيات"}`)
- **Reference paths** — dotted slug paths like `electronics.phones.smartphones` with lookup API
- **JSONB products** — dynamic attributes stored as JSONB, validated against category definitions, GIN-indexed
- **Product images** — ordered image management with add/remove/reorder
- **Tags** — many-to-many tagging with attach/detach
- **Dynamic filtering** — filter by category, status, price range, and any dynamic attribute (`?attrs[color]=red`)
- **Text search** — case-insensitive search on product name and description
- **JWT authentication** — admin/superadmin roles, bcrypt password hashing
- **Admin web app** — React dashboard for managing the entire catalog visually
- **Docker ready** — Dockerfile + docker-compose for deployment

## Project Structure

```
catalog-system/
├── api-server/                   # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App, lifespan, CORS, router registration
│   │   ├── config.py             # Pydantic settings
│   │   ├── database.py           # Async engine, session, Base
│   │   ├── dependencies.py       # JWT auth guards, role checks
│   │   ├── models/
│   │   │   ├── category.py       # Category (self-referencing tree)
│   │   │   ├── attribute.py      # AttributeDefinition
│   │   │   ├── product.py        # Product, ProductImage, Tag, ProductTag
│   │   │   └── user.py           # User with admin/superadmin roles
│   │   ├── schemas/
│   │   │   ├── category.py       # Category request/response (+ labels, ref_path)
│   │   │   ├── attribute.py      # Attribute schemas (+ labels)
│   │   │   ├── product.py        # Product schemas (+ labels, ref_path)
│   │   │   └── user.py           # Auth schemas (login, register, update)
│   │   ├── routers/
│   │   │   ├── categories.py     # Category CRUD + tree + children + ancestors
│   │   │   ├── attributes.py     # Attribute CRUD + effective (inherited)
│   │   │   ├── products.py       # Product CRUD + images + tags + search
│   │   │   ├── auth.py           # Login, register, me, user management
│   │   │   └── lookup.py         # Reference path resolution
│   │   └── services/
│   │       ├── category_service.py  # Tree traversal, ref_path builder
│   │       ├── attribute_service.py # Inheritance, validation
│   │       ├── product_service.py   # CRUD + JSONB filtering
│   │       └── auth_service.py      # JWT, bcrypt, user CRUD, seed
│   ├── tests/                    # 64 passing tests
│   ├── alembic/                  # Database migrations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
├── web-app/                      # React admin dashboard
│   ├── src/
│   │   ├── api/                  # Axios client + all API functions
│   │   │   ├── client.ts         # JWT interceptor, 401 redirect
│   │   │   ├── auth.ts           # login, register, me, users, updateUser
│   │   │   ├── categories.ts     # CRUD, tree, attrs, ancestors, children
│   │   │   ├── products.ts       # CRUD, search, images, tags
│   │   │   └── lookup.ts         # ref path lookup, health check
│   │   ├── context/AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx  # Stats, health, lookup tool, recent products
│   │   │   ├── CategoriesPage.tsx # Tree, edit, attributes panel with CRUD
│   │   │   ├── ProductsPage.tsx   # Table, filters, search, pagination, images, tags
│   │   │   └── UsersPage.tsx      # User table, create, edit (superadmin)
│   │   ├── components/
│   │   │   ├── Layout.tsx         # Sidebar nav, role-aware
│   │   │   └── ProtectedRoute.tsx # Auth + role guard
│   │   └── types/index.ts
│   ├── package.json
│   ├── vite.config.ts            # Dev proxy to API
│   └── tailwind.config.js
│
└── README.md
```

## Setup

### API Server

```powershell
cd api-server
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create the database:

```sql
CREATE DATABASE catalog_db;
```

Configure `api-server/.env`:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/catalog_db
APP_NAME=Catalog System
DEBUG=true
```

Start the server:

```powershell
uvicorn app.main:app --reload
```

On first startup, tables are auto-created and a default superadmin is seeded: **admin / admin123**.

API docs: http://localhost:8000/docs

### Web App

```powershell
cd web-app
npm install
npm run dev
```

Opens at http://localhost:5173 — Vite proxies `/api` requests to the backend on port 8000.

Login with **admin / admin123**.

### Docker (API only, external database)

```powershell
cd api-server
docker build -t catalog-api .
docker run -d -p 8000:8000 -e DATABASE_URL="postgresql+asyncpg://user:pass@your-db-host:5432/catalog_db" --name catalog-api catalog-api
```

### Docker Compose (API + PostgreSQL)

```powershell
cd api-server
docker compose up --build -d
```

## Database Schema

```mermaid
erDiagram
    categories ||--o{ categories : "parent_id"
    categories ||--o{ attribute_definitions : "category_id"
    categories ||--o{ products : "category_id"
    products ||--o{ product_images : "product_id"
    products }o--o{ tags : "product_tags"

    categories {
        uuid id PK
        varchar name "NOT NULL"
        varchar slug "UNIQUE, NOT NULL"
        text description "nullable"
        jsonb labels "nullable"
        uuid parent_id "FK, nullable"
        boolean is_active "DEFAULT true"
        integer sort_order "DEFAULT 0"
        timestamptz created_at
        timestamptz updated_at
    }

    attribute_definitions {
        uuid id PK
        uuid category_id "FK, NOT NULL"
        varchar name "NOT NULL"
        varchar slug "NOT NULL"
        jsonb labels "nullable"
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
        varchar name "NOT NULL"
        varchar slug "UNIQUE, NOT NULL"
        text description "nullable"
        jsonb labels "nullable"
        uuid category_id "FK, NOT NULL"
        numeric base_price "NOT NULL"
        enum status "DEFAULT draft"
        jsonb attributes "DEFAULT {}, GIN-indexed"
        timestamptz created_at
        timestamptz updated_at
    }

    product_images {
        uuid id PK
        uuid product_id "FK, CASCADE"
        text url "NOT NULL"
        varchar alt_text "nullable"
        integer sort_order "DEFAULT 0"
        timestamptz created_at
    }

    tags {
        uuid id PK
        varchar name "NOT NULL"
        varchar slug "UNIQUE, NOT NULL"
    }

    product_tags {
        uuid product_id "FK, CASCADE"
        uuid tag_id "FK, CASCADE"
    }

    users {
        uuid id PK
        varchar username "UNIQUE, NOT NULL"
        varchar email "UNIQUE, NOT NULL"
        varchar hashed_password "NOT NULL"
        enum role "admin or superadmin"
        boolean is_active "DEFAULT true"
        timestamptz created_at
    }
```

## Multi-language Labels

Categories, products, and attributes support an optional `labels` JSONB field:

```json
{
  "name": "Electronics",
  "labels": {"en": "Electronics", "ar": "إلكترونيات", "fr": "Électronique"}
}
```

The `name` field is the default/fallback. Labels are fully optional — omit them or pass `null`.

## Reference Paths

Every category and product has a computed dotted reference path built from the ancestor slug chain:

- Category: `electronics.phones.smartphones`
- Product: `electronics.phones.smartphones.iphone-15-pro`

### Lookup endpoint

```
GET /api/v1/lookup?ref=electronics.phones.smartphones
```

Returns `{"type": "category", "data": {...}}` or `{"type": "product", "data": {...}}`.

## Attribute Inheritance

Subcategories inherit all attribute definitions from their ancestors:

```
Electronics            → brand (text, required), warranty (number)
  └── Phones           → screen_size (number), os (select)
       └── Smartphones → ram (number), storage (select)
```

Effective attributes for **Smartphones** = `brand` + `warranty` + `screen_size` + `os` + `ram` + `storage`.

If a child defines the same slug as a parent, the child's definition overrides.

## Authentication & Roles

JWT-based authentication with two roles:

- **admin** — can manage categories, products, attributes, tags, images
- **superadmin** — everything admin can do, plus create/update/list users

Default superadmin is seeded on first startup: **admin / admin123**.

### Auth endpoints

- `POST /api/v1/auth/login` — get JWT token
- `GET /api/v1/auth/me` — current user info
- `POST /api/v1/auth/register` — create user (superadmin only)
- `GET /api/v1/auth/users` — list users (superadmin only)
- `PUT /api/v1/auth/users/{id}` — update user role/email/active (superadmin only)

## API Endpoints (Complete List)

### Auth
- `POST /api/v1/auth/login` — login, returns JWT
- `GET /api/v1/auth/me` — current user
- `POST /api/v1/auth/register` — create user (superadmin)
- `GET /api/v1/auth/users` — list users (superadmin)
- `PUT /api/v1/auth/users/{id}` — update user (superadmin)

### Categories
- `POST /api/v1/categories` — create (with optional labels)
- `GET /api/v1/categories` — list flat or `?tree=true` for nested
- `GET /api/v1/categories/{id}` — get single
- `PUT /api/v1/categories/{id}` — update name, labels, description, parent, active
- `DELETE /api/v1/categories/{id}` — soft delete (deactivate)
- `GET /api/v1/categories/{id}/children` — direct children
- `GET /api/v1/categories/{id}/ancestors` — breadcrumb chain

### Attributes
- `POST /api/v1/categories/{id}/attributes` — create (with optional labels)
- `GET /api/v1/categories/{id}/attributes` — effective (own + inherited)
- `PUT /api/v1/categories/{id}/attributes/{attr_id}` — update
- `DELETE /api/v1/categories/{id}/attributes/{attr_id}` — delete

### Products
- `POST /api/v1/products` — create (validates attributes against category schema)
- `GET /api/v1/products` — list with filters: `category_id`, `status`, `min_price`, `max_price`, `attrs[key]=value`, `limit`, `offset`
- `GET /api/v1/products/search?q=` — text search
- `GET /api/v1/products/{id}` — get single with images + tags
- `PUT /api/v1/products/{id}` — update (re-validates attributes)
- `DELETE /api/v1/products/{id}` — hard delete

### Product Images
- `POST /api/v1/products/{id}/images` — add image
- `DELETE /api/v1/products/{id}/images/{image_id}` — remove image
- `PUT /api/v1/products/{id}/images/reorder` — reorder by image_ids array

### Tags
- `POST /api/v1/tags` — create tag
- `GET /api/v1/tags` — list all tags
- `POST /api/v1/products/{id}/tags` — attach tag
- `DELETE /api/v1/products/{id}/tags/{tag_id}` — detach tag

### Lookup & Health
- `GET /api/v1/lookup?ref=electronics.phones` — resolve dotted path
- `GET /health` — API health check

## Admin Web App

The `web-app/` directory contains a React admin dashboard that uses **every API endpoint**:

- **Dashboard** — API health indicator, category/product/tag counts, ref path lookup tool, recent products
- **Categories** — interactive tree, inline edit (name, description, labels), right-side attributes panel with create/edit/delete, ancestor breadcrumb
- **Products** — table with search, category/status/price filters, pagination, edit modal, product detail modal, image management modal, tag management modal, dynamic attribute inputs on create
- **Users** (superadmin only) — user table, create form, edit modal (role, email, active toggle)

## Running Tests

```powershell
cd api-server
pip install pytest pytest-asyncio httpx aiosqlite
pytest tests/ -v
```

64 tests covering categories, attributes, products, labels, ref paths, and auth. Tests use in-memory SQLite — no PostgreSQL required.

## License

MIT
