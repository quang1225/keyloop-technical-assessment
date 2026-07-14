"""Build domain query objects (AvailabilityQuery) from the ORM."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.domain.availability import AvailabilityQuery, BusyInterval, TechInfo
from app.models.entities import Appointment, Dealership, ServiceBay, ServiceType, Technician

CANCELLED_STATUS = "cancelled"


def dealership_tz() -> ZoneInfo:
    return ZoneInfo(settings.dealership_tz)


def demo_now() -> datetime:
    """Fixed "current time" used for booking validation in this demo/MVP.

    plan_booking() rejects appointments starting at or before `now`. Real
    wall-clock time would make the 2026-07-15 seed data (and this take-home's
    fixed test dates) drift into the past, so we freeze `now` via
    settings.demo_now instead. A production build would pass
    datetime.now(tz) here.
    """
    naive = datetime.fromisoformat(settings.demo_now)
    return naive.replace(tzinfo=dealership_tz())


def day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """Full calendar-day window [start, end) in the given timezone."""
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start, start + timedelta(days=1)


async def default_dealership_id(session: AsyncSession) -> UUID:
    """This is a single-dealership demo, so there is exactly one to load."""
    dealership_id = await session.scalar(select(Dealership.id).limit(1))
    if dealership_id is None:
        raise LookupError("No dealership configured; run the seed script")
    return dealership_id


async def build_availability_query(
    session: AsyncSession,
    *,
    dealership_id: UUID,
    service_type_id: UUID,
    day: date,
    preferred_bay_id: UUID | None = None,
    lock_appointments: bool = False,
) -> AvailabilityQuery:
    """Assemble an AvailabilityQuery from current DB state for one day.

    Set lock_appointments=True when calling this immediately before a booking
    insert inside a transaction, to take row locks on the overlapping
    appointments and serialize concurrent booking attempts for the same day.
    """
    tz = dealership_tz()

    service_type = await session.get(ServiceType, service_type_id)
    if service_type is None or service_type.dealership_id != dealership_id:
        raise LookupError("Service type not found")

    bays = (
        await session.execute(select(ServiceBay).where(ServiceBay.dealership_id == dealership_id))
    ).scalars().all()
    bay_ids = [str(bay.id) for bay in bays]

    if preferred_bay_id is not None and str(preferred_bay_id) not in bay_ids:
        raise LookupError("Bay not found")

    technicians = (
        await session.execute(select(Technician).where(Technician.dealership_id == dealership_id))
    ).scalars().all()
    tech_infos = [TechInfo(str(tech.id), frozenset(tech.skills)) for tech in technicians]

    day_start, day_end = day_bounds(day, tz)
    stmt = select(Appointment).where(
        Appointment.dealership_id == dealership_id,
        Appointment.status != CANCELLED_STATUS,
        Appointment.starts_at < day_end,
        Appointment.ends_at > day_start,
    )
    if lock_appointments:
        stmt = stmt.with_for_update()
    appointments = (await session.execute(stmt)).scalars().all()

    bay_busy = [BusyInterval(str(a.bay_id), a.starts_at, a.ends_at) for a in appointments]
    tech_busy = [BusyInterval(str(a.technician_id), a.starts_at, a.ends_at) for a in appointments]

    return AvailabilityQuery(
        day=day,
        duration_minutes=service_type.duration_minutes,
        required_skills=frozenset(service_type.required_skills),
        bay_ids=bay_ids,
        technicians=tech_infos,
        bay_busy=bay_busy,
        tech_busy=tech_busy,
        tz=tz,
        preferred_bay_id=str(preferred_bay_id) if preferred_bay_id else None,
    )
