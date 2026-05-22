from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.users import User
from app.schemas.settings import SettingsProfile

router = APIRouter(prefix="/settings", tags=["settings"])

# DB에는 안정적인 코드값(poetic, daily 등)만 저장하고,
# 화면에 보여줄 라벨/설명은 API 응답을 만들 때 매핑합니다.
PERSONA_OPTIONS = {
    "poetic": {
        "label": "시적인",
        "description": "감성적이고 문학적인 표현",
    },
    "daily": {
        "label": "일상적",
        "description": "담백하고 자연스러운 표현",
    },
    "adventurous": {
        "label": "모험가",
        "description": "생동감 있고 활동적인 표현",
    },
    "romantic": {
        "label": "로맨틱",
        "description": "따뜻하고 감성적인 표현",
    },
}


def clean(value: object | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def persona_tags(selected_persona: str) -> list[dict[str, object]]:
    normalized = selected_persona.strip().lower()

    # 프론트는 tags 배열을 그대로 버튼 목록으로 렌더링합니다.
    # 따라서 항상 전체 페르소나 목록을 내려주고, DB 값과 일치하는 항목만 선택 상태로 표시합니다.
    return [
        {
            "id": persona_id,
            "label": option["label"],
            "description": option["description"],
            "selected": persona_id == normalized,
        }
        for persona_id, option in PERSONA_OPTIONS.items()
    ]


def to_settings_profile(user: User) -> SettingsProfile:
    writing_persona = clean(user.writing_persona).lower()
    selected_persona = PERSONA_OPTIONS.get(writing_persona)

    # 아이콘은 프론트에서 lucide-react-native 컴포넌트로 매핑할 수 있는 키만 내려줍니다.
    return SettingsProfile(
        nickname=clean(user.nickname) or "기록하는 여행자",
        persona={
            "title": "글 작성 페르소나",
            "description": selected_persona["description"]
            if selected_persona
            else "선택된 글 작성 페르소나가 없습니다.",
            "tags": persona_tags(writing_persona),
        },
        travelType={
            "id": "pending",
            "title": "분석 중",
            "description": "여행 유형 분석 데이터는 나중에 연결될 예정입니다.",
            "icon": "compass",
        },
        toggles=[
            {
                "id": "darkMode",
                "label": "다크 모드",
                "enabled": bool(user.dark_mode),
                "icon": "moon",
            },
            {
                "id": "pushNotification",
                "label": "푸시 알림",
                "enabled": bool(user.push_enabled),
                "icon": "bell",
            },
        ],
    )


@router.get("/profile", response_model=SettingsProfile)
def get_settings_profile(
    device_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> SettingsProfile:
    query = db.query(User)

    if device_id:
        user = query.filter(User.device_id == device_id).first()
    else:
        user = query.order_by(User.created_at.desc()).first()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return to_settings_profile(user)
