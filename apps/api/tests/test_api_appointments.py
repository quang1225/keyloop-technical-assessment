import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _demo_headers(client: AsyncClient) -> dict[str, str]:
    login = await client.post("/auth/demo-login")
    assert login.status_code == 200
    return {"X-Advisor-Id": login.json()["advisor_id"]}


@pytest.mark.asyncio
async def test_create_appointment_happy_path(seeded_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/auth/demo-login")
        assert login.status_code == 200
        advisor_id = login.json()["advisor_id"]
        headers = {"X-Advisor-Id": advisor_id}
        vehicles = (await client.get("/catalog/vehicles", headers=headers)).json()
        services = (await client.get("/catalog/service-types", headers=headers)).json()
        oil = next(s for s in services if s["name"] == "Oil Change")
        vehicle_id = vehicles[0]["id"]
        avail = await client.get(
            "/availability",
            params={"vehicle_id": vehicle_id, "service_type_id": oil["id"], "date": "2026-07-15"},
            headers=headers,
        )
        assert avail.status_code == 200
        slot = avail.json()["slots"][0]
        res = await client.post(
            "/appointments",
            headers=headers,
            json={"vehicle_id": vehicle_id, "service_type_id": oil["id"], "start": slot, "bay_id": None},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "confirmed"
        assert body["bay_id"]
        assert body["technician_id"]


@pytest.mark.asyncio
async def test_double_book_same_slot_returns_409(seeded_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = await _demo_headers(client)
        vehicles = (await client.get("/catalog/vehicles", headers=headers)).json()
        services = (await client.get("/catalog/service-types", headers=headers)).json()
        oil = next(s for s in services if s["name"] == "Oil Change")
        vehicle_id = vehicles[0]["id"]

        avail = await client.get(
            "/availability",
            params={"vehicle_id": vehicle_id, "service_type_id": oil["id"], "date": "2026-07-15"},
            headers=headers,
        )
        slot = avail.json()["slots"][0]
        payload = {"vehicle_id": vehicle_id, "service_type_id": oil["id"], "start": slot, "bay_id": None}

        first = await client.post("/appointments", headers=headers, json=payload)
        assert first.status_code == 201

        # Pin the second attempt to the same bay the first booking landed in,
        # so it collides on that specific (bay, time) slot regardless of how
        # many other bays/technicians are otherwise free at the same start.
        booked_bay_id = first.json()["bay_id"]
        second_payload = {**payload, "bay_id": booked_bay_id}
        second = await client.post("/appointments", headers=headers, json=second_payload)
        assert second.status_code == 409


@pytest.mark.asyncio
async def test_demo_login_requires_no_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/auth/demo-login")
        assert res.status_code == 200
        body = res.json()
        assert body["advisor_id"]
        assert body["name"]


@pytest.mark.asyncio
async def test_catalog_requires_advisor_header(seeded_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/catalog/vehicles")
        assert res.status_code == 401
