from __future__ import annotations
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from app.domain.time_rules import iter_candidate_starts, overlaps

@dataclass(frozen=True)
class BusyInterval:
    resource_id: str
    starts_at: datetime
    ends_at: datetime

@dataclass(frozen=True)
class TechInfo:
    id: str
    skills: frozenset[str]

@dataclass(frozen=True)
class AvailabilityQuery:
    day: date
    duration_minutes: int
    required_skills: frozenset[str]
    bay_ids: list[str]
    technicians: list[TechInfo]
    bay_busy: list[BusyInterval]
    tech_busy: list[BusyInterval]
    tz: ZoneInfo
    preferred_bay_id: str | None = None

@dataclass(frozen=True)
class SlotOption:
    starts_at: datetime
    bay_id: str
    technician_id: str

def _is_free(resource_id: str, start: datetime, end: datetime, busy: list[BusyInterval]) -> bool:
    for b in busy:
        if b.resource_id == resource_id and overlaps(start, end, b.starts_at, b.ends_at):
            return False
    return True

def qualified_technicians(required: frozenset[str], techs: list[TechInfo]) -> list[TechInfo]:
    return [t for t in techs if required <= t.skills]

def find_slots(q: AvailabilityQuery) -> list[datetime]:
    """Return distinct start times that have at least one feasible (bay, tech) pair."""
    pairs = find_slot_assignments(q)
    seen: list[datetime] = []
    for p in pairs:
        if not seen or seen[-1] != p.starts_at:
            if p.starts_at not in seen:
                seen.append(p.starts_at)
    return sorted(set(seen))

def find_slot_assignments(q: AvailabilityQuery) -> list[SlotOption]:
    techs = qualified_technicians(q.required_skills, q.technicians)
    if not techs:
        return []
    bay_ids = [q.preferred_bay_id] if q.preferred_bay_id else q.bay_ids
    if q.preferred_bay_id and q.preferred_bay_id not in q.bay_ids:
        return []
    out: list[SlotOption] = []
    for start in iter_candidate_starts(q.day, q.duration_minutes, q.tz):
        end = start + timedelta(minutes=q.duration_minutes)
        assigned = False
        for bay_id in bay_ids:
            if not _is_free(bay_id, start, end, q.bay_busy):
                continue
            for tech in techs:
                if _is_free(tech.id, start, end, q.tech_busy):
                    out.append(SlotOption(starts_at=start, bay_id=bay_id, technician_id=tech.id))
                    assigned = True
                    break
            if assigned:
                break
    return out

def first_assignment(q: AvailabilityQuery, starts_at: datetime) -> SlotOption | None:
    for opt in find_slot_assignments(q):
        if opt.starts_at == starts_at:
            return opt
    return None
