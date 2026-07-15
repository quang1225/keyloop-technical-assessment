"""partial unique index for active appointments

Revision ID: a1b2c3d4e5f6
Revises: c75604e2599e
Create Date: 2026-07-15 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "c75604e2599e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_bay_start", "appointments", type_="unique")
    op.create_index(
        "uq_bay_start_active",
        "appointments",
        ["bay_id", "starts_at"],
        unique=True,
        postgresql_where="status <> 'cancelled'",
    )


def downgrade() -> None:
    op.drop_index("uq_bay_start_active", table_name="appointments")
    op.create_unique_constraint("uq_bay_start", "appointments", ["bay_id", "starts_at"])
