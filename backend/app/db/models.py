"""
DB 테이블 모델 정의.

각 클래스 = DB의 한 테이블에 대응합니다.
이 파일은 기존 DB 구조를 그대로 반영합니다.
(DB 변경 X, 코드만 맞춤)

모든 모델은 app.db.session 의 Base 를 상속받습니다.

== 테이블 관계 ==
users
  └── trips
        ├── (cover_photo_id) ─→ photos
        └── trip_days  (일기 내용 포함 — 구 diaries 합침)
              ├── diary_generations  (AI 생성 이력)
              └── photos
                    └── photo_generations  (AI 분석 이력)
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ─────────────────────────────────────────────────────────────
# users 테이블 - 사용자
# ─────────────────────────────────────────────────────────────
class User(Base):
    """사용자. 가입 없이 user_uuid (기기에서 생성한 UUID 문자열) 로 식별."""

    __tablename__ = "users"

    # user_uuid 조회 속도를 위한 인덱스 (DB의 idx_users_user_uuid 와 이름 일치)
    __table_args__ = (
        Index("idx_users_user_uuid", "user_uuid"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # 디바이스에서 생성·보관하는 식별자. UUID v4 형식 문자열을 받지만 컬럼 타입은
    # 호환성 유지를 위해 그대로 String(100) (옛 비-UUID 값도 살아있을 수 있음).
    user_uuid: Mapped[str] = mapped_column(String(100))

    # 프로필 (모두 선택값)
    nickname: Mapped[str | None] = mapped_column(String(50), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 신규 유저가 생성될 때 별도 선택값이 없으면 가장 기본적인 문체인 daily를 사용합니다.
    writing_persona: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        server_default=text("'daily'"),
    )
    # AI 가 사용자의 여행 패턴(사진·일기·일정)을 분석해 자연어 한 줄로 요약한 "여행 스타일".
    # 예: "도시 야경 위주의 감성형 탐험가". 미생성 시 NULL.
    travel_style_analysis: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 여행 유형 분석을 마지막으로 "요청"한 시각.
    # trip.status 가 completed 로 전환되어 백그라운드 분석이 시작될 때 기록됩니다.
    # 향후 throttle(연속 요청 방지) 또는 "마지막 분석" 표시 UX 에 활용.
    travel_style_analysis_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # 사용자 설정 (DB가 기본값 자동 입력)
    dark_mode: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    push_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))

    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )


# ─────────────────────────────────────────────────────────────
# trips 테이블 - 여행
# ─────────────────────────────────────────────────────────────
class Trip(Base):
    """여행. 사용자가 만드는 단위. 여행 안에 여러 trip_days 가 들어갑니다."""

    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # → users.id (DB에 FK 제약 없음. 주석만)
    user_id: Mapped[int] = mapped_column(BigInteger)

    title: Mapped[str] = mapped_column(String(200))
    destination: Mapped[str | None] = mapped_column(String(200), nullable=True)

    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)

    # → photos.id (대표 사진. 선택값)
    cover_photo_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # 여행 전체를 대표하는 국기 이모지 (Twemoji 코드포인트). trip 1개당 1개.
    # 국기 이모지는 두 코드포인트를 '-' 로 결합한 형태 (예: 1f1f0-1f1f7 = 🇰🇷).
    # 미설정 시 NULL.
    flag: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Twemoji codepoint for the trip's representative flag emoji. Multi-codepoint joined by '-', e.g. 1f1f0-1f1f7",
    )

    # 상태: 'draft'(생성 직후, DB 기본값) → 'completed'(최종 저장 시). 'published'는 미사용.
    status: Mapped[str] = mapped_column(String(20), server_default=text("'draft'"))

    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )
    # soft delete: NULL이면 살아있는 여행, 값 있으면 삭제 처리됨
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

# ─────────────────────────────────────────────────────────────
# trip_days 테이블 - 여행의 날짜별 정보
# ─────────────────────────────────────────────────────────────
class TripDay(Base):
    """여행의 하루 단위. 한 trip 은 여러 trip_day 를 가집니다."""

    __tablename__ = "trip_days"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # → trips.id
    trip_id: Mapped[int] = mapped_column(BigInteger)

    # 여행의 몇 번째 날인지 (1, 2, 3 ...)
    day_number: Mapped[int] = mapped_column(Integer)
    # 그 날의 실제 날짜
    date: Mapped[date] = mapped_column(Date)

    location_summary: Mapped[str | None] = mapped_column(String(200), nullable=True)
    weather: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 대표 좌표 (그 날의 대략적인 중심 위치)
    representative_lat: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    representative_lon: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)

    subtitle: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # 감정 태그 (Twemoji 코드포인트로 저장)
    emotion: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Twemoji codepoint (lowercase hex, multi-codepoint joined by -). e.g. 1f60a",
    )

    # ── 일기 내용 (구 diaries 테이블에서 합침) ──
    # 생성 전에는 비어 있을 수 있어 모두 nullable.
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # 일기 본문
    # (symbol 컬럼 제거됨: trips.flag 로 여행 단위 대표 이모지를 쓰는 방향으로 통일)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # AI 생성 완료 시각 (미생성이면 NULL)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # → photos.id (그날 대표 사진. 선택값. UI 하단 사진 바에서 고른 사진)
    represent_image: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp()
    )

    photos = relationship("Photo", back_populates="trip_day")



# (구 diaries 테이블은 trip_days 로 합쳐짐 — content/word_count/generated_at 참고. symbol 은 폐기됨.)


# ─────────────────────────────────────────────────────────────
# photos 테이블 - 사진
# ─────────────────────────────────────────────────────────────
class Photo(Base):
    """사진 한 장. trip_day 에 속함. EXIF·위치·썸네일 등 포함."""

    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # → trip_days.id (FK 제약 + ORM 관계는 클래스 아래쪽 trip_day 와 짝)
    trip_day_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("trip_days.id"))
    # → users.id (업로더)
    user_id: Mapped[int] = mapped_column(BigInteger)

    # ─ 파일 위치 ─
    file_url: Mapped[str] = mapped_column(String(500))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ─ 파일 메타데이터 ─
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ─ 위치 정보 (EXIF GPS 등) ─
    latitude: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    location_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # 역지오코딩으로 얻은 사진 단위 국가/도시명
    country_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    city_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # 외부 장소 ID (Google Places 등)
    place_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # 타임존 / UTC 오프셋
    tz: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
        comment="EXIF capture UTC offset string, e.g. +09:00 / +02:00 / -04:00. Local time = read photos_v.taken_at_local. Do NOT use 'AT TIME ZONE tz' directly (bare text offset sign is inverted in PostgreSQL).",
    )

    # 촬영 시각 — 유일하게 'timestamp with timezone'
    taken_at_utc: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Absolute instant the photo was taken (timestamptz, stored as UTC). Local time = taken_at_utc AT TIME ZONE tz",
    )

    # ─ 부가 정보 ─
    # 중복 체크용 해시 (SHA-256 등)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 전체 EXIF 데이터 (JSON 으로 통째로 저장)
    exif: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # 화면에 보여줄 정렬 순서
    display_order: Mapped[int] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime)
    # soft delete: NULL이면 살아있는 사진
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ORM 관계: photo.trip_day → 부모 TripDay 객체 (FK 컬럼은 위 trip_day_id)
    trip_day = relationship("TripDay", back_populates="photos")


# ─────────────────────────────────────────────────────────────
# diary_generations 테이블 - 일기 AI 생성 이력
# ─────────────────────────────────────────────────────────────
class DiaryGeneration(Base):
    """일기 AI 생성 시도 한 건. 비용/토큰/오류 추적용."""

    __tablename__ = "diary_generations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # → trip_days.id (합치기 후: 일기 = trip_day)
    trip_day_id: Mapped[int] = mapped_column(BigInteger)

    # 사용한 AI 모델명 (예: "gpt-4o")
    model_used: Mapped[str] = mapped_column(String(100))

    # 디버깅용 원본 데이터
    prompt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 비용 추적용
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 소요 시간 (밀리초)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 결과 상태: 'success', 'failure' 등
    status: Mapped[str] = mapped_column(String(20))
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime)


# ─────────────────────────────────────────────────────────────
# photo_generations 테이블 - 사진 AI 분석 이력
# ─────────────────────────────────────────────────────────────
class PhotoGeneration(Base):
    """사진 AI 분석 시도 한 건. VLM 의 분석 결과 기록."""

    __tablename__ = "photo_generations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # → photos.id
    photo_id: Mapped[int] = mapped_column(BigInteger)

    model_used: Mapped[str] = mapped_column(String(100))

    # 분석 결과: 자연어 설명
    analysis_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 분석 결과: 구조화된 JSON (객체 인식, 분위기, 색감 등)
    analysis_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # 자주 조회하는 VLM 구조화 결과
    place_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    indoor_outdoor: Mapped[str | None] = mapped_column(String(20), nullable=True)
    landmark_guess: Mapped[str | None] = mapped_column(String(200), nullable=True)
    landmark_confidence: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)
    people_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    people_importance: Mapped[str | None] = mapped_column(String(40), nullable=True)
    time_hint: Mapped[str | None] = mapped_column(String(40), nullable=True)
    time_confidence: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)

    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(20))

    created_at: Mapped[datetime] = mapped_column(DateTime)
