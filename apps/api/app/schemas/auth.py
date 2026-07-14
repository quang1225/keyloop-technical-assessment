from pydantic import BaseModel

class DemoLoginOut(BaseModel):
    advisor_id: str
    name: str
