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

    # These mapped classes only declare raw FK columns (no relationship()),
    # so SQLAlchemy's unit-of-work cannot infer an insert dependency order
    # across tables on its own within a single flush. Flush in explicit
    # dependency tiers (dealership -> customers -> {vehicles, service
    # types/bays/technicians} -> appointments) so each tier's FK targets are
    # already present when the next tier is inserted.
    session.add(Dealership(id=DEALERSHIP_ID, name="Keyloop Demo Motors"))
    await session.flush()

    session.add_all([
        Customer(id=CUSTOMER_1, dealership_id=DEALERSHIP_ID, full_name="Jordan Lee", email="jordan@example.com"),
        Customer(id=CUSTOMER_2, dealership_id=DEALERSHIP_ID, full_name="Sam Patel", email="sam@example.com"),
    ])
    await session.flush()

    session.add_all([
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
    ])
    await session.flush()

    session.add_all([
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
