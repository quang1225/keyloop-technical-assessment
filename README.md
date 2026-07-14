# Keyloop Technical Assessment — Unified Service Scheduler

## 1. Overview

This is a submission for **Scenario A: The Unified Service Scheduler** (domain: Ownership) from the Keyloop technical assessment.

It's a dealership **Service Appointment Scheduler** that lets a service advisor book a vehicle service when both a **ServiceBay** and a **qualified Technician** are free for the entire service duration, then persists a confirmed **Appointment**. The submission ships both the backend and the frontend — exceeding the brief's "implement one layer" minimum — to demonstrate fullstack ownership end to end.

Full requirements are in [`docs/questions`](docs/questions). The full architectural rationale, domain model, and API surface are in the design spec: [`docs/superpowers/specs/2026-07-15-unified-service-scheduler-design.md`](docs/superpowers/specs/2026-07-15-unified-service-scheduler-design.md).

## 2. Architecture

```
┌─────────────────────────┐         REST/JSON          ┌─────────────────────────┐
│  apps/web               │ ─────────────────────────► │  apps/api               │
│  React 19 + TypeScript  │                            │  FastAPI                │
│  Tailwind CSS 4         │ ◄───────────────────────── │  SQLAlchemy (async)     │
│  TanStack Query + motion│                            │  Availability/Booking   │
└─────────────────────────┘                            └───────────┬─────────────┘
                                                                    │
                                                                    ▼
                                                          ┌─────────────────────┐
                                                          │  PostgreSQL 16      │
                                                          └─────────────────────┘
```

- **`apps/web`** — Vite + React 19 SPA. Fake SSO sign-in, a booking wizard, and a day schedule board, styled with Tailwind CSS 4 and animated with `motion`. Server state (catalog, schedule, availability) lives in TanStack Query.
- **`apps/api`** — FastAPI modular monolith with an async SQLAlchemy data layer. Owns the domain logic for availability search and transactional booking (bay + technician conflict checks), structured JSON logging with request IDs, and Alembic migrations.
- **PostgreSQL** — source of truth for dealership resources (bays, technicians, vehicles, customers, service types) and appointments.

## 3. Prerequisites

- **Docker Desktop** (Docker Engine + Compose v2) — for the one-command demo, **or**
- **Local dev toolchain** — Python 3.12+, Node.js 20+, and a local PostgreSQL 16 instance

## 4. Quick start (Docker Compose)

```bash
docker compose up --build
```

This builds and starts three services:

| Service | URL | Notes |
|---------|-----|-------|
| `db` | `localhost:5432` | Postgres 16, user/password/db all `scheduler` |
| `api` | http://localhost:8000 | runs `alembic upgrade head` then `uvicorn`, seeds demo data on startup |
| `web` | http://localhost:5173 | nginx-served production build of the Vite app |

Once it's up:

```bash
curl -s http://localhost:8000/health
# {"status":"ok"}
```

Then open http://localhost:5173 and click "Sign in as Advisor".

> **Note on this submission:** Docker wasn't available in the environment where this was authored (Windows box without a working Docker Engine), so the Compose stack above is written to match the local-dev setup exactly (same env vars, same migrate-then-serve command) but has **not** been live-verified end-to-end with `docker compose up`. If it doesn't come up cleanly, the [local dev](#5-local-dev-api) steps below are the fallback path and are what was actually used during development.

## 5. Local dev — API

The API was developed against a local Postgres 16 container/instance published on **port 5433** (5432 was already taken locally) — adjust the port in `DATABASE_URL` to match whatever Postgres you have running.

```bash
cd apps/api

python -m venv .venv
.venv\Scripts\activate        # Windows PowerShell
# source .venv/bin/activate   # macOS/Linux

pip install -e ".[dev]"

# Point at your Postgres instance (adjust host/port/credentials as needed):
$env:DATABASE_URL = "postgresql+asyncpg://scheduler:scheduler@localhost:5433/scheduler"   # PowerShell
# export DATABASE_URL=postgresql+asyncpg://scheduler:scheduler@localhost:5433/scheduler   # bash

alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

Demo data (dealership, customers, vehicles, service types, bays, technicians, the demo advisor) is seeded automatically on startup if the database is empty — see `app/seed.py`. No separate seed command is required.

Other settings (see `app/config.py`, all overridable via env vars or a `.env` file in `apps/api/`):

- `CORS_ORIGINS` (default `http://localhost:5173`)
- `DEALERSHIP_TZ` (default `Europe/London`)
- `DEMO_NOW` — a fixed clock used by the booking domain logic so seeded slots don't drift into the past as real time passes (the seed data lives on `2026-07-15`)

## 6. Local dev — Web

```bash
cd apps/web

npm install

# Optional — defaults to http://localhost:8000 if unset:
# create apps/web/.env.local with:
# VITE_API_URL=http://localhost:8000

npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

## 7. Tests

```bash
# API — pytest against a scheduler_test database (see apps/api/tests/conftest.py)
cd apps/api
pytest -v

# Web — Vitest
cd apps/web
npx vitest run
```

The API test suite always targets a dedicated `scheduler_test` database (swapped in automatically regardless of what `DATABASE_URL` points at) so it never touches seeded/demo data.

## 8. AI Collaboration Narrative

This project was built with Cursor agents as an active collaborator throughout, not just for code generation. The high-level flow:

1. **Brainstorming** — worked through the scenario's ambiguities (single vs. multi-dealership, auth strategy, booking UX, concurrency model) with an agent before writing any spec, to pressure-test assumptions early.
2. **Design spec** — turned the brainstorm into a written design document (`docs/superpowers/specs/2026-07-15-unified-service-scheduler-design.md`) covering architecture, domain model, API surface, and explicit out-of-scope items, so the "what" and "why" were fixed before implementation started.
3. **Implementation plan** — decomposed the spec into a numbered, file-scoped task list (`docs/superpowers/plans/2026-07-15-unified-service-scheduler.md`), each task ending in an explicit verification step and a commit boundary.
4. **Subagent-driven, test-first implementation** — each task was executed by a subagent following a test-driven loop: write/adjust tests for the behavior in that task, implement against them, run the suite, then commit. This kept the diff-per-task reviewable and gave a hard verification gate (green tests) before moving to the next task.
5. **Verification** — every backend task was checked against `pytest`, every frontend task against `vitest` and manual UI review; this Docker/README task was checked by reading the actual app config (`app/config.py`, `app/main.py`, `vite.config.ts`, `package.json`) rather than assuming defaults, so the Compose env vars and commands match what the code actually expects.
6. **Ownership** — the AI proposed structure and code, but the domain rules that matter for correctness — bay *and* technician must both be free for the full duration, technician skill qualification (`skills ⊇ required_skills`), working-hours/30-minute-grid alignment, and the transactional re-check that turns a lost race into a `409` instead of a double-booking — were reviewed against the spec line by line and validated via targeted tests, not taken on faith. Anywhere the AI's first pass didn't match the spec's booking/availability rules, it was corrected and re-verified rather than accepted as-is.

## 9. Assumptions

Documented in detail in the [design spec](docs/superpowers/specs/2026-07-15-unified-service-scheduler-design.md); the key ones:

- **Single seeded dealership** — no multi-dealership switching in this MVP.
- **Fixed demo clock (`DEMO_NOW`)** — the booking domain logic treats this as "now" instead of the real wall clock, so the seeded 2026-07-15 schedule always has bookable future slots regardless of when the demo is actually run.
- **Fake SSO** — "Sign in as Advisor" hands back a single seeded demo advisor identity; there's no real identity provider.
- **Working hours are Monday–Friday, 08:00–17:00** dealership-local time, on a **30-minute** availability grid; services may span multiple slots depending on duration.
- **Bays are generic** — no bay-type/specialty constraints; any free bay + any qualified free technician is a valid pair.
- **No cancel/reschedule, multi-dealership, WebSockets/SSE, soft holds, or payments** — explicitly out of scope for this MVP (see the spec's "Out of scope" section).
