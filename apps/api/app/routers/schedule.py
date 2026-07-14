from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session as get_db
from app.deps import require_advisor
from app.models.entities import Appointment
from app.schemas import ScheduleItemOut
from app.services.loaders import day_bounds, dealership_tz, default_dealership_id

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleItemOut])
async def get_schedule(
    date: date_type = Query(..., description="Local (dealership timezone) calendar day"),
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
):
    dealership_id = await default_dealership_id(session)
    day_start, day_end = day_bounds(date, dealership_tz())
    result = await session.execute(
        select(Appointment)
        .where(
            Appointment.dealership_id == dealership_id,
            Appointment.starts_at < day_end,
            Appointment.ends_at > day_start,
        )
        .order_by(Appointment.starts_at)
    )
    return result.scalars().all()
