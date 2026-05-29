import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User
from app.schemas.settings import (
    SettingsProfile,
    UpdateNicknameRequest,
    UpdateSettingsToggleRequest,
    UpdateWritingPersonaRequest,
)

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

DEFAULT_TRAVEL_STYLE_ANALYSIS = {
    "title": "분석 중",
    "description": "아직 분석할 수 있는 여행 데이터가 없습니다",
    "icon": "NotebookPen",
}
# DB에 저장된 travel_style_analysis.icon 값이 프런트에서 렌더링 가능한 아이콘인지 검증하는 허용 목록입니다.
TRAVEL_STYLE_ICON_NAMES = {
    "Flower2",
    "Camera",
    "Compass",
    "Trees",
    "TreePalm",
    "TentTree",
    "Binoculars",
    "FlameKindling",
    "PartyPopper",
    "Martini",
    "Beer",
    "BottleWine",
    "Wine",
    "Hamburger",
    "Sandwich",
    "Utensils",
    "TicketsPlane",
    "Map",
    "Helicopter",
    "Ship",
    "CarFront",
    "Amphora",
    "Landmark",
    "FerrisWheel",
    "RollerCoaster",
    "Mountain",
    "Coffee",
    "Building",
    "Castle",
    "Hotel",
    "House",
    "Sailboat",
    "FishingHook",
    "Fish",
    "IceCreamBowl",
    "Soup",
    "CookingPot",
    "Cookie",
    "Dog",
    "Snail",
    "Squirrel",
    "Turtle",
    "Bird",
    "Bug",
    "Origami",
    "Footprints",
    "Rose",
    "Baby",
    "CircleDollarSign",
    "Snowflake",
    "Sun",
    "NotebookPen",
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


def travel_style_analysis(user: User) -> dict[str, str]:
    # travel_style_analysis는 DB에 JSON 문자열로 저장될 예정입니다.
    # 아직 분석 결과가 없어서 NULL이거나, 파싱할 수 없는 값이면 화면 표시용 fallback을 내려줍니다.
    raw_analysis = clean(user.travel_style_analysis)

    if not raw_analysis:
        return DEFAULT_TRAVEL_STYLE_ANALYSIS

    try:
        parsed_analysis = json.loads(raw_analysis)
    except json.JSONDecodeError:
        return DEFAULT_TRAVEL_STYLE_ANALYSIS

    if not isinstance(parsed_analysis, dict):
        return DEFAULT_TRAVEL_STYLE_ANALYSIS

    icon = clean(parsed_analysis.get("icon"))

    return {
        "title": clean(parsed_analysis.get("title")) or DEFAULT_TRAVEL_STYLE_ANALYSIS["title"],
        "description": clean(parsed_analysis.get("description"))
        or DEFAULT_TRAVEL_STYLE_ANALYSIS["description"],
        "icon": icon if icon in TRAVEL_STYLE_ICON_NAMES else DEFAULT_TRAVEL_STYLE_ANALYSIS["icon"],
    }


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
        travelType=travel_style_analysis(user),
        toggles=[
            {
                "id": "darkMode",
                "label": "다크 모드",
                "enabled": bool(user.dark_mode),
            },
            {
                "id": "pushNotification",
                "label": "푸시 알림",
                "enabled": bool(user.push_enabled),
            },
        ],
    )


def find_user_or_404(db: Session, user_uuid: str | None) -> User:
    # 프런트에서 넘긴 user_uuid가 있으면 해당 기기의 유저를 우선 찾습니다.
    # 아직 user_uuid 연결 전인 임시 화면 확인을 위해 값이 없을 때만 최신 유저를 fallback으로 사용합니다.
    query = db.query(User)

    if user_uuid:
        user = query.filter(User.user_uuid == user_uuid).first()
    else:
        user = query.order_by(User.created_at.desc()).first()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.get("/profile", response_model=SettingsProfile)
def get_settings_profile(
    user_uuid: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> SettingsProfile:
    user = find_user_or_404(db, user_uuid)

    return to_settings_profile(user)


@router.patch("/persona", response_model=SettingsProfile)
def update_writing_persona(
    payload: UpdateWritingPersonaRequest,
    user_uuid: str = Query(...),
    db: Session = Depends(get_db),
) -> SettingsProfile:
    # 프런트가 보내는 값은 반드시 PERSONA_OPTIONS에 등록된 id만 허용합니다.
    # 잘못된 값이 DB에 들어가면 이후 버튼 선택 상태를 맞출 수 없어서 여기서 차단합니다.
    persona_id = payload.persona_id.strip().lower()

    if persona_id not in PERSONA_OPTIONS:
        raise HTTPException(status_code=400, detail="Unknown writing persona")

    user = find_user_or_404(db, user_uuid)
    user.writing_persona = persona_id
    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    return to_settings_profile(user)


@router.patch("/toggle", response_model=SettingsProfile)
def update_settings_toggle(
    payload: UpdateSettingsToggleRequest,
    user_uuid: str = Query(...),
    db: Session = Depends(get_db),
) -> SettingsProfile:
    user = find_user_or_404(db, user_uuid)

    # 프런트에서 쓰는 토글 id를 실제 users 테이블 컬럼에 연결합니다.
    # UI 이름이 바뀌어도 DB 컬럼명은 이 매핑만 수정하면 됩니다.
    if payload.toggle_id == "darkMode":
        user.dark_mode = payload.enabled
    elif payload.toggle_id == "pushNotification":
        user.push_enabled = payload.enabled

    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    return to_settings_profile(user)


@router.patch("/nickname", response_model=SettingsProfile)
def update_nickname(
    payload: UpdateNicknameRequest,
    user_uuid: str = Query(...),
    db: Session = Depends(get_db),
) -> SettingsProfile:
    nickname = payload.nickname.strip()

    # 빈 닉네임이나 지나치게 긴 닉네임은 DB에 저장하지 않습니다.
    # 현재 users.nickname 컬럼은 VARCHAR(50)이므로 프런트 제한보다 넉넉하게 50자로 검증합니다.
    if not nickname:
        raise HTTPException(status_code=400, detail="Nickname is required")

    if len(nickname) > 50:
        raise HTTPException(status_code=400, detail="Nickname is too long")

    user = find_user_or_404(db, user_uuid)
    user.nickname = nickname
    user.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    return to_settings_profile(user)
