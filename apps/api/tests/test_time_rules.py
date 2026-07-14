from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from app.domain.time_rules import (
    is_working_day,
    iter_candidate_starts,
    interval_within_working_hours,
    overlaps,
)

TZ = ZoneInfo("Europe/London")

def test_weekend_not_working_day():
    assert is_working_day(date(2026, 7, 18)) is False  # Saturday
    assert is_working_day(date(2026, 7, 15)) is True   # Wednesday

def test_candidate_starts_30_min_grid():
    starts = list(iter_candidate_starts(date(2026, 7, 15), duration_minutes=60, tz=TZ))
    assert starts[0] == datetime(2026, 7, 15, 8, 0, tzinfo=TZ)
    assert starts[-1] == datetime(2026, 7, 15, 16, 0, tzinfo=TZ)  # 16:00–17:00
    assert all((s.minute in (0, 30)) for s in starts)

def test_interval_must_end_by_close():
    start = datetime(2026, 7, 15, 16, 30, tzinfo=TZ)
    assert interval_within_working_hours(start, 60, TZ) is False
    assert interval_within_working_hours(start, 30, TZ) is True

def test_overlaps():
    a0 = datetime(2026, 7, 15, 9, 0, tzinfo=TZ)
    a1 = a0 + timedelta(hours=1)
    b0 = datetime(2026, 7, 15, 9, 30, tzinfo=TZ)
    b1 = b0 + timedelta(hours=1)
    assert overlaps(a0, a1, b0, b1) is True
    assert overlaps(a0, a1, a1, a1 + timedelta(hours=1)) is False
