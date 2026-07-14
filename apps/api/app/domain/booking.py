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
