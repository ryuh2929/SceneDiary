from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.schemas.users import EnsureUserRequest, EnsureUserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/ensure", response_model=EnsureUserResponse)
def ensure_user(
    payload: EnsureUserRequest,
    db: Session = Depends(get_db),
) -> EnsureUserResponse:
    # 앱 시작 시 프런트가 보낸 user_uuid로 기존 유저를 찾고, 없으면 기본 설정값으로 새 유저를 만듭니다.
    print("user ID 번호 호출 시도")
    user_uuid = payload.user_uuid.strip()

    if not user_uuid:
        raise HTTPException(status_code=400, detail="user_uuid is required")

    user = db.query(User).filter(User.user_uuid == user_uuid).first()

    if user is not None:
        return EnsureUserResponse(id=user.id, user_uuid=user.user_uuid, created=False)

    now = datetime.now()
    user = User(
        user_uuid=user_uuid,
        writing_persona="daily",
        dark_mode=False,
        push_enabled=True,
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return EnsureUserResponse(id=user.id, user_uuid=user.user_uuid, created=True)
