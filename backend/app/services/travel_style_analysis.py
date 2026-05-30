"""사용자의 여행 기록을 바탕으로 여행 유형 분석을 수행하는 서비스입니다.

라우터는 "언제 실행할지"만 결정하고, 실제 분석 준비와 저장 책임은 이 파일에 모읍니다.
분석 결과는 users.travel_style_analysis 컬럼에 짧은 JSON 문자열로 저장합니다.
"""

from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app.db.models import Photo, PhotoGeneration, Trip, TripDay, User
from app.db.session import SessionLocal

TRAVEL_STYLE_MODEL = os.getenv("TRAVEL_STYLE_MODEL", "gpt-4.1-mini")

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

SYSTEM_PROMPT = """당신은 여행 기록을 보고 사용자의 여행 성향을 짧게 정의하는 분석가입니다.
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


def _collect_day_payload(db: Session, trip_day: TripDay) -> dict[str, Any]:
    # LLM에 넘길 "하루 단위" 입력 데이터입니다.
    # trip_days의 일기 본문/장소/감정 정보와 photos/photo_generations의 사진 분석 요약을 합칩니다.
    photos = (
        db.query(Photo)
        .filter(Photo.trip_day_id == trip_day.id, Photo.deleted_at.is_(None))
        .order_by(Photo.display_order)
        .all()
    )

    photo_descriptions: list[str] = []
    photo_objects: list[str] = []
    photo_moods: list[str] = []

    for photo in photos:
        generation = _latest_photo_generation(db, photo.id)
        if generation is None:
            continue

        # analysis_text: 사진 한 장을 자연어 한 줄로 요약한 값입니다.
        # 너무 길어지지 않게 잘라서 하루당 최대 5개만 LLM 입력에 포함합니다.
        if generation.analysis_text:
            photo_descriptions.append(_shorten(generation.analysis_text, 120))

        # analysis_json: 사진에서 보이는 주요 객체(objects), 분위기(mood) 같은 구조화 결과입니다.
        # 여행 성향을 판단하기 좋은 키워드만 뽑아서 아래에서 빈도순으로 압축합니다.
        analysis_json = generation.analysis_json or {}
        if isinstance(analysis_json, dict):
            objects = analysis_json.get("objects") or []
            if isinstance(objects, list):
                photo_objects.extend(str(item) for item in objects[:5])

            mood = analysis_json.get("mood")
            if mood:
                photo_moods.append(str(mood))

    # 사진마다 반복되는 객체/분위기를 세어 성향 분석 입력을 짧게 압축합니다.
    common_objects = [item for item, _ in Counter(photo_objects).most_common(8)]
    common_moods = [item for item, _ in Counter(photo_moods).most_common(5)]

    return {
        "day_number": trip_day.day_number,
        "date": trip_day.date.isoformat(),
        "location_summary": trip_day.location_summary or "",
        "diary_subtitle": trip_day.subtitle or "",
        "diary_content": _shorten(trip_day.content, 500),
        "weather": trip_day.weather or "",
        "emotion": trip_day.emotion or "",
        "photo_count": len(photos),
        "photo_keywords": common_objects,
        "photo_moods": common_moods,
        "photo_descriptions": photo_descriptions[:5],
    }


def _collect_analysis_payload(db: Session, user: User) -> dict[str, Any]:
    # LLM에 실제로 전달되는 최종 입력 JSON을 만드는 함수입니다.
    # completed 상태의 최근 여행 5개만 사용해서 비용과 입력 길이를 제한합니다.
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
        # 각 여행 안에서는 일기 생성이 완료되어 content가 있는 일차만 분석에 사용합니다.
        # 한 여행이 너무 길어도 입력이 커지지 않도록 최대 10일차까지만 포함합니다.
        trip_days = (
            db.query(TripDay)
            .filter(TripDay.trip_id == trip.id, TripDay.content.isnot(None))
            .order_by(TripDay.day_number)
            .limit(10)
            .all()
        )

        trip_payloads.append(
            {
                "title": trip.title,
                "destination": trip.destination or "",
                "start_date": trip.start_date.isoformat(),
                "end_date": trip.end_date.isoformat(),
                "days": [_collect_day_payload(db, trip_day) for trip_day in trip_days],
            }
        )

    return {
        # 사용자 기본 정보는 문체/닉네임 참고용입니다. 민감하거나 분석에 불필요한 설정값은 넣지 않습니다.
        "user": {
            "nickname": user.nickname or "",
            "writing_persona": user.writing_persona,
        },
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
        description = "아직 여행 기록이 많지 않아 가능성을 넓게 품고 있는 타입입니다."
    if icon not in TRAVEL_STYLE_ICON_NAMES:
        icon = "NotebookPen"

    return {
        "title": title,
        "description": description,
        "icon": icon,
    }


def _analyze_with_llm(payload: dict[str, Any]) -> dict[str, str]:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=TRAVEL_STYLE_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                # 여기서 DB에서 모은 여행/일차/사진 분석 데이터가 LLM 입력으로 들어갑니다.
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

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return

        if user.travel_style_analysis and not force:
            return

        payload = _collect_analysis_payload(db, user)
        if not payload["trips"]:
            return

        result = _analyze_with_llm(payload)
        user.travel_style_analysis = json.dumps(result, ensure_ascii=False)
        user.updated_at = started
        db.commit()
        print(f"[travel-style] done: user_id={user_id}, result={result['title']}")
    except Exception as exc:
        db.rollback()
        print(f"[travel-style] FAILED: user_id={user_id}: {exc}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()
