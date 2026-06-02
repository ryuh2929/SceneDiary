"""사용자의 여행 기록을 바탕으로 여행 유형 분석을 수행하는 서비스입니다.

라우터는 "언제 실행할지"만 결정하고, 실제 분석 준비와 저장 책임은 이 파일에 모읍니다.
분석 결과는 users.travel_style_analysis 컬럼에 짧은 JSON 문자열로 저장합니다.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app.db.models import Photo, PhotoGeneration, Trip, User
from app.db.session import SessionLocal

TRAVEL_STYLE_MODEL = os.getenv("TRAVEL_STYLE_MODEL", "gpt-4.1-mini")
_TRAVEL_STYLE_ANALYSIS_STATUS: dict[int, dict[str, str | None]] = {}


def _set_analysis_status(user_id: int, status: str, message: str | None = None) -> None:
    # 현재는 DB 컬럼을 늘리지 않고, 서버 프로세스 메모리에 최근 분석 상태만 보관합니다.
    # 운영 단계에서 여러 서버 프로세스를 쓰게 되면 DB 컬럼이나 작업 큐 상태 저장소로 옮기는 것이 안전합니다.
    _TRAVEL_STYLE_ANALYSIS_STATUS[user_id] = {
        "status": status,
        "message": message,
    }


def get_travel_style_analysis_status(user_id: int) -> dict[str, str | None]:
    return _TRAVEL_STYLE_ANALYSIS_STATUS.get(
        user_id,
        {
            "status": "idle",
            "message": None,
        },
    )


def mark_travel_style_analysis_running(user_id: int) -> None:
    # 새 분석 요청을 받는 즉시 이전 실패/성공 상태를 running으로 덮어써서 프론트가 낡은 상태를 읽지 않게 합니다.
    _set_analysis_status(user_id, "running", None)

# 설정 화면에서 렌더링할 수 있는 lucide-react-native 아이콘 이름만 허용합니다.
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

SYSTEM_PROMPT = """당신은 여행 사진 분석 결과만 보고 사용자의 여행 성향을 짧게 정의하는 분석가입니다.
반드시 JSON만 반환하세요.
출력 형식:
{
  "title": "12자 이내의 여행자 유형",
  "description": "40~70자 정도의 자연스러운 한국어 1문장",
  "icon": "허용된 아이콘 이름 중 1개"
}

title은 재치 있지만 과장하지 말고, description은 설정 화면 카드에 들어갈 짧은 문장으로 작성하세요.
icon은 입력으로 제공된 allowed_icons 중 하나만 고르세요.
"""


def _latest_photo_generation(db: Session, photo_id: int) -> PhotoGeneration | None:
    # photos.id로 가장 최근에 성공한 사진 VLM 분석 결과(photo_generations)를 가져옵니다.
    # 여행 유형 분석에는 원본 이미지가 아니라, 이미 저장된 사진 분석 텍스트/JSON만 사용합니다.
    return (
        db.query(PhotoGeneration)
        .filter(PhotoGeneration.photo_id == photo_id, PhotoGeneration.status == "success")
        .order_by(PhotoGeneration.id.desc())
        .first()
    )


def _shorten(value: str | None, limit: int) -> str:
    text = (value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit].rstrip()}..."


def _collect_photo_payload(db: Session, photo: Photo) -> dict[str, Any] | None:
    # LLM에 넘길 "사진 한 장 단위" 입력 데이터입니다.
    # 여행 유형 분석은 글 작성 페르소나의 영향을 받지 않도록 photos와 photo_generations 정보만 사용합니다.
    generation = _latest_photo_generation(db, photo.id)
    if generation is None:
        return None

    return {
        "photo_id": photo.id,
        "location_name": photo.location_name or "",
        "taken_at_utc": photo.taken_at_utc.isoformat() if photo.taken_at_utc else "",
        "analysis_text": _shorten(generation.analysis_text, 180),
        "analysis_json": generation.analysis_json or {},
    }


def _collect_trip_payload(db: Session, trip: Trip) -> dict[str, Any]:
    # LLM에 넘길 "여행 단위" 입력 데이터입니다.
    # 어떤 사진이 어떤 여행에 속하는지 알 수 있도록 trip 아래에 photo 배열을 묶어 보냅니다.
    photos = (
        db.query(Photo)
        .join(Photo.trip_day)
        .filter(Photo.trip_day.has(trip_id=trip.id), Photo.deleted_at.is_(None))
        .order_by(Photo.display_order)
        .all()
    )

    photo_payloads = [
        payload for photo in photos if (payload := _collect_photo_payload(db, photo)) is not None
    ]

    return {
        "trip_id": trip.id,
        "photos": photo_payloads,
    }


def _collect_analysis_payload(db: Session, user: User) -> dict[str, Any]:
    # LLM에 실제로 전달되는 최종 입력 JSON을 만드는 함수입니다.
    # completed 상태의 최근 여행 5개에서 사진 위치/촬영시간/사진 분석 결과만 모읍니다.
    trips = (
        db.query(Trip)
        .filter(
            Trip.user_id == user.id,
            Trip.status == "completed",
            Trip.deleted_at.is_(None),
        )
        .order_by(Trip.start_date.desc(), Trip.id.desc())
        .limit(5)
        .all()
    )

    trip_payloads: list[dict[str, Any]] = []
    for trip in trips:
        trip_payload = _collect_trip_payload(db, trip)
        if trip_payload["photos"]:
            trip_payloads.append(trip_payload)

    return {
        # LLM이 프런트에서 표시 가능한 lucide 아이콘 이름만 고르도록 허용 목록을 함께 보냅니다.
        "allowed_icons": sorted(TRAVEL_STYLE_ICON_NAMES),
        "trips": trip_payloads,
    }


def _parse_json(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads((raw or "").strip())
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            return {}
        try:
            parsed = json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return {}

    return parsed if isinstance(parsed, dict) else {}


def _normalize_result(result: dict[str, Any]) -> dict[str, str]:
    title = _shorten(str(result.get("title") or "").strip(), 24)
    description = _shorten(str(result.get("description") or "").strip(), 90)
    icon = str(result.get("icon") or "").strip()

    if not title:
        title = "이름 없는 여행자"
    if not description:
        description = "아직 분석할 수 있는 여행 데이터가 없습니다."
    if icon not in TRAVEL_STYLE_ICON_NAMES:
        icon = "NotebookPen"

    return {
        "title": title,
        "description": description,
        "icon": icon,
    }


def _analyze_with_llm(payload: dict[str, Any]) -> dict[str, str]:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=TRAVEL_STYLE_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                # 여기서 DB에서 모은 photos + photo_generations 데이터만 LLM 입력으로 들어갑니다.
                "content": json.dumps(payload, ensure_ascii=False),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    content = response.choices[0].message.content or "{}"
    return _normalize_result(_parse_json(content))


def run_travel_style_analysis(user_id: int, *, force: bool = False) -> None:
    """사용자의 완료된 여행 기록을 LLM으로 분석해 여행 유형 JSON을 저장합니다.

    백그라운드 작업은 요청이 끝난 뒤 실행되므로, 요청에서 쓰던 DB 세션을 재사용하지 않고 새 세션을 엽니다.
    force가 False이면 이미 분석 결과가 있는 사용자는 중복 분석하지 않습니다.
    """
    db = SessionLocal()
    started = datetime.now(timezone.utc)
    _set_analysis_status(user_id, "running", None)

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            _set_analysis_status(user_id, "failed", "사용자 정보를 찾을 수 없어 여행 유형 분석을 진행하지 못했어요.")
            return

        if user.travel_style_analysis and not force:
            _set_analysis_status(user_id, "success", None)
            return

        payload = _collect_analysis_payload(db, user)
        if not payload["trips"]:
            _set_analysis_status(user_id, "failed", "분석할 여행 사진 데이터가 아직 없습니다.")
            return

        result = _analyze_with_llm(payload)
        user.travel_style_analysis = json.dumps(result, ensure_ascii=False)
        user.updated_at = started
        db.commit()
        _set_analysis_status(user_id, "success", None)
        print(f"[travel-style] done: user_id={user_id}, result={result['title']}")
    except Exception as exc:
        db.rollback()
        _set_analysis_status(user_id, "failed", "여행 유형 분석 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.")
        print(f"[travel-style] FAILED: user_id={user_id}: {exc}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()
