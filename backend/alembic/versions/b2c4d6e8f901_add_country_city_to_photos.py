"""add country and city name to photos

Revision ID: b2c4d6e8f901
Revises: c8e3a92f1b47
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c4d6e8f901"
down_revision: Union[str, Sequence[str], None] = "c8e3a92f1b47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("country_name", sa.String(length=120), nullable=True))
    op.add_column("photos", sa.Column("city_name", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("photos", "city_name")
    op.drop_column("photos", "country_name")
