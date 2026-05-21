from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.users import User
from app.schemas.settings import SettingsProfile

router = APIRouter(prefix="/settings", tags=["settings"])


def clean(value: object | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def persona_tags(selected_persona: str) -> list[dict[str, object]]:
    defaults = [
        ("poetic", "\uc2dc\uc801"),
        ("daily", "\uc77c\uc0c1\uc801"),
        ("adventurous", "\ubaa8\ud5d8\uac00"),
        ("romantic", "\ub85c\ub9e8\ud2f1"),
    ]
    normalized = selected_persona.lower()
    tags = [
        {
            "id": tag_id,
            "label": label,
            "selected": normalized in {tag_id, label.lower()},
        }
        for tag_id, label in defaults
    ]

    if selected_persona and not any(tag["selected"] for tag in tags):
        tags.append(
            {
                "id": selected_persona,
                "label": selected_persona,
                "selected": True,
            }
        )

    return tags


def to_settings_profile(user: User) -> SettingsProfile:
    writing_persona = clean(user.writing_persona)

    # TODO: profile_image_url is available from users.profile_image_url.
    # Render it here after the default profile image is prepared and uploaded.
    return SettingsProfile(
        nickname=clean(user.nickname) or "\uae30\ub85d\ud558\ub294 \uc5ec\ud589\uc790",
        persona={
            "title": "\uae00 \uc791\uc131 \ud398\ub974\uc18c\ub098",
            "description": writing_persona
            or "\uc120\ud0dd\ub41c \uae00 \uc791\uc131 \ud398\ub974\uc18c\ub098\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
            "tags": persona_tags(writing_persona),
        },
        travelType={
            "id": "pending",
            "title": "\ubd84\uc11d \uc804",
            "description": "\uc5ec\ud589 \uc720\ud615 \ubd84\uc11d \ub370\uc774\ud130\ub294 \ub098\uc911\uc5d0 \uc5f0\uacb0\ud560 \uc608\uc815\uc785\ub2c8\ub2e4.",
            "icon": {
                "ios": "safari",
                "android": "explore",
                "web": "explore",
            },
        },
        toggles=[
            {
                "id": "darkMode",
                "label": "\ub2e4\ud06c \ubaa8\ub4dc",
                "enabled": bool(user.dark_mode),
                "icon": {
                    "ios": "moon",
                    "android": "dark_mode",
                    "web": "dark_mode",
                },
            },
            {
                "id": "pushNotification",
                "label": "\ud478\uc2dc \uc54c\ub9bc",
                "enabled": bool(user.push_enabled),
                "icon": {
                    "ios": "bell",
                    "android": "notifications",
                    "web": "notifications",
                },
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
