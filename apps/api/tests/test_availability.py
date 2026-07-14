from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from app.domain.availability import (
    AvailabilityQuery, BusyInterval, TechInfo, find_slots, first_assignment,
)

TZ = ZoneInfo("Europe/London")
DAY = date(2026, 7, 15)

def _q(**kwargs):
    base = dict(
        day=DAY,
        duration_minutes=60,
        required_skills=frozenset({"brakes"}),
        bay_ids=["bay-1", "bay-2"],
        technicians=[
            TechInfo("tech-brake", frozenset({"brakes", "general"})),
            TechInfo("tech-general", frozenset({"general"})),
        ],
        bay_busy=[],
        tech_busy=[],
        tz=TZ,
    )
    base.update(kwargs)
    return AvailabilityQuery(**base)

def test_empty_day_has_morning_slot():
    slots = find_slots(_q())
    assert datetime(2026, 7, 15, 8, 0, tzinfo=TZ) in slots

def test_skill_mismatch_yields_no_slots():
    assert find_slots(_q(required_skills=frozenset({"ev"}))) == []

def test_bay_busy_blocks_slot():
    start = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    q = _q(bay_ids=["bay-1"], bay_busy=[BusyInterval("bay-1", start, start + timedelta(hours=1))])
    assert start not in find_slots(q)

def test_preferred_bay_used_in_assignment():
    start = datetime(2026, 7, 15, 10, 0, tzinfo=TZ)
    opt = first_assignment(_q(preferred_bay_id="bay-2"), start)
    assert opt is not None
    assert opt.bay_id == "bay-2"
