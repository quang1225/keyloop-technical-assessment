from datetime import datetime
from pydantic import BaseModel

class AvailabilityOut(BaseModel):
    slots: list[datetime]
