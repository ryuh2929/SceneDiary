"""add vlm summary columns to photo_generations

Revision ID: c3d5e7f9a102
Revises: b2c4d6e8f901
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d5e7f9a102"
down_revision: Union[str, Sequence[str], None] = "b2c4d6e8f901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photo_generations", sa.Column("place_type", sa.String(length=40), nullable=True))
    op.add_column("photo_generations", sa.Column("indoor_outdoor", sa.String(length=20), nullable=True))
    op.add_column("photo_generations", sa.Column("landmark_guess", sa.String(length=200), nullable=True))
    op.add_column("photo_generations", sa.Column("landmark_confidence", sa.Numeric(4, 3), nullable=True))
    op.add_column("photo_generations", sa.Column("people_type", sa.String(length=40), nullable=True))
    op.add_column("photo_generations", sa.Column("people_importance", sa.String(length=40), nullable=True))
    op.add_column("photo_generations", sa.Column("time_hint", sa.String(length=40), nullable=True))
    op.add_column("photo_generations", sa.Column("time_confidence", sa.Numeric(4, 3), nullable=True))


def downgrade() -> None:
    op.drop_column("photo_generations", "time_confidence")
    op.drop_column("photo_generations", "time_hint")
    op.drop_column("photo_generations", "people_importance")
    op.drop_column("photo_generations", "people_type")
    op.drop_column("photo_generations", "landmark_confidence")
    op.drop_column("photo_generations", "landmark_guess")
    op.drop_column("photo_generations", "indoor_outdoor")
    op.drop_column("photo_generations", "place_type")
