# Unified Service Scheduler — System Design Document

**Date:** 2026-07-15  
**Scenario:** Keyloop Technical Assessment — Scenario A (Ownership)  
**Status:** Approved for implementation planning  

This document is the assessment **System Design Document**: architecture diagram, component roles, data flow, technology choices with justifications, observability strategy, and how GenAI assisted the design phase.

## 1. Goal

Build a dealership **Service Appointment Scheduler** that lets a service advisor book a vehicle service when both a **ServiceBay** and a **qualified Technician** are free for the full service duration, then persist a confirmed **Appointment**.

The submission ships **both** frontend and backend (exceeding the brief’s “one layer” minimum) to showcase fullstack skills, with a motion-rich advisor UI.

## 2. Product decisions

| Decision | Choice |
|----------|--------|
| Primary user | Dealership service advisor |
| Booking UX | Hybrid: compact wizard + day schedule board |
| “Real-time” availability | On-demand fetch on input change; re-check on confirm |
| Auth | Fake SSO — “Sign in as Advisor” → seeded demo user |
| MVP extras | Core booking + today’s schedule board (no cancel/reschedule) |
| Visual direction | Daylight Dealership — cool gray + teal |
| Architecture | Vite React SPA + FastAPI modular monolith + Postgres |
| Dealership scope | Single seeded dealership |

### Out of scope (MVP)

- Real authentication / SSO providers  
- Cancel / reschedule  
- Multi-dealership switching  
- WebSockets / SSE live updates  
- Soft holds / slot reservations  
- Payments  
- Bay type constraints (bays are generic)

## 3. Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Docker Compose (local demo)                          │
│                                                                              │
│  ┌────────────────────────────┐         REST / JSON          ┌─────────────┐ │
│  │  apps/web                  │  ─────────────────────────►  │  apps/api   │ │
│  │  Vite + React 19 + TS      │                              │  FastAPI    │ │
│  │  Tailwind CSS 4 + motion  │  ◄─────────────────────────  │  uvicorn    │ │
│  │  TanStack Query            │                              │             │ │
│  │                            │                              │  ┌────────┐ │ │
│  │  SignIn · BookingPanel     │                              │  │Routers │ │ │
│  │  DayBoard · ConfirmDialog  │                              │  └────┬───┘ │ │
│  └────────────────────────────┘                              │       │     │ │
│                                                              │  ┌────▼───┐ │ │
│                                                              │  │Domain  │ │ │
│                                                              │  │Avail.  │ │ │
│                                                              │  │Booking │ │ │
│                                                              │  └────┬───┘ │ │
│                                                              │       │     │ │
│                                                              │  ┌────▼───┐ │ │
│                                                              │  │SQLAlch.│ │ │
│                                                              │  │async + │ │ │
│                                                              │  │Alembic │ │ │
│                                                              │  └────┬───┘ │ │
│                                                              └───────┼─────┘ │
│                                                                      │       │
│                                                              ┌───────▼─────┐ │
│                                                              │ PostgreSQL  │ │
│                                                              │ 16          │ │
│                                                              └─────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Logical layers (API modular monolith):**

```
HTTP (routers) → deps (demo auth) → services/loaders → pure domain → models/DB
```

Domain rules (`availability`, `booking`, `time_rules`) stay pure Python and unit-testable without I/O. Persistence and HTTP stay at the edges.

## 4. Component roles

| Component | Role |
|-----------|------|
| **`apps/web`** | Advisor SPA: fake SSO, hybrid booking wizard + day schedule board, confirm/conflict UX. Owns presentation and client-side server-state caching; does not decide bay/tech assignment. |
| **`apps/api`** | REST API and source of booking truth. Validates requests, computes availability, assigns resources inside a DB transaction, exposes OpenAPI via FastAPI. |
| **Routers** (`auth`, `catalog`, `schedule`, `availability`, `appointments`) | Thin HTTP adapters: parse/validate input, call loaders/domain, map errors to 400/404/409/422. |
| **Domain — Availability** | Given duration, skills, busy intervals, and working hours, returns feasible start times (and bay+tech pairs). Qualification: `technician.skills ⊇ service_type.required_skills`. |
| **Domain — Booking** | Re-validates grid/hours/future, picks first feasible (bay, tech) pair (preferring UI-selected bay), or raises conflict. |
| **Loaders / services** | Load dealership resources and existing appointments from Postgres into domain query objects. |
| **PostgreSQL** | Durable store for dealership, customers, vehicles, service types, bays, technicians, advisors, and appointments. |
| **Alembic** | Schema migrations; applied on API startup in Compose. |
| **Seed** | Deterministic demo data (single dealership, varied skills, pre-booked appointments) for board + tests. |
| **Docker Compose** | One-command demo: `web` + `api` + `db`. |

## 5. Domain model

- **Dealership** — one seeded record  
- **Customer** — name, contact  
- **Vehicle** — VIN, make, model, customer FK  
- **ServiceType** — name, duration (minutes), required skill tags  
- **ServiceBay** — name/label within dealership  
- **Technician** — name, skill tags  
- **Appointment** — customer, vehicle, service type, bay, technician, start/end, status (`confirmed`), created_by (demo advisor), timestamps  

### Qualification rule

A technician is eligible for a service if `technician.skills ⊇ service_type.required_skills`.

### Working hours

- Monday–Friday, **08:00–17:00** dealership local time  
- Availability grid: **30-minute** increments  
- Services may span multiple slots (duration-driven)

### Assignment policy

On book, the API assigns the **first feasible (bay, technician) pair** for the requested start time. If the advisor selected a specific bay lane on the board, prefer that bay and any qualified free technician.

## 6. API surface (MVP)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/demo-login` | Issue demo advisor session (cookie or opaque token) |
| GET | `/catalog/vehicles` | List seed vehicles (with customer) |
| GET | `/catalog/service-types` | List services |
| GET | `/catalog/bays` | List bays |
| GET | `/catalog/technicians` | List technicians |
| GET | `/schedule?date=YYYY-MM-DD` | Existing appointments for day board |
| GET | `/availability?vehicle_id&service_type_id&date` | Free start slots (+ optional bay filter) |
| POST | `/appointments` | Create appointment (re-validate in transaction) |
| GET | `/health` | Liveness for Compose / probes |

OpenAPI generated by FastAPI. All mutating/booking routes accept the demo advisor identity.

### Booking request (conceptual)

```json
{
  "vehicle_id": "…",
  "service_type_id": "…",
  "start": "2026-07-15T09:00:00",
  "bay_id": null
}
```

`bay_id` optional — set when advisor clicks a bay lane.

## 7. Domain services

### AvailabilityService

Inputs: dealership, service type, date (and optional bay).  
Outputs: list of valid start times (and/or free windows) where:

1. Start aligns to 30-minute grid within working hours  
2. Interval `[start, start+duration)` is within working hours  
3. At least one bay is free for the entire interval  
4. At least one **qualified** technician is free for the entire interval  
5. If `bay_id` provided, that bay must be free and pair with some qualified free tech  

Busy time comes from existing confirmed appointments for bays and technicians.

### BookingService

1. Validate IDs and that start is on-grid / in hours / not in the past (demo clock may use seed “today”)  
2. In a **single DB transaction**, re-run feasibility  
3. Assign bay + technician per policy  
4. Insert `Appointment` with status `confirmed`  
5. On no feasible pair → abort with **409 Conflict**  

Concurrency: rely on transactional re-check; document that production could add exclusion constraints / advisory locks. MVP tests cover sequential and concurrent double-book attempts.

## 8. Frontend structure

### Screens / regions

- **SignInScreen** — Daylight branding + “Sign in as Advisor”  
- **SchedulerShell** — advisor chrome, dealership label, date control  
- **BookingPanel** — stepped inputs: vehicle → service → day (motion between steps)  
- **DayBoard** — lanes (bays or techs) with existing appointments; free slots highlighted after availability load  
- **SlotPicker** — select free window → draft selection on board  
- **ConfirmDialog** — summary → submit  
- **ConflictToast** — 409 handling + refresh schedule/availability  

### Visual system

- Cool gray surfaces, teal accent, airy retail-floor density  
- Expressive fonts (not Inter/Roboto/Arial defaults)  
- Intentional motion: step transitions, slot highlight, confirm success  

### State

- Server state via TanStack Query for catalog, schedule, availability  
- Local UI state for wizard step + draft slot  

## 9. Data flow

### 9.1 Happy path (book)

```
Advisor                  Web                         API                         Postgres
   │                      │                           │                              │
   │  Sign in as Advisor  │  POST /auth/demo-login    │                              │
   │─────────────────────►│──────────────────────────►│  load demo advisor           │
   │                      │◄──────────────────────────│◄─────────────────────────────│
   │                      │  store opaque token       │                              │
   │                      │                           │                              │
   │  open scheduler      │  GET /catalog/*           │                              │
   │                      │  GET /schedule?date=…     │  read appointments           │
   │                      │──────────────────────────►│─────────────────────────────►│
   │                      │◄──────────────────────────│◄─────────────────────────────│
   │  DayBoard rendered   │                           │                              │
   │                      │                           │                              │
   │  pick vehicle+svc    │  GET /availability?…      │  build query + find_slots    │
   │─────────────────────►│──────────────────────────►│─────────────────────────────►│
   │  free slots highlight│◄──────────────────────────│◄─────────────────────────────│
   │                      │                           │                              │
   │  pick start (+bay)   │  POST /appointments       │  BEGIN TX                    │
   │  confirm             │──────────────────────────►│  re-check feasibility        │
   │                      │                           │  INSERT appointment          │
   │                      │◄── 201 Appointment ───────│  COMMIT                      │
   │  success + refresh   │  invalidate queries       │                              │
```

### 9.2 Conflict path

Between availability preview and confirm, another booking (or concurrent request) can take the bay/tech:

1. `POST /appointments` re-runs feasibility **inside a transaction**.
2. No feasible pair → **409 Conflict** (no partial write).
3. UI shows conflict toast, refetches schedule/availability, advisor picks again.

### 9.3 Availability rules (summary)

A start time is free only if all hold:

1. Aligned to a **30-minute** grid within Mon–Fri **08:00–17:00** (dealership TZ).
2. Interval `[start, start+duration)` stays inside working hours.
3. At least one **bay** is free for the whole interval.
4. At least one **qualified** technician is free for the whole interval.
5. Optional `bay_id`: that bay must be free and pairable with some qualified free tech.

Busy intervals come from existing `confirmed` appointments.

## 10. Chosen technologies & justifications

| Technology | Why |
|------------|-----|
| **FastAPI** | Async-native Python API, automatic OpenAPI, Pydantic validation — clear REST contracts and fast assessment demos. |
| **SQLAlchemy 2.x (async) + asyncpg** | Typed ORM with async sessions; overlaps Postgres concurrency story without blocking the event loop. |
| **PostgreSQL 16** | Reliable ACID store for conflict-sensitive booking; preferred over SQLite for fidelity of concurrent/integration tests. |
| **Alembic** | Versioned schema changes; reproducible from empty DB. |
| **React 19 + TypeScript + Vite** | Fast SPA toolchain; TypeScript catches contract drift against the API. |
| **TanStack Query** | Server state (catalog, schedule, availability) with cache invalidation after book/conflict — matches on-demand “real-time” check model. |
| **Tailwind CSS 4 + motion** | Consistent “Daylight Dealership” visual system and intentional motion without a heavy UI framework. |
| **Docker Compose** | Portable one-command run for reviewers (web + api + db). |
| **pytest / Vitest** | Backend domain + API tests; frontend pure helpers (slot formatting / lane mapping). |

**Architectural style:** modular monolith (not microservices). For this MVP scale, a single deployable API keeps transactional booking simple and operational cost low; domain modules remain separable if services are split later.

## 11. Observability strategy

### 11.1 Logging (MVP)

- Structured JSON logging at API startup.
- Per-request **`request_id`** (UUID) via middleware; echoed as **`X-Request-Id`** on responses.
- Request start/complete lines include method, path, status, and `request_id`.
- Booking/availability paths include advisor id and key fields (vehicle, service, start) where useful for support.

### 11.2 Metrics (lightweight MVP)

| Metric | Purpose |
|--------|---------|
| `availability_requests_total` | Demand for slot search |
| `bookings_succeeded_total` | Successful confirms |
| `bookings_conflicted_total` | 409 races / no capacity |
| `bookings_validation_errors_total` | 400 business rule failures |

These distinguish capacity conflict from bad input and support demo/ops health checks without a full metrics stack in MVP. Process-local counters first; Prometheus-ready later if needed.

### 11.3 Tracing (near-term / production path)

- **MVP:** correlation via `request_id` only (sufficient for a single-process API).
- **Next:** OpenTelemetry instrumentation on FastAPI + SQLAlchemy; propagate `traceparent` from the SPA; export to Jaeger/OTLP.
- Spans of interest: `GET /availability`, `POST /appointments` (including TX boundary), loader queries.

### 11.4 Health & errors

| Code | Meaning |
|------|---------|
| `200` / `201` | Success |
| `400` | Business validation (past time, outside hours, bad combo) |
| `404` | Unknown entity |
| `409` | No feasible bay+tech / booking race |
| `422` | Schema validation (Pydantic) |
| `GET /health` | Process liveness for Compose / probes |

## 12. Testing strategy

### Backend (required)

- Unit: AvailabilityService — overlaps, skill mismatch, working-hours edges, duration spanning slots  
- Integration: BookingService — happy path, conflict, concurrent double-book  
- API tests against test DB (Postgres in CI or SQLite only if async parity is acceptable; prefer Postgres for fidelity)

### Frontend

- Vitest for pure helpers (slot formatting, lane mapping)  
- Playwright smoke optional, not MVP-blocking  

### Seed data

Fixed dealership with known bays, technicians (varied skills), service types, and a few pre-seeded appointments so the board and tests are deterministic.

## 13. Repository layout (planned)

```
/
  apps/
    web/          # Vite + React 19 + TS + Tailwind 4 + shadcn + motion
    api/          # FastAPI + SQLAlchemy async + Alembic
  docs/
    specs/        # this document (System Design Document)
    questions     # assessment brief
  docker-compose.yml
  README.md
```

## 14. How GenAI assisted the design phase

GenAI (Cursor agents) was used as a **design collaborator**, not as an unsupervised author. The design-phase workflow:

### 14.1 Ambiguity pressure-testing

The assessment brief leaves many product/architecture choices open. An agent was used to enumerate options and trade-offs for:

- Single vs multi-dealership scope  
- Real IdP vs fake SSO  
- Wizard-only vs schedule-board vs hybrid UX  
- Soft holds vs confirm-time re-check  
- Microservice split vs modular monolith  

I selected the options that fit an assessable MVP (single dealership, fake SSO, hybrid UX, transactional re-check, modular monolith) and recorded them as explicit assumptions.

### 14.2 Spec drafting and structure

The agent helped turn those decisions into this structured design document: architecture diagram, domain model, API table, availability/booking algorithms, technology justifications, observability strategy, out-of-scope list, and testing strategy. I reviewed every domain rule (skill superset, working hours, dual resource lock for full duration, 409 semantics) and corrected anything that drifted from the intended product behavior.

### 14.3 What GenAI was *not* trusted for alone

- Final say on concurrency/consistency (TX re-check vs locks).  
- Acceptance of “real-time” as WebSockets — rejected in favor of on-demand + confirm re-check for MVP cost/complexity.  
- Scope creep (cancel/reschedule, multi-dealer, payments) — kept out deliberately.

### 14.4 Handoff to implementation

Once the design was approved, GenAI assisted with an implementation plan and test-first task execution. Verification remained human-owned: pytest for availability/booking edges and races, Vitest for UI helpers, and manual walkthrough of the advisor flow. The AI Collaboration Narrative in the README covers the implementation/verification story in more depth; this section focuses on **design-phase** use of GenAI.

## 15. Assessment deliverables mapping

| Deliverable | How this design supports it |
|-------------|----------------------------|
| System Design Document | This file — architecture diagram, component roles, data flow, tech + justifications, observability, GenAI design narrative |
| Working code | `apps/web` + `apps/api` + Compose + README (run/test + AI collaboration narrative) |
| Tests | pytest core business logic; Vitest helpers |
| Video | Fake SSO → hybrid book → conflict or success on Daylight UI |

## 16. Assumptions log

1. Single dealership is sufficient for MVP.  
2. Bays are interchangeable (no specialty bays).  
3. Technician qualification = skill tag superset.  
4. Working hours Mon–Fri 08:00–17:00; 30-minute grid.  
5. Auto-assign first feasible pair; optional bay preference from UI.  
6. Demo “today” is driven by seed/system date for reproducible demos.  
7. Fake SSO is acceptable for assessment auth story.  
8. Implementing both FE and BE is intentional scope beyond the minimum brief.  
9. On-demand availability (fetch on input change + re-check on confirm) satisfies “real-time” without WebSockets/SSE.

## 17. Non-goals reminder

Do not implement cancel/reschedule, multi-dealer, live push updates, soft holds, real IdP integration, or a full OpenTelemetry export pipeline in MVP (tracing path is documented above as next step).
