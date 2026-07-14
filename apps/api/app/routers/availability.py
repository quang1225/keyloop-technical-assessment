from __future__ import annotations

from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session as get_db
from app.deps import require_advisor
from app.domain.availability import find_slots
from app.models.entities import Vehicle
from app.schemas import AvailabilityOut
from app.services.loaders import build_availability_query

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=AvailabilityOut)
async def get_availability(
    vehicle_id: UUID = Query(...),
    service_type_id: UUID = Query(...),
    date: date_type = Query(..., description="Local (dealership timezone) calendar day"),
    bay_id: UUID | None = Query(default=None),
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
):
    vehicle = await session.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    try:
        availability = await build_availability_query(
            session,
            dealership_id=vehicle.dealership_id,
            service_type_id=service_type_id,
            day=date,
            preferred_bay_id=bay_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return AvailabilityOut(slots=find_slots(availability))
