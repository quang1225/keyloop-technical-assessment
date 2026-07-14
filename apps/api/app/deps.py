from fastapi import Header, HTTPException, status
from app.config import settings
from app.db import get_session as get_db

async def require_advisor(x_advisor_id: str | None = Header(default=None)) -> str:
    if x_advisor_id != settings.demo_advisor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in as demo advisor required")
    return x_advisor_id
