from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class AppointmentCreate(BaseModel):
    vehicle_id: UUID
    service_type_id: UUID
    start: datetime
    bay_id: UUID | None = None

class AppointmentOut(BaseModel):
    id: UUID
    customer_id: UUID
    vehicle_id: UUID
    service_type_id: UUID
    bay_id: UUID
    technician_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: str
    created_by: str
    model_config = ConfigDict(from_attributes=True)
