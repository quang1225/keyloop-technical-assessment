# Agent Context — Unified Service Scheduler

Read-only project context for LLM agents working in this repository. For human setup and demo instructions, see [`README.md`](README.md).

## What This Is

Keyloop technical assessment submission — **Scenario A: Unified Service Scheduler** (Ownership domain). A dealership service advisor books vehicle services when both a **ServiceBay** and a **qualified Technician** are free for the full duration. Fullstack: `apps/web` (React SPA) + `apps/api` (FastAPI) + PostgreSQL.

## Repository Layout

```
apps/
  api/          FastAPI modular monolith — source of booking truth
    app/
      domain/   Pure Python: availability, booking, time_rules (no I/O)
      routers/  Thin HTTP adapters (auth, catalog, schedule, availability, appointments)
      services/ DB loaders that build domain query objects
      models/   SQLAlchemy entities
      schemas/  Pydantic request/response models
      seed.py   Deterministic demo data (auto-runs on empty DB)
    alembic/    Migrations
    tests/      pytest (uses dedicated scheduler_test DB)
  web/          Vite + React 19 + TypeScript SPA
    src/
      components/  UI (BookingPanel, DayBoard, DayAgenda, etc.)
      hooks/       TanStack Query wrappers
      lib/         api client, auth, slot helpers
docs/
  questions     Assessment brief
  specs/        System design (architecture, API, domain rules)
  plans/        Implementation plan with task boundaries
```

## Architecture Rules

**API layering** — keep this direction; do not leak HTTP or DB into domain:

```
HTTP (routers) → deps (demo auth) → services/loaders → pure domain → models/DB
```

**Frontend** — presentation and server-state caching only. The API assigns bay + technician; the web app never decides resource assignment.

**State** — TanStack Query for catalog, schedule, availability. Invalidate on book, cancel, or 409 conflict.

## Domain Invariants (Do Not Break)

These are correctness-critical. Verify with tests when changing booking/availability logic.

| Rule | Detail |
|------|--------|
| Dual resource | Both bay **and** qualified technician must be free for the **entire** service interval |
| Qualification | `technician.skills ⊇ service_type.required_skills` |
| Working hours | Mon–Fri, 08:00–17:00 dealership-local (`DEALERSHIP_TZ`, default `Europe/London`) |
| Grid | 30-minute slot alignment; services span multiple slots by duration |
| Assignment | First feasible (bay, tech) pair; prefer UI-selected `bay_id` when provided |
| Booking TX | Re-validate feasibility inside a DB transaction before insert |
| Conflicts | No feasible pair → **409**; same-bay race → **409** via partial unique index |
| Cancel | Soft-cancel (`status = cancelled`); excluded from schedule + availability busy intervals |
| Active uniqueness | Partial index `uq_bay_start_active` on `(bay_id, starts_at)` where `status <> 'cancelled'` |

**Known MVP limitation:** concurrent same-technician / different-bay races are not fully locked; same-bay races are handled.

## Demo Clock

`DEMO_NOW` (default `2026-07-15T10:00:00+01:00` in `app/config.py`) is the domain "now" so seeded slots stay bookable regardless of wall clock. Booking/availability use `demo_now()` from loaders — not `datetime.now()`.

## API Surface (Quick Reference)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/demo-login` | Returns demo advisor; no auth header needed |
| GET | `/catalog/*` | vehicles, service-types, bays, technicians |
| GET | `/schedule?date=` | Active (non-cancelled) appointments for a day |
| GET | `/availability?vehicle_id&service_type_id&date` | Optional `bay_id` filter |
| POST | `/appointments` | Requires `X-Advisor-Id` header |
| POST | `/appointments/{id}/cancel` | Idempotent guard: already cancelled → 409 |
| GET | `/health` | `{"status":"ok"}` |

OpenAPI at `http://localhost:8000/docs` when API is running.

## Out of Scope

Do not implement unless explicitly requested:

- Real auth / SSO providers
- **Reschedule** (move existing appointment to new slot)
- Multi-dealership switching
- WebSockets / SSE
- Soft holds / slot reservations
- Payments
- Bay type / specialty constraints

Cancel **is** in scope (post-MVP extension).

## Commands

```bash
# Full stack
docker compose up --build          # web :5173, api :8000, db :5432

# API only (after docker compose up db -d)
cd apps/api && source .venv/bin/activate
export DATABASE_URL=postgresql+asyncpg://scheduler:scheduler@localhost:5432/scheduler
alembic upgrade head && uvicorn app.main:app --reload --port 8000

# Web only
cd apps/web && npm install && npm run dev   # :5173, API default http://localhost:8000

# Tests (run before claiming work complete)
cd apps/api && pytest -v                      # uses scheduler_test DB automatically
cd apps/web && npx vitest run
cd apps/web && npm run lint                   # oxlint
```

## Conventions

**Python (API)**
- Python 3.12+, `from __future__ import annotations`
- Async SQLAlchemy throughout; routers stay thin
- Domain functions are pure and unit-tested without DB (`tests/test_availability.py`, `test_booking.py`, `test_time_rules.py`)
- Config via `app/config.py` / pydantic-settings (env vars or `.env` in `apps/api/`)
- Structured JSON logging with per-request `X-Request-Id`

**TypeScript (Web)**
- React 19 functional components, hooks in `src/hooks/`
- Tailwind CSS 4, motion for transitions
- API client in `src/lib/api.ts`; advisor id stored via `src/lib/auth.ts`
- Vitest for unit tests (`src/lib/slots.test.ts` pattern)
- `VITE_API_URL` env (baked at build time for Docker)

**General**
- Minimize diff scope; match existing patterns in surrounding files
- Do not add tests unless requested or they cover real behavior
- Do not commit unless explicitly asked
- Prefer editing domain + tests together when changing booking rules

## Key Files When Changing Behavior

| Area | Files |
|------|-------|
| Slot generation | `apps/api/app/domain/availability.py`, `time_rules.py` |
| Booking logic | `apps/api/app/domain/booking.py`, `routers/appointments.py` |
| DB queries / busy intervals | `apps/api/app/services/loaders.py` |
| Schema / migrations | `apps/api/app/models/entities.py`, `alembic/versions/` |
| Availability UI | `apps/web/src/components/DayBoard.tsx`, `hooks/useAvailability.ts` |
| Booking flow | `apps/web/src/components/BookingPanel.tsx`, `hooks/useCreateAppointment.ts` |

## Authoritative Docs

1. [`docs/questions`](docs/questions) — assessment requirements
2. [`docs/specs/2026-07-15-unified-service-scheduler-system-design.md`](docs/specs/2026-07-15-unified-service-scheduler-system-design.md) — architecture, API, data flow, assumptions
3. [`docs/plans/2026-07-15-unified-service-scheduler.md`](docs/plans/2026-07-15-unified-service-scheduler.md) — task-level implementation history

When spec and code disagree, treat the spec's booking/availability invariants as the source of truth and fix code + tests.
