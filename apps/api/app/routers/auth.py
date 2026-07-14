from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.schemas import DemoLoginOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/demo-login", response_model=DemoLoginOut)
async def demo_login() -> DemoLoginOut:
    """No auth required: hands back the single demo advisor identity."""
    return DemoLoginOut(advisor_id=settings.demo_advisor_id, name=settings.demo_advisor_name)
