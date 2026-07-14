from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from app.domain.availability import AvailabilityQuery, BusyInterval, TechInfo
from app.domain.booking import BookingConflictError, BookingRequest, BookingValidationError, plan_booking

TZ = ZoneInfo("Europe/London")
NOW = datetime(2026, 7, 15, 7, 0, tzinfo=TZ)

def _avail(**kwargs):
    base = dict(
        day=date(2026, 7, 15),
        duration_minutes=60,
        required_skills=frozenset({"general"}),
        bay_ids=["bay-1"],
        technicians=[TechInfo("tech-1", frozenset({"general"}))],
        bay_busy=[],
        tech_busy=[],
        tz=TZ,
    )
    base.update(kwargs)
    return AvailabilityQuery(**base)

def test_happy_path_assigns_bay_and_tech():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    result = plan_booking(
        BookingRequest(start, 60, _avail(), "advisor-demo-1"),
        now=NOW,
    )
    assert result.bay_id == "bay-1"
    assert result.technician_id == "tech-1"
    assert result.ends_at == start + timedelta(hours=1)

def test_conflict_when_busy():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    avail = _avail(bay_busy=[BusyInterval("bay-1", start, start + timedelta(hours=1))])
    with pytest.raises(BookingConflictError):
        plan_booking(BookingRequest(start, 60, avail, "advisor-demo-1"), now=NOW)

def test_rejects_past():
    start = datetime(2026, 7, 15, 6, 0, tzinfo=TZ)
    with pytest.raises(BookingValidationError):
        plan_booking(BookingRequest(start, 60, _avail(), "advisor-demo-1"), now=NOW)
