from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

def _uuid() -> uuid.UUID:
    return uuid.uuid4()

class Dealership(Base):
    __tablename__ = "dealerships"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    vehicles: Mapped[list[Vehicle]] = relationship(back_populates="customer")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False)
    vin: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    customer: Mapped[Customer] = relationship(back_populates="vehicles")

class ServiceType(Base):
    __tablename__ = "service_types"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

class ServiceBay(Base):
    __tablename__ = "service_bays"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

class Technician(Base):
    __tablename__ = "technicians"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

class Appointment(Base):
    __tablename__ = "appointments"
    # Active bookings only — cancelled rows no longer block the bay/start slot.
    __table_args__ = (
        Index(
            "uq_bay_start_active",
            "bay_id",
            "starts_at",
            unique=True,
            postgresql_where=text("status <> 'cancelled'"),
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    dealership_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dealerships.id"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    service_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_types.id"), nullable=False)
    bay_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service_bays.id"), nullable=False)
    technician_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("technicians.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="confirmed")
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
