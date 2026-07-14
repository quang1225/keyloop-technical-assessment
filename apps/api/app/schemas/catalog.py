from uuid import UUID
from pydantic import BaseModel, ConfigDict

class CustomerBrief(BaseModel):
    id: UUID
    full_name: str
    email: str
    model_config = ConfigDict(from_attributes=True)

class VehicleOut(BaseModel):
    id: UUID
    vin: str
    make: str
    model: str
    customer: CustomerBrief
    model_config = ConfigDict(from_attributes=True)

class ServiceTypeOut(BaseModel):
    id: UUID
    name: str
    duration_minutes: int
    required_skills: list[str]
    model_config = ConfigDict(from_attributes=True)

class BayOut(BaseModel):
    id: UUID
    name: str
    model_config = ConfigDict(from_attributes=True)

class TechnicianOut(BaseModel):
    id: UUID
    full_name: str
    skills: list[str]
    model_config = ConfigDict(from_attributes=True)
