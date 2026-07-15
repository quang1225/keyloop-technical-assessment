from __future__ import annotations

import os


def _resolve_test_database_url() -> str:
    """Always point tests at a dedicated `scheduler_test` database.

    We swap in the `scheduler_test` database name regardless of what
    DATABASE_URL was exported for local/manual use, so the test suite never
    truncates or seeds over real data. This must run before `app.config` (or
    anything importing it) is loaded, since `Settings()` reads the
    environment once, at import time.
    """
    base = os.environ.get(
        "DATABASE_URL", "postgresql+asyncpg://scheduler:scheduler@localhost:5432/scheduler"
    )
    scheme, _, rest = base.partition("://")
    prefix, _, db_name = rest.rpartition("/")
    if db_name != "scheduler_test":
        base = f"{scheme}://{prefix}/scheduler_test"
    return base


os.environ["DATABASE_URL"] = _resolve_test_database_url()

import pytest_asyncio  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_after_test():
    """Dispose pooled connections at the end of every test.

    pytest-asyncio opens a fresh event loop per test function by default.
    asyncpg connections are bound to the loop that created them, so a pooled
    connection left open from one test's loop breaks (or silently misbehaves)
    when checked out under the next test's loop. Disposing here forces the
    next test that touches the DB to open brand-new connections instead.
    """
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_db():
    """Recreate the schema against `scheduler_test` and seed demo data.

    Schema is (re)built via SQLAlchemy metadata drop_all/create_all rather
    than by shelling out to Alembic here: Alembic's async env.py calls
    asyncio.run() internally, which cannot be nested inside the event loop
    pytest-asyncio is already running for this fixture. `alembic upgrade
    head` (see apps/api/alembic/) remains the source of truth for real
    deployments; this fixture just needs an equivalent schema for tests.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        await seed_if_empty(session)

    yield
