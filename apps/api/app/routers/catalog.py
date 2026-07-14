from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session as get_db
from app.deps import require_advisor
from app.models.entities import ServiceBay, ServiceType, Technician, Vehicle
from app.schemas import BayOut, ServiceTypeOut, TechnicianOut, VehicleOut
from app.services.loaders import default_dealership_id

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/vehicles", response_model=list[VehicleOut])
async def list_vehicles(
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
):
    dealership_id = await default_dealership_id(session)
    result = await session.execute(
        select(Vehicle)
        .where(Vehicle.dealership_id == dealership_id)
        .options(selectinload(Vehicle.customer))
        .order_by(Vehicle.vin)
    )
    return result.scalars().all()


@router.get("/service-types", response_model=list[ServiceTypeOut])
async def list_service_types(
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
):
    dealership_id = await default_dealership_id(session)
    result = await session.execute(
        select(ServiceType).where(ServiceType.dealership_id == dealership_id).order_by(ServiceType.name)
    )
    return result.scalars().all()


@router.get("/bays", response_model=list[BayOut])
async def list_bays(
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
):
    dealership_id = await default_dealership_id(session)
    result = await session.execute(
        select(ServiceBay).where(ServiceBay.dealership_id == dealership_id).order_by(ServiceBay.name)
    )
    return result.scalars().all()


@router.get("/technicians", response_model=list[TechnicianOut])
async def list_technicians(
    advisor_id: str = Depends(require_advisor),
    session: AsyncSession = Depends(get_db),
):
    dealership_id = await default_dealership_id(session)
    result = await session.execute(
        select(Technician).where(Technician.dealership_id == dealership_id).order_by(Technician.full_name)
    )
    return result.scalars().all()
