from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import SessionLocal
from app.logging_config import configure_logging
from app.routers import appointments, auth, availability, catalog, schedule
from app.seed import seed_if_empty

logger = logging.getLogger("app.request")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    async with SessionLocal() as session:
        await seed_if_empty(session)
    yield


app = FastAPI(title="Keyloop Service Scheduler API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    logger.info(json.dumps(f"request started {request.method} {request.url.path} request_id={request_id}"))
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    logger.info(json.dumps(f"request completed {response.status_code} request_id={request_id}"))
    return response


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(schedule.router)
app.include_router(availability.router)
app.include_router(appointments.router)
