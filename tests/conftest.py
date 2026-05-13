"""
Test configuration using an in-memory SQLite database.

Handles PostgreSQL-specific features (JSONB, Enum, GIN index) by adapting
them for SQLite at the SQLAlchemy level.
"""
import asyncio
import os

# MUST set before any app imports so the engine uses SQLite, not asyncpg
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Patch SQLite to handle PostgreSQL JSONB type
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

import app.models  # noqa: F401 — register all models with Base.metadata
from app.database import Base, get_db
from app.main import app as fastapi_app

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create a test engine and all tables once per session."""
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Enable foreign key enforcement for SQLite
    @event.listens_for(test_engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with test_engine.begin() as conn:
        # Drop PostgreSQL-specific indexes before creating tables in SQLite
        for table in Base.metadata.sorted_tables:
            indexes_to_remove = []
            for idx in table.indexes:
                if getattr(idx, "dialect_options", {}).get("postgresql", {}).get("using"):
                    indexes_to_remove.append(idx)
                # Also check the raw kwargs
                kw = getattr(idx, "kwargs", {})
                if "postgresql_using" in kw:
                    indexes_to_remove.append(idx)
            for idx in indexes_to_remove:
                table.indexes.discard(idx)

        await conn.run_sync(Base.metadata.create_all)

    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    """Provide a transactional database session that rolls back after each test."""
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Start a nested transaction so we can roll back after each test
        async with session.begin():
            yield session
            # Rollback so each test starts clean
            await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    """Provide an httpx AsyncClient wired to the FastAPI app with the test DB."""

    async def _override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    fastapi_app.dependency_overrides.clear()
