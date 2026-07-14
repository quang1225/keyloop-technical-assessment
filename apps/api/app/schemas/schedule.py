from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class ScheduleItemOut(BaseModel):
    id: UUID
    vehicle_id: UUID
    service_type_id: UUID
    bay_id: UUID
    technician_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: str
    model_config = ConfigDict(from_attributes=True)
