FROM python:3.12-slim

WORKDIR /app

# System deps for building any wheels that need compilation (e.g. asyncpg).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

RUN pip install --no-cache-dir .

EXPOSE 8000

# Overridden by docker-compose.yml for the `api` service (migrate then serve);
# kept here so the image is still directly runnable on its own.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
