from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+asyncpg://scheduler:scheduler@localhost:5432/scheduler"
    dealership_tz: str = "Europe/London"
    cors_origins: str = "http://localhost:5173"
    demo_advisor_id: str = "advisor-demo-1"
    demo_advisor_name: str = "Alex Morgan"
    # Fixed "now" for the demo/MVP: plan_booking() rejects starts <= now, and
    # the seed data lives on 2026-07-15, so a real wall clock would eventually
    # make every demo slot look like it's in the past. See app/services/loaders.py.
    demo_now: str = "2026-07-15T07:00:00"

settings = Settings()
