"""add total tokens to photo_generations

Revision ID: d4e6f8a0b123
Revises: c3d5e7f9a102
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e6f8a0b123"
down_revision: Union[str, Sequence[str], None] = "c3d5e7f9a102"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photo_generations", sa.Column("total_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("photo_generations", "total_tokens")
