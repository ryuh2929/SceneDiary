from __future__ import annotations

import asyncio
import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import DiaryGeneration, Photo, Trip, TripDay
from app.db.session import get_db
from app.routers.diary import _abs_url, _base_url, _gen_status, _run_generation
from app.services.image_processor import extract_image_gps_coordinates, extract_image_taken_date, process_upload_image
from app.utils.country_flags import country_to_flag


# add.tsx -> loading.tsx 흐름에서 사용하는 업로드/생성 API입니다.
# DB 스키마는 변경하지 않고 기존 trips, trip_days, photos, diary_generations를 사용합니다.
router = APIRouter(tags=["upload"])

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_TEST_IMAGES_ROOT = _BACKEND_DIR / "test_images"
_ANALYSIS_PUBLIC_ROOT = "test_images/test_images_korea"
_THUMBNAIL_PUBLIC_ROOT = "test_images/test_images_korea_thumbs"
_ANALYSIS_ROOT = _TEST_IMAGES_ROOT / "test_images_korea"
_THUMBNAIL_ROOT = _TEST_IMAGES_ROOT / "test_images_korea_thumbs"
_MODEL_NAME = os.getenv("DIARY_MODEL", "gemma4:e4b")
MAX_UPLOAD_PHOTOS_PER_DAY = 8
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
IMAGE_PROCESSING_CONCURRENCY = 3

LoadingStep = Literal[
    "uploading",
    "resizing_images",
    "creating_thumbnails",
    "analyzing_metadata",
    "analyzing_photos",
    "generating_diary",
    "completed",
    "failed",
]


COUNTRY_FLAG_MAP = {
    # 아시아
    '대한민국': '1f1f0-1f1f7', 'South Korea': '1f1f0-1f1f7',
    '중국': '1f1e8-1f1f3', 'China': '1f1e8-1f1f3',
    '일본': '1f1ef-1f1f5', 'Japan': '1f1ef-1f1f5',
    '대만': '1f1f9-1f1fc', 'Taiwan': '1f1f9-1f1fc',
    '홍콩': '1f1ed-1f1f0', 'Hong Kong': '1f1ed-1f1f0',
    '태국': '1f1f0-1f1ed', 'Thailand': '1f1f0-1f1ed',
    '베트남': '1f1fb-1f1f3', 'Vietnam': '1f1fb-1f1f3',
    '필리핀': '1f1f5-1f1ed', 'Philippines': '1f1f5-1f1ed',
    '싱가포르': '1f1f8-1f1ec', 'Singapore': '1f1f8-1f1ec',
    '말레이시아': '1f1f2-1f1fe', 'Malaysia': '1f1f2-1f1fe',
    '인도네시아': '1f1ee-1f1e9', 'Indonesia': '1f1ee-1f1e9',
    '몽골': '1f1f2-1f1f3', 'Mongolia': '1f1f2-1f1f3',

    # 유럽
    '프랑스': '1f1eb-1f1f7', 'France': '1f1eb-1f1f7',
    '영국': '1f1ec-1f1e7', 'United Kingdom': '1f1ec-1f1e7', 'UK': '1f1ec-1f1e7',
    '독일': '1f1e9-1f1ea', 'Germany': '1f1e9-1f1ea',
    '이탈리아': '1f1ee-1f1f9', 'Italy': '1f1ee-1f1f9',
    '스페인': '1f1ea-1f1f8', 'Spain': '1f1ea-1f1f8',
    '스위스': '1f1e8-1f1ed', 'Switzerland': '1f1e8-1f1ed',
    '네덜란드': '1f1f3-1f1f1', 'Netherlands': '1f1f3-1f1f1',
    '오스트리아': '1f1e6-1f1f9', 'Austria': '1f1e6-1f1f9',
    '체코': '1f1e4-1f1ff', 'Czech Republic': '1f1e4-1f1ff',
    '포르투갈': '1f1f5-1f1f9', 'Portugal': '1f1f5-1f1f9',

    # 아메리카 / 오세아니아
    '미국': '1f1fa-1f1f8', 'USA': '1f1fa-1f1f8', 'United States': '1f1fa-1f1f8',
    '캐나다': '1f1e8-1f1e6', 'Canada': '1f1e8-1f1e6',
    '호주': '1f1e6-1f1fa', 'Australia': '1f1e6-1f1fa',
    '뉴질랜드': '1f1f3-1f1ff', 'New Zealand': '1f1f3-1f1ff',
    '괌': '1f1ec-1f1fa', 'Guam': '1f1ec-1f1fa',
    '사이판': '1f1f2-1f1f5', 'Saipan': '1f1f2-1f1f5',
}


class UploadedPhoto(BaseModel):
    id: int
    thumbnailUrl: str
    fileUrl: str
    originalFilename: str | None
    fileSizeBytes: int | None
    mimeType: str | None
    width: int | None
    height: int | None
    displayOrder: int


class UploadedDay(BaseModel):
    tripDayId: int
    day: int
    date: str
    photos: list[UploadedPhoto]


class FirstDayUploadResponse(BaseModel):
    tripId: int
    tripDayId: int
    day: int
    status: LoadingStep
    photos: list[UploadedPhoto]
    days: list[UploadedDay]


class GenerationStartResponse(BaseModel):
    tripId: int
    tripDayId: int
    day: int
    status: LoadingStep
    progress: int


class GenerationStatusResponse(BaseModel):
    tripId: int
    tripDayId: int
    day: int
    status: LoadingStep
    progress: int
    errorMessage: str | None = None


@dataclass(frozen=True)
class UploadDraft:
    raw_bytes: bytes
    original_filename: str | None
    content_type: str | None
    photo_date: date
    latitude: Decimal | None
    longitude: Decimal | None
    # 프론트(add.tsx)가 OS 지오코딩으로 미리 변환해 보낸 지명들.
    # place_name : 일차 대표 지명 후보 (예: "신주쿠")
    # country_name + city_name : trip.destination "국가/도시" 의 구성요소
    place_name: str | None = None
    country_name: str | None = None
    city_name: str | None = None
    exif: dict | None = None
    tz: str | None = None
    taken_at_utc: datetime | None = None


def _parse_upload_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_filename_date(filename: str | None) -> date | None:
    if not filename:
        return None

    match = re.search(r"(20\d{2})[-_. ]?(\d{2})[-_. ]?(\d{2})", filename)
    if not match:
        return None

    try:
        return date(
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3)),
        )
    except ValueError:
        return None


def _get_or_create_trip(
    db: Session,
    *,
    trip_id: int | None,
    user_id: int,
    title: str,
    destination: str | None,
    trip_date: date,
) -> Trip:
    now = datetime.now()
    if trip_id is not None:
        trip = db.query(Trip).filter(Trip.id == trip_id, Trip.deleted_at.is_(None)).first()
        if trip is None:
            raise HTTPException(status_code=404, detail="Trip not found")
        return trip

    trip = Trip(
        user_id=user_id,
        title=title,
        destination=destination,
        start_date=trip_date,
        end_date=trip_date,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    db.add(trip)
    db.flush()
    return trip


def _next_day_number(db: Session, trip_id: int) -> int:
    max_day = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip_id)
        .order_by(TripDay.day_number.desc())
        .first()
    )
    return (max_day.day_number if max_day else 0) + 1


def _get_or_create_trip_day_for_date(
    db: Session,
    *,
    trip: Trip,
    trip_date: date,
    preferred_day_number: int | None = None,
) -> TripDay:
    # 같은 촬영일의 사진은 같은 trip_day로 묶습니다. 이미 해당 날짜가 있으면 재사용합니다.
    trip_day = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip.id, TripDay.date == trip_date)
        .first()
    )
    if trip_day is not None:
        return trip_day

    day_number = preferred_day_number or _next_day_number(db, trip.id)
    day_number_exists = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip.id, TripDay.day_number == day_number)
        .first()
    )
    if day_number_exists is not None:
        day_number = _next_day_number(db, trip.id)

    now = datetime.now()
    trip_day = TripDay(
        trip_id=trip.id,
        day_number=day_number,
        date=trip_date,
        created_at=now,
        updated_at=now,
    )
    db.add(trip_day)
    db.flush()
    return trip_day


def _renumber_trip_days_by_date(db: Session, trip_id: int) -> None:
    trip_days = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip_id)
        .order_by(TripDay.date, TripDay.id)
        .all()
    )
    for day_number, trip_day in enumerate(trip_days, start=1):
        trip_day.day_number = day_number


def _generation_progress(status: str) -> tuple[LoadingStep, int, str | None]:
    if status == "ready":
        return "completed", 100, None
    if status == "failed":
        return "failed", 100, "일기 생성에 실패했어요."
    return "generating_diary", 72, None


def _decimal_coordinate(value: float) -> Decimal:
    return Decimal(str(round(value, 8)))


def _refresh_trip_day_representative_coordinates(db: Session, trip_day: TripDay) -> None:
    # 지도 마커가 쓸 수 있도록 해당 일차의 GPS 사진 좌표 평균을 대표 좌표로 저장합니다.
    photos_with_gps = (
        db.query(Photo)
        .filter(
            Photo.trip_day_id == trip_day.id,
            Photo.deleted_at.is_(None),
            Photo.latitude.isnot(None),
            Photo.longitude.isnot(None),
        )
        .all()
    )

    if not photos_with_gps:
        trip_day.representative_lat = None
        trip_day.representative_lon = None
        return

    lat_sum = sum(Decimal(photo.latitude) for photo in photos_with_gps)
    lon_sum = sum(Decimal(photo.longitude) for photo in photos_with_gps)
    photo_count = Decimal(len(photos_with_gps))
    trip_day.representative_lat = lat_sum / photo_count
    trip_day.representative_lon = lon_sum / photo_count


def _parse_form_coordinate(values: list[str] | None, index: int) -> Decimal | None:
    # 프론트가 리사이즈 전에 추출해서 보낸 GPS 좌표를 파싱합니다. 빈 문자열이면 None으로 처리합니다.
    if not values or index >= len(values):
        return None
    raw = values[index].strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    return _decimal_coordinate(value)


def _parse_form_exif(values: list[str] | None, index: int) -> dict | None:
    if not values or index >= len(values):
        return None
    raw = values[index].strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _normalize_exif_tz(value: object) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if raw.upper() == "Z":
        return "+00:00"

    match = re.match(r"^([+-])(\d{1,2})(?::?(\d{2}))?$", raw)
    if match:
        sign, hours_raw, minutes_raw = match.groups()
        hours = int(hours_raw)
        minutes = int(minutes_raw or "0")
        if hours <= 14 and minutes < 60:
            return f"{sign}{hours:02d}:{minutes:02d}"

    try:
        hours_float = float(raw)
    except ValueError:
        return None
    if -12 <= hours_float <= 14:
        sign = "+" if hours_float >= 0 else "-"
        total_minutes = int(round(abs(hours_float) * 60))
        return f"{sign}{total_minutes // 60:02d}:{total_minutes % 60:02d}"
    return None


def _parse_exif_local_datetime(value: object) -> datetime | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    match = re.search(
        r"(20\d{2})[:/-](\d{2})[:/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})",
        raw,
    )
    if not match:
        return None
    year, month, day, hour, minute, second = map(int, match.groups())
    try:
        return datetime(year, month, day, hour, minute, second)
    except ValueError:
        return None


def _extract_exif_capture_time(exif: dict | None) -> tuple[str | None, datetime | None]:
    if not exif:
        return None, None

    tz = _normalize_exif_tz(
        exif.get("OffsetTimeOriginal")
        or exif.get("OffsetTime")
        or exif.get("TimeZoneOffset")
    )
    local_dt = (
        _parse_exif_local_datetime(exif.get("DateTimeOriginal"))
        or _parse_exif_local_datetime(exif.get("DateTimeDigitized"))
        or _parse_exif_local_datetime(exif.get("DateTime"))
    )
    if not tz or not local_dt:
        return tz, None

    sign = 1 if tz[0] == "+" else -1
    hours = int(tz[1:3])
    minutes = int(tz[4:6])
    offset = timezone(sign * timedelta(hours=hours, minutes=minutes))
    taken_at_utc = local_dt.replace(tzinfo=offset).astimezone(timezone.utc)
    return tz, taken_at_utc


def _valid_coordinates(latitude: Decimal, longitude: Decimal) -> bool:
    return (
        Decimal("-90") <= latitude <= Decimal("90")
        and Decimal("-180") <= longitude <= Decimal("180")
        and not (latitude == 0 and longitude == 0)
    )


@router.post("/trips/upload-first-day", response_model=FirstDayUploadResponse)
async def upload_first_day_photos(
    request: Request,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    photo_dates: list[str] | None = Form(None),
    photo_gps_latitudes: list[str] | None = Form(None),
    photo_gps_longitudes: list[str] | None = Form(None),
    # 프론트가 OS 지오코딩으로 미리 변환한 지명. 위치 권한이 없거나 GPS 가 없으면 빈 문자열.
    photo_place_names: list[str] | None = Form(None),
    photo_country_names: list[str] | None = Form(None),
    photo_city_names: list[str] | None = Form(None),
    photo_exifs: list[str] | None = Form(None),
    user_id: int = Form(1),
    trip_id: int | None = Form(None),
    day_number: int = Form(1),
    trip_date: date | None = Form(None),
    title: str = Form("새 여행"),
    destination: str | None = Form(None),
    db: Session = Depends(get_db),
) -> FirstDayUploadResponse:
    # 사진 업로드 API.
    # EXIF 촬영일이 있으면 날짜별로 trip_day를 나누고, 없으면 요청 날짜를 fallback으로 씁니다.
    # GPS는 프론트가 리사이즈 전에 추출해서 form으로 보낸 값을 우선 사용하고, 없으면 raw_bytes에서 fallback합니다.
    print("업로드 시작")
    print(f"DEBUG: 프론트에서 넘어온 국가 리스트: {photo_country_names}")
    print(f"DEBUG: 프론트에서 넘어온 도시 리스트: {photo_city_names}")
    if not files:
        raise HTTPException(status_code=400, detail="At least one photo is required")
    if day_number < 1:
        raise HTTPException(status_code=400, detail="day_number must be greater than 0")
    fallback_date = trip_date or date.today()
    drafts: list[UploadDraft] = []
    photo_id_list = []
    
    for index, upload_file in enumerate(files):
        if upload_file.content_type and not upload_file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{upload_file.filename} is not an image")

        raw_bytes = await upload_file.read()
        if len(raw_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail=f"{upload_file.filename} is larger than 12MB")
        form_photo_date = _parse_upload_date(photo_dates[index] if photo_dates and index < len(photo_dates) else None)
        print("프론트에서 받은 LAT:",photo_gps_latitudes)
        print("프론트에서 받은 LON:",photo_gps_longitudes)
        form_lat = _parse_form_coordinate(photo_gps_latitudes, index)
        form_lon = _parse_form_coordinate(photo_gps_longitudes, index)
        if form_lat is not None and form_lon is not None and _valid_coordinates(form_lat, form_lon):
            latitude, longitude = form_lat, form_lon
        else:
            gps = extract_image_gps_coordinates(raw_bytes)
            latitude = _decimal_coordinate(gps.latitude) if gps else None
            longitude = _decimal_coordinate(gps.longitude) if gps else None
            print("LAT:",latitude,"LON:",longitude)

        # 지명 form 필드는 같은 index 로 photo 와 매칭. 빈 문자열은 None 으로 정규화.
        def _form_str_at(values: list[str] | None, idx: int) -> str | None:
            if not values or idx >= len(values):
                return None
            raw = values[idx].strip()
            return raw or None
        print(f"DEBUG: 현재 인덱스: {index}")
        print(f"DEBUG: photo_country_names 리스트 상태: {photo_country_names}")
        print(f"DEBUG: photo_city_names 리스트 상태: {photo_city_names}")
        print(f"DEBUG: 추출된 country_name: {_form_str_at(photo_country_names, index)}")

        exif = _parse_form_exif(photo_exifs, index)
        tz, taken_at_utc = _extract_exif_capture_time(exif)

        drafts.append(
            UploadDraft(
                raw_bytes=raw_bytes,
                original_filename=upload_file.filename,
                content_type=upload_file.content_type,
                photo_date=(
                    form_photo_date
                    or extract_image_taken_date(raw_bytes)
                    or _parse_filename_date(upload_file.filename)
                    or fallback_date
                ),
                latitude=latitude,
                longitude=longitude,
                place_name=_form_str_at(photo_place_names, index),
                country_name=_form_str_at(photo_country_names, index),
                city_name=_form_str_at(photo_city_names, index),
                exif=exif,
                tz=tz,
                taken_at_utc=taken_at_utc,
            )
        )

    photo_taken_dates = sorted({draft.photo_date for draft in drafts})
    effective_start = photo_taken_dates[0]
    effective_end = photo_taken_dates[-1]
    trip = _get_or_create_trip(
        db,
        trip_id=trip_id,
        user_id=user_id,
        title=title,
        destination=destination,
        trip_date=effective_start,
    )
    if trip.start_date > effective_start:
        trip.start_date = effective_start
    if trip.end_date < effective_end:
        trip.end_date = effective_end

    trip_days_by_date = {
        grouped_date: _get_or_create_trip_day_for_date(
            db,
            trip=trip,
            trip_date=grouped_date,
            preferred_day_number=day_number + index,
        )
        for index, grouped_date in enumerate(photo_taken_dates)
    }
    _renumber_trip_days_by_date(db, trip.id)
    
    base = _base_url(request)
    uploaded: list[UploadedPhoto] = []
    uploaded_by_day_id: dict[int, list[UploadedPhoto]] = {}
    drafts_by_date = {
        grouped_date: [draft for draft in drafts if draft.photo_date == grouped_date]
        for grouped_date in photo_taken_dates
    }
    print("장소")
    for grouped_date, grouped_drafts in drafts_by_date.items():
        trip_day = trip_days_by_date[grouped_date]
        existing_count = (
            db.query(Photo)
            .filter(Photo.trip_day_id == trip_day.id, Photo.deleted_at.is_(None))
            .count()
        )
        # 업로드 요청 전체가 아니라 촬영일로 나뉜 일차별 사진 수만 제한합니다.
        if existing_count + len(grouped_drafts) > MAX_UPLOAD_PHOTOS_PER_DAY:
            raise HTTPException(
                status_code=400,
                detail=f"Photos are limited to {MAX_UPLOAD_PHOTOS_PER_DAY} per day",
            )

        uploaded_by_day_id[trip_day.id] = []
        processing_items = [
            (index, draft, existing_count + index)
            for index, draft in enumerate(grouped_drafts)
        ]

        # 이미지 파일 저장/리사이즈만 3장씩 병렬 처리하고, DB 저장은 아래에서 순서대로 진행합니다.
        for batch_start in range(0, len(processing_items), IMAGE_PROCESSING_CONCURRENCY):
            batch = processing_items[batch_start:batch_start + IMAGE_PROCESSING_CONCURRENCY]
            try:
                processed_batch = await asyncio.gather(
                    *(
                        asyncio.to_thread(
                            process_upload_image,
                            raw_bytes=draft.raw_bytes,
                            original_filename=draft.original_filename,
                            analysis_root=_ANALYSIS_ROOT,
                            thumbnail_root=_THUMBNAIL_ROOT,
                            analysis_public_root=_ANALYSIS_PUBLIC_ROOT,
                            thumbnail_public_root=_THUMBNAIL_PUBLIC_ROOT,
                            trip_id=trip.id,
                            day_number=trip_day.day_number,
                            trip_date=trip_day.date,
                            display_order=display_order,
                        )
                        for _, draft, display_order in batch
                    )
                )
            except Exception as exc:
                failed_filename = next((draft.original_filename for _, draft, _ in batch), None)
                raise HTTPException(
                    status_code=400,
                    detail=f"Image processing failed: {failed_filename}",
                ) from exc

            for (_, draft, display_order), processed in zip(batch, processed_batch):
                photo = Photo(
                    trip_day_id=trip_day.id,
                    user_id=user_id,
                    file_url=processed.file_url,
                    thumbnail_url=processed.thumbnail_url,
                    original_filename=draft.original_filename,
                    file_size_bytes=processed.file_size_bytes,
                    mime_type=processed.mime_type,
                    width=processed.width,
                    height=processed.height,
                    latitude=draft.latitude,
                    longitude=draft.longitude,
                    exif=draft.exif,
                    tz=draft.tz,
                    taken_at_utc=draft.taken_at_utc,
                    # 프론트가 미리 변환해 보낸 지명. 권한 없거나 GPS 없으면 None.
                    location_name=draft.place_name,
                    country_name=draft.country_name,
                    city_name=draft.city_name,
                    display_order=display_order,
                    created_at=datetime.now(),
                )
                db.add(photo)
                db.flush()
                new_photo = {"img_id": photo.id, "file_url": photo.file_url}

                photo_id_list.append(new_photo)
                if trip.cover_photo_id is None:
                    trip.cover_photo_id = photo.id
                if trip_day.represent_image is None:
                    trip_day.represent_image = photo.id

                uploaded_photo = UploadedPhoto(
                    id=photo.id,
                    thumbnailUrl=_abs_url(base, photo.thumbnail_url),
                    fileUrl=_abs_url(base, photo.file_url),
                    originalFilename=photo.original_filename,
                    fileSizeBytes=photo.file_size_bytes,
                    mimeType=photo.mime_type,
                    width=photo.width,
                    height=photo.height,
                    displayOrder=photo.display_order,
                )
                uploaded.append(uploaded_photo)
                uploaded_by_day_id[trip_day.id].append(uploaded_photo)

        _refresh_trip_day_representative_coordinates(db, trip_day)
        # 일차 대표 지명: 그날 사진들의 placeName 중 가장 빈도 높은 값.
        # 이미 값이 있으면 덮어쓰지 않음(이전 업로드/사용자 picker 편집 보존).
        print("사진 포토 번호, url:",photo_id_list)
        print('위치 정보 조회 시작')
        if not trip_day.location_summary:
            place_candidates = [d.place_name for d in grouped_drafts if d.place_name]
            
            if place_candidates:
                trip_day.location_summary = Counter(place_candidates).most_common(1)[0][0]
                print(trip_day.location_summary)
                
                

    generation_jobs: list[tuple[int, int]] = []
    for trip_day in trip_days_by_date.values():
        running = (
            db.query(DiaryGeneration)
            .filter(DiaryGeneration.trip_day_id == trip_day.id, DiaryGeneration.status == "running")
            .order_by(DiaryGeneration.id.desc())
            .first()
        )
        if running is not None:
            continue

        gen = DiaryGeneration(
            trip_day_id=trip_day.id,
            model_used=_MODEL_NAME,
            status="running",
            created_at=datetime.now(),
        )
        db.add(gen)
        db.flush()
        generation_jobs.append((trip_day.id, gen.id))

    # trip.destination 자동 설정: "가장 처음 방문한" 사진 = 촬영일이 가장 빠른 사진의 국가/도시.
    # 이미 값이 있으면 덮어쓰지 않음(다른 화면에서 사용자가 직접 입력한 경우 보존).
    if not trip.destination:
        first_draft = next(
            (d for d in sorted(drafts, key=lambda x: x.photo_date) if d.country_name and d.city_name),
            None,
        )
        if first_draft:
            trip.destination = f"{first_draft.country_name}/{first_draft.city_name}"
            trip.flag = country_to_flag(first_draft.country_name)
            print(f"{first_draft.country_name}의 코드: {trip.flag}")

    db.commit()
    print("AI가 사진 분석 하기2")
    
    # 제목을 만들기
            
    if False and trip is not None and (not trip.title or trip.title == "새 여행"):
        from app.services.diary_generator import write_trip_title

        all_days = (
            db.query(TripDay)
            .filter(TripDay.trip_id == trip.id)
            .order_by(TripDay.day_number)
            .all()
        )
        days_payload = [
            {
                "subtitle": d.subtitle or "",
                # 너무 길면 토큰 낭비. 앞 200자만 발췌해 분위기 전달.
                "content_excerpt": (d.content or "")[:200],
            }
            for d in all_days
        ]
        title_dict = write_trip_title(days_payload, destination=trip.destination or "", path_list=None,photo_info=photo_id_list)
        if title_dict:
            generated_title = (title_dict.get("title") or "").strip()
            generated_img_id = title_dict.get("img_id")
            if generated_title:
                trip.title = generated_title
            if generated_img_id:
                try:
                    trip.cover_photo_id = int(generated_img_id)
                except (TypeError, ValueError):
                    pass
            db.commit()
            print(f"[trip-title] generated: trip={trip.id} title={trip.title}")
    
    # 일차 데이터 api호출
    for trip_day_id, gen_id in generation_jobs:
        background_tasks.add_task(_run_generation, trip_day_id, gen_id)

    first_trip_day = trip_days_by_date[photo_taken_dates[0]]
    return FirstDayUploadResponse(
        tripId=trip.id,
        tripDayId=first_trip_day.id,
        day=first_trip_day.day_number,
        status="creating_thumbnails",
        photos=uploaded,
        days=[
            UploadedDay(
                tripDayId=trip_days_by_date[grouped_date].id,
                day=trip_days_by_date[grouped_date].day_number,
                date=grouped_date.isoformat(),
                photos=uploaded_by_day_id[trip_days_by_date[grouped_date].id],
            )
            for grouped_date in photo_taken_dates
        ],
    )


@router.post("/trip-days/{trip_day_id}/generate", response_model=GenerationStartResponse)
def start_trip_day_generation(
    trip_day_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GenerationStartResponse:
    # 수동 재시작이나 이전 클라이언트 호환을 위해 남겨둔 생성 시작 API.
    # 현재 업로드 흐름은 upload_first_day_photos에서 생성을 시작하므로 로딩 화면은 이 API를 호출하지 않습니다.
    # 삭제 여부는 다른 호출자가 없는지 확인한 뒤 팀에서 결정합니다.
    # 실제 VLM/LLM 처리는 diary.py의 백그라운드 생성 로직을 재사용합니다.
    trip_day = db.query(TripDay).filter(TripDay.id == trip_day_id).first()
    if trip_day is None:
        raise HTTPException(status_code=404, detail="TripDay not found")

    running = (
        db.query(DiaryGeneration)
        .filter(DiaryGeneration.trip_day_id == trip_day_id, DiaryGeneration.status == "running")
        .order_by(DiaryGeneration.id.desc())
        .first()
    )
    if running is not None:
        return GenerationStartResponse(
            tripId=trip_day.trip_id,
            tripDayId=trip_day.id,
            day=trip_day.day_number,
            status="generating_diary",
            progress=72,
        )

    gen = DiaryGeneration(
        trip_day_id=trip_day.id,
        model_used=_MODEL_NAME,
        status="running",
        created_at=datetime.now(),
    )
    db.add(gen)
    db.commit()
    print("AI가 사진 분석 하기1")
    background_tasks.add_task(_run_generation, trip_day.id, gen.id)

    return GenerationStartResponse(
        tripId=trip_day.trip_id,
        tripDayId=trip_day.id,
        day=trip_day.day_number,
        status="analyzing_photos",
        progress=58,
    )


@router.get("/trip-days/{trip_day_id}/generation-status", response_model=GenerationStatusResponse)
def get_trip_day_generation_status(
    trip_day_id: int,
    db: Session = Depends(get_db),
) -> GenerationStatusResponse:
    # 로딩 화면 폴링용 API.
    # status/progress는 화면 표시용 응답값이며, 최종 성공/실패 판단은 diary_generations 상태를 사용합니다.
    trip_day = db.query(TripDay).filter(TripDay.id == trip_day_id).first()
    if trip_day is None:
        raise HTTPException(status_code=404, detail="TripDay not found")

    status, progress, fallback_error = _generation_progress(_gen_status(db, trip_day))
    latest = (
        db.query(DiaryGeneration)
        .filter(DiaryGeneration.trip_day_id == trip_day_id)
        .order_by(DiaryGeneration.id.desc())
        .first()
    )

    return GenerationStatusResponse(
        tripId=trip_day.trip_id,
        tripDayId=trip_day.id,
        day=trip_day.day_number,
        status=status,
        progress=progress,
        errorMessage=(latest.error_message if latest and latest.status == "failure" else fallback_error),
    )
