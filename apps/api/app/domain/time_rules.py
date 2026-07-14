from __future__ import annotations
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

WORK_START = time(8, 0)
WORK_END = time(17, 0)
SLOT_MINUTES = 30

def is_working_day(d: date) -> bool:
    return d.weekday() < 5  # Mon–Fri

def work_window(d: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(d, WORK_START, tzinfo=tz)
    end = datetime.combine(d, WORK_END, tzinfo=tz)
    return start, end

def interval_within_working_hours(start: datetime, duration_minutes: int, tz: ZoneInfo) -> bool:
    if start.tzinfo is None:
        raise ValueError("start must be timezone-aware")
    d = start.astimezone(tz).date()
    if not is_working_day(d):
        return False
    day_start, day_end = work_window(d, tz)
    end = start + timedelta(minutes=duration_minutes)
    return day_start <= start < end <= day_end

def iter_candidate_starts(d: date, duration_minutes: int, tz: ZoneInfo):
    if not is_working_day(d):
        return
    day_start, _ = work_window(d, tz)
    cursor = day_start
    while interval_within_working_hours(cursor, duration_minutes, tz):
        yield cursor
        cursor += timedelta(minutes=SLOT_MINUTES)

def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end

def is_on_grid(start: datetime, tz: ZoneInfo) -> bool:
    local = start.astimezone(tz)
    return local.minute in (0, 30) and local.second == 0 and local.microsecond == 0
