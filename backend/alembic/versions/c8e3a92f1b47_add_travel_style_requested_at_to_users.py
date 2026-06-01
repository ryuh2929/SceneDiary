"""add travel_style_analysis_requested_at to users

여행 유형 분석을 마지막으로 "요청"한 시각을 기록하는 컬럼.
trips.status 가 completed 로 전환되어 백그라운드 분석이 시작될 때 채워집니다.
(향후 throttle 또는 "마지막 분석 시점" 표시에 활용)

Revision ID: c8e3a92f1b47
Revises: e184f49a7300
Create Date: 2026-06-01 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8e3a92f1b47'
down_revision: Union[str, Sequence[str], None] = 'e184f49a7300'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('travel_style_analysis_requested_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'travel_style_analysis_requested_at')
