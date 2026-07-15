from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session as get_db
from app.deps import require_advisor
from app.domain.booking import BookingConflictError, BookingRequest, BookingValidationError, plan_booking
from app.models.entities import Appointment, Vehicle
from app.schemas import AppointmentCreate, AppointmentOut
from app.services.loaders import CANCELLED_STATUS, build_availability_query, dealership_tz, demo_now

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
) -> Appointment:
    vehicle = await session.get(Vehicle, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    tz = dealership_tz()
    start = payload.start if payload.start.tzinfo else payload.start.replace(tzinfo=tz)
    local_day = start.astimezone(tz).date()

    # Re-check availability inside this transaction with row locks on
    # overlapping appointments. Same (bay, start) races are caught by the
    # unique constraint below; concurrent same-tech different-bay bookings
    # are an MVP limitation.
    try:
        availability = await build_availability_query(
            session,
            dealership_id=vehicle.dealership_id,
            service_type_id=payload.service_type_id,
            day=local_day,
            preferred_bay_id=payload.bay_id,
            lock_appointments=True,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    booking_request = BookingRequest(
        starts_at=start,
        duration_minutes=availability.duration_minutes,
        availability=availability,
        advisor_id=advisor_id,
    )

    try:
        result = plan_booking(booking_request, now=demo_now())
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc

    appointment = Appointment(
        dealership_id=vehicle.dealership_id,
        customer_id=vehicle.customer_id,
        vehicle_id=vehicle.id,
        service_type_id=payload.service_type_id,
        bay_id=UUID(result.bay_id),
        technician_id=UUID(result.technician_id),
        starts_at=result.starts_at,
        ends_at=result.ends_at,
        status="confirmed",
        created_by=result.created_by,
        created_at=demo_now(),
    )
    session.add(appointment)
    try:
        await session.commit()
    except IntegrityError as exc:
        # (bay_id, starts_at) unique constraint catches same-bay double-book races.
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot was just booked") from exc

    await session.refresh(appointment)
    return appointment


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: UUID,
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
) -> Appointment:
    _ = advisor_id
    appointment = await session.get(Appointment, appointment_id)
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    if appointment.status == CANCELLED_STATUS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Appointment already cancelled")

    appointment.status = CANCELLED_STATUS
    await session.commit()
    await session.refresh(appointment)
    return appointment
