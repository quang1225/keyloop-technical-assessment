# Unified Service Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fullstack dealership Service Appointment Scheduler (Scenario A) with FastAPI + Postgres availability/booking and a React hybrid wizard + day board UI.

**Architecture:** Monorepo with `apps/api` (FastAPI modular monolith, SQLAlchemy async, domain AvailabilityService + BookingService) and `apps/web` (Vite React 19 SPA, Tailwind 4, shadcn/ui, motion/react, TanStack Query). Docker Compose runs web, api, and Postgres. Spec: `docs/superpowers/specs/2026-07-15-unified-service-scheduler-design.md`.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2 async, Alembic, asyncpg, Pydantic v2, pytest, pytest-asyncio; React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, motion/react, TanStack Query; Postgres 16; Docker Compose.

---

## File structure (lock-in)

```
apps/api/
  pyproject.toml
  Dockerfile
  alembic.ini
  alembic/env.py
  alembic/versions/
  app/
    __init__.py
    main.py                 # FastAPI app, CORS, routers, request_id middleware
    config.py               # Settings from env
    db.py                   # async engine, session factory
    logging_config.py       # JSON structured logging
    models/
      __init__.py
      base.py
      entities.py           # all ORM models
    schemas/
      __init__.py
      catalog.py
      schedule.py
      availability.py
      appointments.py
      auth.py
    domain/
      __init__.py
      time_rules.py         # working hours, 30-min grid helpers (pure)
      availability.py       # AvailabilityService (pure + DB loaders)
      booking.py            # BookingService
    routers/
      __init__.py
      auth.py
      catalog.py
      schedule.py
      availability.py
      appointments.py
    deps.py                 # get_db, require_advisor
    seed.py                 # deterministic seed
  tests/
    conftest.py
    test_time_rules.py
    test_availability.py
    test_booking.py
    test_api_appointments.py

apps/web/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  Dockerfile
  src/
    main.tsx
    App.tsx
    index.css               # Tailwind + CSS variables (Daylight)
    lib/api.ts              # fetch client + types
    lib/auth.ts
    lib/slots.ts            # pure slot helpers (tested)
    components/
      ui/                   # shadcn primitives as needed
      SignInScreen.tsx
      SchedulerShell.tsx
      BookingPanel.tsx
      DayBoard.tsx
      ConfirmDialog.tsx
      ConflictToast.tsx
    hooks/
      useCatalog.ts
      useSchedule.ts
      useAvailability.ts
      useCreateAppointment.ts

docker-compose.yml
README.md
```

---

### Task 1: API project scaffold + health endpoint

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/app/__init__.py`
- Create: `apps/api/app/config.py`
- Create: `apps/api/app/main.py`
- Create: `apps/api/tests/test_health.py`

- [ ] **Step 1: Create `apps/api/pyproject.toml`**

```toml
[project]
name = "keyloop-scheduler-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "sqlalchemy[asyncio]>=2.0.36",
  "asyncpg>=0.30.0",
  "alembic>=1.14.0",
  "pydantic-settings>=2.6.0",
  "python-multipart>=0.0.17",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3.0",
  "pytest-asyncio>=0.24.0",
  "httpx>=0.28.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
testpaths = ["tests"]

[build-system]
requires = ["setuptools>=75.0.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["."]
include = ["app*"]
```

- [ ] **Step 2: Write failing health test**

```python
# apps/api/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
```

- [ ] **Step 3: Run test — expect fail (no app)**

Run: `cd apps/api && pip install -e ".[dev]" && pytest tests/test_health.py -v`  
Expected: FAIL (module not found or import error)

- [ ] **Step 4: Implement config + main**

```python
# apps/api/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+asyncpg://scheduler:scheduler@localhost:5432/scheduler"
    dealership_tz: str = "Europe/London"
    cors_origins: str = "http://localhost:5173"
    demo_advisor_id: str = "advisor-demo-1"
    demo_advisor_name: str = "Alex Morgan"

settings = Settings()
```

```python
# apps/api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="Keyloop Service Scheduler API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run test — expect pass**

Run: `cd apps/api && pytest tests/test_health.py -v`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/pyproject.toml apps/api/app apps/api/tests/test_health.py
git commit -m "feat(api): scaffold FastAPI app with health endpoint"
```

---

### Task 2: Time rules (pure domain) — TDD

**Files:**
- Create: `apps/api/app/domain/__init__.py`
- Create: `apps/api/app/domain/time_rules.py`
- Create: `apps/api/tests/test_time_rules.py`

- [ ] **Step 1: Write failing tests**

```python
# apps/api/tests/test_time_rules.py
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from app.domain.time_rules import (
    is_working_day,
    iter_candidate_starts,
    interval_within_working_hours,
    overlaps,
)

TZ = ZoneInfo("Europe/London")

def test_weekend_not_working_day():
    assert is_working_day(date(2026, 7, 18)) is False  # Saturday
    assert is_working_day(date(2026, 7, 15)) is True   # Wednesday

def test_candidate_starts_30_min_grid():
    starts = list(iter_candidate_starts(date(2026, 7, 15), duration_minutes=60, tz=TZ))
    assert starts[0] == datetime(2026, 7, 15, 8, 0, tzinfo=TZ)
    assert starts[-1] == datetime(2026, 7, 15, 16, 0, tzinfo=TZ)  # 16:00–17:00
    assert all((s.minute in (0, 30)) for s in starts)

def test_interval_must_end_by_close():
    start = datetime(2026, 7, 15, 16, 30, tzinfo=TZ)
    assert interval_within_working_hours(start, 60, TZ) is False
    assert interval_within_working_hours(start, 30, TZ) is True

def test_overlaps():
    a0 = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    a1 = a0 + timedelta(hours=1)
    b0 = datetime(2026, 7, 15, 9, 30, tzinfo=TZ)
    b1 = b0 + timedelta(hours=1)
    assert overlaps(a0, a1, b0, b1) is True
    assert overlaps(a0, a1, a1, a1 + timedelta(hours=1)) is False
```

- [ ] **Step 2: Run tests — expect fail**

Run: `cd apps/api && pytest tests/test_time_rules.py -v`  
Expected: FAIL (import error)

- [ ] **Step 3: Implement `time_rules.py`**

```python
# apps/api/app/domain/time_rules.py
from __future__ import annotations
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

WORK_START = time(8, 0)
WORK_END = time(17, 0)
SLOT_MINUTES = 30

def is_working_day(d: date) -> bool:
    return d.weekday() < 5  # Mon–Fri

def work_window(d: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(d, WORK_START, tzinfo=tz)
    end = datetime.combine(d, WORK_END, tzinfo=tz)
    return start, end

def interval_within_working_hours(start: datetime, duration_minutes: int, tz: ZoneInfo) -> bool:
    if start.tzinfo is None:
        raise ValueError("start must be timezone-aware")
    d = start.astimezone(tz).date()
    if not is_working_day(d):
        return False
    day_start, day_end = work_window(d, tz)
    end = start + timedelta(minutes=duration_minutes)
    return day_start <= start < end <= day_end

def iter_candidate_starts(d: date, duration_minutes: int, tz: ZoneInfo):
    if not is_working_day(d):
        return
    day_start, _ = work_window(d, tz)
    cursor = day_start
    while interval_within_working_hours(cursor, duration_minutes, tz):
        yield cursor
        cursor += timedelta(minutes=SLOT_MINUTES)

def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end

def is_on_grid(start: datetime, tz: ZoneInfo) -> bool:
    local = start.astimezone(tz)
    return local.minute in (0, 30) and local.second == 0 and local.microsecond == 0
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd apps/api && pytest tests/test_time_rules.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/domain apps/api/tests/test_time_rules.py
git commit -m "feat(api): add working-hours and slot grid time rules"
```

---

### Task 3: DB models, session, Alembic

**Files:**
- Create: `apps/api/app/db.py`
- Create: `apps/api/app/models/base.py`
- Create: `apps/api/app/models/entities.py`
- Create: `apps/api/app/models/__init__.py`
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: migration under `apps/api/alembic/versions/`

- [ ] **Step 1: Implement models**

```python
# apps/api/app/models/base.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

```python
# apps/api/app/models/entities.py
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

def _uuid() -> uuid.UUID:
    return uuid.uuid4()

class Dealership(Base):
    __tablename__ = "dealerships"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    vehicles: Mapped[list[Vehicle]] = relationship(back_populates="customer")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False)
    vin: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    customer: Mapped[Customer] = relationship(back_populates="vehicles")

class ServiceType(Base):
    __tablename__ = "service_types"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

class ServiceBay(Base):
    __tablename__ = "service_bays"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

class Technician(Base):
    __tablename__ = "technicians"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (UniqueConstraint("bay_id", "starts_at", name="uq_bay_start"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    service_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_types.id"), nullable=False)
    bay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_bays.id"), nullable=False)
    technician_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("technicians.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="confirmed")
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

```python
# apps/api/app/db.py
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 2: Init Alembic and create migration**

Run:

```bash
cd apps/api
alembic init alembic
```

Configure `alembic/env.py` to use async URL from `settings.database_url` and `target_metadata = Base.metadata`. Then:

```bash
# ensure Postgres is up (Task 12 Compose db service, or local Postgres matching config)
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Expected: tables created without error.

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/db.py apps/api/app/models apps/api/alembic.ini apps/api/alembic
git commit -m "feat(api): add SQLAlchemy models and Alembic migration"
```

---

### Task 4: AvailabilityService — TDD

**Files:**
- Create: `apps/api/app/domain/availability.py`
- Create: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/test_availability.py`

- [ ] **Step 1: Add conftest with in-memory scenario builders**

Use **Postgres test DB** (`scheduler_test`) or transactional fixtures. Minimal approach: pure unit tests that pass **in-memory dataclasses** into AvailabilityService so logic is tested without DB, then a thin integration test loads ORM rows.

```python
# apps/api/app/domain/availability.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from app.domain.time_rules import iter_candidate_starts, overlaps

@dataclass(frozen=True)
class BusyInterval:
    resource_id: str
    starts_at: datetime
    ends_at: datetime

@dataclass(frozen=True)
class TechInfo:
    id: str
    skills: frozenset[str]

@dataclass(frozen=True)
class AvailabilityQuery:
    day: date
    duration_minutes: int
    required_skills: frozenset[str]
    bay_ids: list[str]
    technicians: list[TechInfo]
    bay_busy: list[BusyInterval]
    tech_busy: list[BusyInterval]
    tz: ZoneInfo
    preferred_bay_id: str | None = None

@dataclass(frozen=True)
class SlotOption:
    starts_at: datetime
    bay_id: str
    technician_id: str

def _is_free(resource_id: str, start: datetime, end: datetime, busy: list[BusyInterval]) -> bool:
    for b in busy:
        if b.resource_id == resource_id and overlaps(start, end, b.starts_at, b.ends_at):
            return False
    return True

def qualified_technicians(required: frozenset[str], techs: list[TechInfo]) -> list[TechInfo]:
    return [t for t in techs if required <= t.skills]

def find_slots(q: AvailabilityQuery) -> list[datetime]:
    """Return distinct start times that have at least one feasible (bay, tech) pair."""
    pairs = find_slot_assignments(q)
    seen: list[datetime] = []
    for p in pairs:
        if not seen or seen[-1] != p.starts_at:
            if p.starts_at not in seen:
                seen.append(p.starts_at)
    return sorted(set(seen))

def find_slot_assignments(q: AvailabilityQuery) -> list[SlotOption]:
    techs = qualified_technicians(q.required_skills, q.technicians)
    if not techs:
        return []
    bay_ids = [q.preferred_bay_id] if q.preferred_bay_id else q.bay_ids
    if q.preferred_bay_id and q.preferred_bay_id not in q.bay_ids:
        return []
    out: list[SlotOption] = []
    for start in iter_candidate_starts(q.day, q.duration_minutes, q.tz):
        end = start + timedelta(minutes=q.duration_minutes)
        assigned = False
        for bay_id in bay_ids:
            if not _is_free(bay_id, start, end, q.bay_busy):
                continue
            for tech in techs:
                if _is_free(tech.id, start, end, q.tech_busy):
                    out.append(SlotOption(starts_at=start, bay_id=bay_id, technician_id=tech.id))
                    assigned = True
                    break
            if assigned:
                break
    return out

def first_assignment(q: AvailabilityQuery, starts_at: datetime) -> SlotOption | None:
    for opt in find_slot_assignments(q):
        if opt.starts_at == starts_at:
            return opt
    return None
```

- [ ] **Step 2: Write tests**

```python
# apps/api/tests/test_availability.py
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from app.domain.availability import (
    AvailabilityQuery, BusyInterval, TechInfo, find_slots, first_assignment,
)

TZ = ZoneInfo("Europe/London")
DAY = date(2026, 7, 15)

def _q(**kwargs):
    base = dict(
        day=DAY,
        duration_minutes=60,
        required_skills=frozenset({"brakes"}),
        bay_ids=["bay-1", "bay-2"],
        technicians=[
            TechInfo("tech-brake", frozenset({"brakes", "general"})),
            TechInfo("tech-general", frozenset({"general"})),
        ],
        bay_busy=[],
        tech_busy=[],
        tz=TZ,
    )
    base.update(kwargs)
    return AvailabilityQuery(**base)

def test_empty_day_has_morning_slot():
    slots = find_slots(_q())
    assert datetime(2026, 7, 15, 8, 0, tzinfo=TZ) in slots

def test_skill_mismatch_yields_no_slots():
    assert find_slots(_q(required_skills=frozenset({"ev"}))) == []

def test_bay_busy_blocks_slot():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    q = _q(bay_ids=["bay-1"], bay_busy=[BusyInterval("bay-1", start, start + timedelta(hours=1))])
    assert start not in find_slots(q)

def test_preferred_bay_used_in_assignment():
    start = datetime(2026, 7, 15, 10, 0, tzinfo=TZ)
    opt = first_assignment(_q(preferred_bay_id="bay-2"), start)
    assert opt is not None
    assert opt.bay_id == "bay-2"
```

- [ ] **Step 3: Run tests — expect pass after implementation**

Run: `cd apps/api && pytest tests/test_availability.py -v`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/domain/availability.py apps/api/tests/test_availability.py apps/api/tests/conftest.py
git commit -m "feat(api): implement AvailabilityService slot finding"
```

---

### Task 5: BookingService — TDD

**Files:**
- Create: `apps/api/app/domain/booking.py`
- Create: `apps/api/tests/test_booking.py`
- Modify: `apps/api/tests/conftest.py` (async DB session fixture if using integration tests)

- [ ] **Step 1: Write booking domain + conflict error**

```python
# apps/api/app/domain/booking.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.domain.availability import AvailabilityQuery, SlotOption, first_assignment
from app.domain.time_rules import interval_within_working_hours, is_on_grid

class BookingConflictError(Exception):
    def __init__(self, message: str = "No bay and qualified technician available for the requested time"):
        self.message = message
        super().__init__(message)

class BookingValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)

@dataclass(frozen=True)
class BookingRequest:
    starts_at: datetime
    duration_minutes: int
    availability: AvailabilityQuery
    advisor_id: str

@dataclass(frozen=True)
class BookingResult:
    bay_id: str
    technician_id: str
    starts_at: datetime
    ends_at: datetime
    created_by: str

def plan_booking(req: BookingRequest, now: datetime) -> BookingResult:
    tz = req.availability.tz
    if req.starts_at <= now:
        raise BookingValidationError("Start time must be in the future")
    if not is_on_grid(req.starts_at, tz):
        raise BookingValidationError("Start time must align to the 30-minute grid")
    if not interval_within_working_hours(req.starts_at, req.duration_minutes, tz):
        raise BookingValidationError("Appointment must fall within working hours")
    opt: SlotOption | None = first_assignment(req.availability, req.starts_at)
    if opt is None:
        raise BookingConflictError()
    ends = req.starts_at + timedelta(minutes=req.duration_minutes)
    return BookingResult(
        bay_id=opt.bay_id,
        technician_id=opt.technician_id,
        starts_at=req.starts_at,
        ends_at=ends,
        created_by=req.advisor_id,
    )
```

- [ ] **Step 2: Tests**

```python
# apps/api/tests/test_booking.py
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from app.domain.availability import AvailabilityQuery, BusyInterval, TechInfo
from app.domain.booking import BookingConflictError, BookingRequest, BookingValidationError, plan_booking

TZ = ZoneInfo("Europe/London")
NOW = datetime(2026, 7, 15, 7, 0, tzinfo=TZ)

def _avail(**kwargs):
    base = dict(
        day=date(2026, 7, 15),
        duration_minutes=60,
        required_skills=frozenset({"general"}),
        bay_ids=["bay-1"],
        technicians=[TechInfo("tech-1", frozenset({"general"}))],
        bay_busy=[],
        tech_busy=[],
        tz=TZ,
    )
    base.update(kwargs)
    return AvailabilityQuery(**base)

def test_happy_path_assigns_bay_and_tech():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    result = plan_booking(
        BookingRequest(start, 60, _avail(), "advisor-demo-1"),
        now=NOW,
    )
    assert result.bay_id == "bay-1"
    assert result.technician_id == "tech-1"
    assert result.ends_at == start + timedelta(hours=1)

def test_conflict_when_busy():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    avail = _avail(bay_busy=[BusyInterval("bay-1", start, start + timedelta(hours=1))])
    with pytest.raises(BookingConflictError):
        plan_booking(BookingRequest(start, 60, avail, "advisor-demo-1"), now=NOW)

def test_rejects_past():
    start = datetime(2026, 7, 15, 6, 0, tzinfo=TZ)
    with pytest.raises(BookingValidationError):
        plan_booking(BookingRequest(start, 60, _avail(), "advisor-demo-1"), now=NOW)
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && pytest tests/test_booking.py tests/test_availability.py -v`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/domain/booking.py apps/api/tests/test_booking.py
git commit -m "feat(api): implement booking plan with conflict validation"
```

---

### Task 6: Seed data + schemas + deps

**Files:**
- Create: `apps/api/app/seed.py`
- Create: `apps/api/app/schemas/*.py`
- Create: `apps/api/app/deps.py`
- Create: `apps/api/app/logging_config.py`

- [ ] **Step 1: Implement deterministic seed**

```python
# apps/api/app/seed.py
from __future__ import annotations
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.entities import (
    Appointment, Customer, Dealership, ServiceBay, ServiceType, Technician, Vehicle,
)

TZ = ZoneInfo("Europe/London")

def uid(n: int) -> uuid.UUID:
    return uuid.UUID(f"00000000-0000-4000-8000-{n:012d}")

DEALERSHIP_ID = uid(1)
CUSTOMER_1, CUSTOMER_2 = uid(11), uid(12)
VEHICLE_1, VEHICLE_2 = uid(21), uid(22)
SVC_OIL, SVC_BRAKE, SVC_EV = uid(31), uid(32), uid(33)
BAY_1, BAY_2, BAY_3 = uid(41), uid(42), uid(43)
TECH_1, TECH_2, TECH_3 = uid(51), uid(52), uid(53)
APPT_1, APPT_2 = uid(61), uid(62)

async def seed_if_empty(session: AsyncSession) -> None:
    existing = await session.scalar(select(Dealership).limit(1))
    if existing:
        return
    session.add(Dealership(id=DEALERSHIP_ID, name="Keyloop Demo Motors"))
    session.add_all([
        Customer(id=CUSTOMER_1, dealership_id=DEALERSHIP_ID, full_name="Jordan Lee", email="jordan@example.com"),
        Customer(id=CUSTOMER_2, dealership_id=DEALERSHIP_ID, full_name="Sam Patel", email="sam@example.com"),
        Vehicle(id=VEHICLE_1, dealership_id=DEALERSHIP_ID, customer_id=CUSTOMER_1, vin="WVWZZZ1JZYW000001", make="VW", model="Golf"),
        Vehicle(id=VEHICLE_2, dealership_id=DEALERSHIP_ID, customer_id=CUSTOMER_2, vin="WBA8E9G50JNU00002", make="BMW", model="330e"),
        ServiceType(id=SVC_OIL, dealership_id=DEALERSHIP_ID, name="Oil Change", duration_minutes=30, required_skills=["general"]),
        ServiceType(id=SVC_BRAKE, dealership_id=DEALERSHIP_ID, name="Brake Service", duration_minutes=60, required_skills=["brakes"]),
        ServiceType(id=SVC_EV, dealership_id=DEALERSHIP_ID, name="EV Diagnostic", duration_minutes=90, required_skills=["ev"]),
        ServiceBay(id=BAY_1, dealership_id=DEALERSHIP_ID, name="Bay 1"),
        ServiceBay(id=BAY_2, dealership_id=DEALERSHIP_ID, name="Bay 2"),
        ServiceBay(id=BAY_3, dealership_id=DEALERSHIP_ID, name="Bay 3"),
        Technician(id=TECH_1, dealership_id=DEALERSHIP_ID, full_name="Casey Nguyen", skills=["general", "brakes"]),
        Technician(id=TECH_2, dealership_id=DEALERSHIP_ID, full_name="Riley Brooks", skills=["general"]),
        Technician(id=TECH_3, dealership_id=DEALERSHIP_ID, full_name="Morgan Cole", skills=["general", "ev"]),
        Appointment(
            id=APPT_1, dealership_id=DEALERSHIP_ID, customer_id=CUSTOMER_1, vehicle_id=VEHICLE_1,
            service_type_id=SVC_OIL, bay_id=BAY_1, technician_id=TECH_2,
            starts_at=datetime(2026, 7, 15, 9, 0, tzinfo=TZ),
            ends_at=datetime(2026, 7, 15, 9, 30, tzinfo=TZ),
            status="confirmed", created_by="seed", created_at=datetime(2026, 7, 1, 12, 0, tzinfo=TZ),
        ),
        Appointment(
            id=APPT_2, dealership_id=DEALERSHIP_ID, customer_id=CUSTOMER_2, vehicle_id=VEHICLE_2,
            service_type_id=SVC_BRAKE, bay_id=BAY_2, technician_id=TECH_1,
            starts_at=datetime(2026, 7, 15, 11, 0, tzinfo=TZ),
            ends_at=datetime(2026, 7, 15, 12, 0, tzinfo=TZ),
            status="confirmed", created_by="seed", created_at=datetime(2026, 7, 1, 12, 0, tzinfo=TZ),
        ),
    ])
    await session.commit()
```

- [ ] **Step 2: Pydantic schemas** matching API section of the design spec (`VehicleOut`, `ServiceTypeOut`, `BayOut`, `TechnicianOut`, `ScheduleItemOut`, `AvailabilityOut` with `slots: list[datetime]`, `AppointmentCreate`, `AppointmentOut`, `DemoLoginOut`).

- [ ] **Step 3: `deps.py`**

```python
# apps/api/app/deps.py
from fastapi import Header, HTTPException, status
from app.config import settings

async def require_advisor(x_advisor_id: str | None = Header(default=None)) -> str:
    if x_advisor_id != settings.demo_advisor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in as demo advisor required")
    return x_advisor_id
```

Demo login returns `{ "advisor_id": settings.demo_advisor_id, "name": settings.demo_advisor_name }`. Web sends `X-Advisor-Id` on subsequent requests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/seed.py apps/api/app/schemas apps/api/app/deps.py apps/api/app/logging_config.py
git commit -m "feat(api): add seed data, schemas, and demo advisor dependency"
```

---

### Task 7: HTTP routers (catalog, schedule, availability, appointments, auth)

**Files:**
- Create: `apps/api/app/routers/*.py`
- Create: `apps/api/app/services/loaders.py` (ORM → AvailabilityQuery builder)
- Modify: `apps/api/app/main.py` (include routers, startup seed)
- Create: `apps/api/tests/test_api_appointments.py`

- [ ] **Step 1: Write API integration test (failing)**

```python
# apps/api/tests/test_api_appointments.py
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_appointment_happy_path(seeded_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/auth/demo-login")
        assert login.status_code == 200
        advisor_id = login.json()["advisor_id"]
        headers = {"X-Advisor-Id": advisor_id}
        vehicles = (await client.get("/catalog/vehicles", headers=headers)).json()
        services = (await client.get("/catalog/service-types", headers=headers)).json()
        oil = next(s for s in services if s["name"] == "Oil Change")
        vehicle_id = vehicles[0]["id"]
        avail = await client.get(
            "/availability",
            params={"vehicle_id": vehicle_id, "service_type_id": oil["id"], "date": "2026-07-15"},
            headers=headers,
        )
        assert avail.status_code == 200
        slot = avail.json()["slots"][0]
        res = await client.post(
            "/appointments",
            headers=headers,
            json={"vehicle_id": vehicle_id, "service_type_id": oil["id"], "start": slot, "bay_id": None},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "confirmed"
        assert body["bay_id"]
        assert body["technician_id"]
```

Provide `seeded_db` fixture in `conftest.py` that applies migrations, truncates, and runs `seed.py` against test DB.

- [ ] **Step 2: Implement routers**

- `POST /auth/demo-login` → demo advisor payload  
- `GET /catalog/*` → list entities for the single dealership  
- `GET /schedule?date=` → appointments that overlap that local day  
- `GET /availability?vehicle_id&service_type_id&date&bay_id?` → build `AvailabilityQuery` from DB busy rows → `find_slots`  
- `POST /appointments` → load busy inside a transaction with `SELECT … FOR UPDATE` on overlapping appointment rows (or lock bays/techs), rebuild query, `plan_booking`, insert `Appointment`, commit; map `BookingConflictError` → 409, `BookingValidationError` → 400  

Add request-id middleware in `main.py` (generate UUID, bind to logging contextvar, return `X-Request-Id`).

- [ ] **Step 3: Run API tests**

Run: `cd apps/api && pytest tests/test_api_appointments.py -v`  
Expected: PASS

Also add a test that double-posts the same slot → second returns 409.

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routers apps/api/app/services apps/api/app/main.py apps/api/tests
git commit -m "feat(api): expose catalog, schedule, availability, and booking routes"
```

---

### Task 8: Web app scaffold (Vite + Tailwind 4 + Daylight tokens)

**Files:**
- Create: `apps/web/*` via Vite template, then add Tailwind 4, path aliases, CSS variables

- [ ] **Step 1: Scaffold**

```bash
cd apps
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install motion @tanstack/react-query
# Tailwind 4 + vite plugin per current Tailwind docs
npm install tailwindcss @tailwindcss/vite
```

Configure `vite.config.ts` with `@tailwindcss/vite` plugin and `@` → `src` alias.  
`src/index.css`:

```css
@import "tailwindcss";

:root {
  --bg: #f0f4f8;
  --bg-accent: #d7ebe8;
  --surface: #ffffff;
  --ink: #0f172a;
  --muted: #64748b;
  --teal: #0d9488;
  --teal-deep: #0f766e;
  --border: #d0dbe6;
  --danger: #dc2626;
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: linear-gradient(160deg, var(--bg) 0%, #e8eef5 40%, var(--bg-accent) 100%);
}
```

Load an expressive display font (e.g. **Fraunces** or **Outfit**) via Google Fonts in `index.html` for headings — not Inter/Roboto/Arial as the primary brand face.

- [ ] **Step 2: Smoke render**

`App.tsx` temporarily renders `<h1>Keyloop Service Desk</h1>`.  
Run: `npm run dev` — page loads with Daylight gradient.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold Vite React app with Daylight theme tokens"
```

---

### Task 9: API client, fake SSO, shell

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/components/SignInScreen.tsx`
- Create: `apps/web/src/components/SchedulerShell.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: API client**

```typescript
// apps/web/src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Advisor = { advisor_id: string; name: string };

function headers(advisorId?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (advisorId) h["X-Advisor-Id"] = advisorId;
  return h;
}

export async function demoLogin(): Promise<Advisor> {
  const res = await fetch(`${BASE}/auth/demo-login`, { method: "POST" });
  if (!res.ok) throw new Error("Demo login failed");
  return res.json();
}

export async function apiGet<T>(path: string, advisorId: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: headers(advisorId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, advisorId: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(advisorId),
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const err = new Error("conflict");
    (err as Error & { status: number }).status = 409;
    throw err;
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Auth in `localStorage` key `scheduler.advisor`; SignInScreen CTA “Sign in as Advisor”; SchedulerShell shows advisor name + dealership title “Keyloop Demo Motors”.**

- [ ] **Step 3: Wire App routes: no advisor → SignIn; else Shell.**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add API client and fake SSO sign-in flow"
```

---

### Task 10: Slot helpers (Vitest) + BookingPanel + DayBoard

**Files:**
- Create: `apps/web/src/lib/slots.ts`
- Create: `apps/web/src/lib/slots.test.ts`
- Create: `apps/web/src/components/BookingPanel.tsx`
- Create: `apps/web/src/components/DayBoard.tsx`
- Create: hooks under `apps/web/src/hooks/`

- [ ] **Step 1: Vitest helper tests**

```typescript
// apps/web/src/lib/slots.ts
export function formatSlotLabel(iso: string, timeZone = "Europe/London"): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function isSlotFree(slotIso: string, freeSlots: string[]): boolean {
  return freeSlots.includes(slotIso);
}
```

```typescript
// apps/web/src/lib/slots.test.ts
import { describe, expect, it } from "vitest";
import { isSlotFree } from "./slots";

describe("isSlotFree", () => {
  it("matches exact iso strings", () => {
    expect(isSlotFree("a", ["a", "b"])).toBe(true);
    expect(isSlotFree("c", ["a", "b"])).toBe(false);
  });
});
```

Run: `cd apps/web && npm install -D vitest && npx vitest run src/lib/slots.test.ts`  
Expected: PASS

- [ ] **Step 2: BookingPanel** — motion steps: (1) select vehicle (2) select service type (3) select date (default `2026-07-15` for demo). On complete inputs, `useAvailability` fetches slots.

- [ ] **Step 3: DayBoard** — horizontal time axis 08:00–17:00, vertical lanes = bays; render schedule blocks from `GET /schedule`; highlight free starts from availability; click free cell sets draft `{ start, bayId }`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add booking wizard panel and day schedule board"
```

---

### Task 11: Confirm dialog, conflict toast, success motion

**Files:**
- Create: `apps/web/src/components/ConfirmDialog.tsx`
- Create: `apps/web/src/components/ConflictToast.tsx`
- Modify: `apps/web/src/App.tsx` / shell to compose flow

- [ ] **Step 1: ConfirmDialog** shows vehicle, service, time, bay; primary button calls `POST /appointments`.

- [ ] **Step 2: On 201** — success motion (motion/react), clear draft, invalidate schedule + availability queries.

- [ ] **Step 3: On 409** — ConflictToast (“That slot was just taken — pick another”), refetch availability + schedule.

- [ ] **Step 4: Manual demo checklist**

1. Sign in as Advisor  
2. See seeded appointments on board  
3. Book Oil Change into a free slot  
4. Board updates  
5. (Optional) Two browsers: force 409  

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add confirm flow with conflict handling and motion"
```

---

### Task 12: Docker Compose + README (assessment deliverable)

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile` (dev or nginx-served build)
- Create: `README.md`
- Modify: `.gitignore` (node_modules, .env, __pycache__, dist)

- [ ] **Step 1: `docker-compose.yml`**

Services: `db` (Postgres 16, user/password/db `scheduler`), `api` (uvicorn, migrate + seed on start), `web` (vite or nginx). Wire `DATABASE_URL` and `VITE_API_URL`.

- [ ] **Step 2: README sections**

1. Overview + chosen scenario  
2. Architecture blurb  
3. Prerequisites  
4. `docker compose up --build`  
5. Local dev (api + web separately)  
6. How to run tests (`pytest`, `vitest`)  
7. **AI Collaboration Narrative** (strategy, verification, ownership)  
8. Assumptions pointer to design spec  

- [ ] **Step 3: Verify**

```bash
docker compose up --build
curl -s http://localhost:8000/health
# open http://localhost:5173 (or published web port)
cd apps/api && pytest -v
cd apps/web && npx vitest run
```

Expected: health ok, UI reachable, tests green.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml apps/api/Dockerfile apps/web/Dockerfile README.md .gitignore
git commit -m "chore: add Docker Compose demo stack and README"
```

---

## Spec coverage checklist

| Spec requirement | Task(s) |
|------------------|---------|
| Resource-constrained booking (bay + tech) | 4, 5, 7, 11 |
| On-demand availability check | 4, 7, 10 |
| Persist appointment | 5, 7 |
| Day schedule board | 7, 10 |
| Fake SSO | 6, 7, 9 |
| Hybrid wizard + board UI | 10, 11 |
| Daylight visual | 8 |
| FastAPI + Postgres + Vite React | 1–12 |
| Working hours / 30-min grid | 2 |
| Skill qualification | 4 |
| 409 conflicts | 5, 7, 11 |
| Observability request_id + logs | 7 |
| Tests | 1, 2, 4, 5, 7, 10 |
| Docker + README + AI narrative | 12 |

## Out of scope (do not implement)

Cancel/reschedule, real IdP, WebSockets, soft holds, multi-dealership, specialty bays.
