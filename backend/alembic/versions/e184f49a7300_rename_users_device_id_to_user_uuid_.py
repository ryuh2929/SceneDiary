"""rename users.device_id to user_uuid + drop trip_days.symbol

Revision ID: e184f49a7300
Revises: d566d1945789
Create Date: 2026-05-28 17:17:17.687192

주의: autogenerate 가 RENAME 을 자동 감지하지 못해 ADD+DROP 으로 잡았던 것을
     데이터 보존 RENAME 으로 수동 교체했습니다. 인덱스도 PostgreSQL 의
     ALTER INDEX ... RENAME TO 로 이름만 바꿔 인덱스 재생성을 회피합니다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e184f49a7300'
down_revision: Union[str, Sequence[str], None] = 'd566d1945789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # trip_days.symbol 컬럼 삭제 (일차별 상징 이모지는 폐기, trips.flag 로 통일)
    op.drop_column('trip_days', 'symbol')

    # users.device_id → user_uuid 이름만 변경 (타입 String(100) 유지, 데이터 보존)
    op.alter_column('users', 'device_id', new_column_name='user_uuid')

    # 위 컬럼을 가리키는 인덱스 이름도 함께 변경 (PostgreSQL 의 ALTER INDEX 사용)
    op.execute('ALTER INDEX idx_users_device_id RENAME TO idx_users_user_uuid')


def downgrade() -> None:
    """Downgrade schema."""
    # 인덱스부터 되돌리기
    op.execute('ALTER INDEX idx_users_user_uuid RENAME TO idx_users_device_id')

    # 컬럼명 되돌리기
    op.alter_column('users', 'user_uuid', new_column_name='device_id')

    # 삭제했던 symbol 컬럼 복구 (코멘트 포함, 기존 데이터는 복구 불가능 → NULL)
    op.add_column(
        'trip_days',
        sa.Column(
            'symbol',
            sa.VARCHAR(length=50),
            autoincrement=False,
            nullable=True,
            comment='Twemoji codepoint (lowercase hex, multi-codepoint joined by -). e.g. 1f60a, 1f1f0-1f1f7',
        ),
    )
