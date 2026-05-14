from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base, async_session_factory
from app.routers import categories, attributes, products
from app.routers import auth, lookup
from app.services.auth_service import seed_superadmin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables (dev only; use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed default superadmin if no users exist
    async with async_session_factory() as session:
        await seed_superadmin(session)
        await session.commit()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the admin web app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(attributes.router)
app.include_router(products.router)
app.include_router(lookup.router)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok"}
