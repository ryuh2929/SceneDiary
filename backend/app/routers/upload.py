from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import DiaryGeneration, Photo, Trip, TripDay
from app.db.session import get_db
from app.routers.diary import _abs_url, _base_url, _gen_status, _run_generation
from app.services.image_processor import extract_image_taken_date, process_upload_image


# add.tsx -> loading.tsx 흐름에서 사용하는 업로드/생성 API입니다.
# DB 스키마는 변경하지 않고 기존 trips, trip_days, photos, diary_generations를 사용합니다.
# 실제 앱 노출을 위해서는 main.py에서 이 router 등록과 /uploads 정적 서빙 연결이 필요합니다.
router = APIRouter(tags=["upload"])

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_UPLOAD_PUBLIC_ROOT = "uploads"
_UPLOAD_ROOT = _BACKEND_DIR / _UPLOAD_PUBLIC_ROOT
_MODEL_NAME = os.getenv("DIARY_MODEL", "gemma4:e4b")
MAX_UPLOAD_PHOTOS = 10

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


def _parse_upload_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
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


def _generation_progress(status: str) -> tuple[LoadingStep, int, str | None]:
    if status == "ready":
        return "completed", 100, None
    if status == "failed":
        return "failed", 100, "일기 생성에 실패했어요."
    return "generating_diary", 72, None


@router.post("/trips/upload-first-day", response_model=FirstDayUploadResponse)
async def upload_first_day_photos(
    request: Request,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    photo_dates: list[str] | None = Form(None),
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
    if not files:
        raise HTTPException(status_code=400, detail="At least one photo is required")
    if len(files) > MAX_UPLOAD_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Photos are limited to {MAX_UPLOAD_PHOTOS}")
    if day_number < 1:
        raise HTTPException(status_code=400, detail="day_number must be greater than 0")

    fallback_date = trip_date or date.today()
    drafts: list[UploadDraft] = []
    for index, upload_file in enumerate(files):
        if upload_file.content_type and not upload_file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{upload_file.filename} is not an image")

        raw_bytes = await upload_file.read()
        form_photo_date = _parse_upload_date(photo_dates[index] if photo_dates and index < len(photo_dates) else None)
        drafts.append(
            UploadDraft(
                raw_bytes=raw_bytes,
                original_filename=upload_file.filename,
                content_type=upload_file.content_type,
                photo_date=form_photo_date or extract_image_taken_date(raw_bytes) or fallback_date,
            )
        )

    sorted_dates = sorted({draft.photo_date for draft in drafts})
    effective_start = sorted_dates[0]
    effective_end = sorted_dates[-1]
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
            preferred_day_number=day_number + index if trip_id is None else None,
        )
        for index, grouped_date in enumerate(sorted_dates)
    }

    base = _base_url(request)
    uploaded: list[UploadedPhoto] = []
    uploaded_by_day_id: dict[int, list[UploadedPhoto]] = {}
    drafts_by_date = {
        grouped_date: [draft for draft in drafts if draft.photo_date == grouped_date]
        for grouped_date in sorted_dates
    }

    for grouped_date, grouped_drafts in drafts_by_date.items():
        trip_day = trip_days_by_date[grouped_date]
        existing_count = (
            db.query(Photo)
            .filter(Photo.trip_day_id == trip_day.id, Photo.deleted_at.is_(None))
            .count()
        )
        if existing_count + len(grouped_drafts) > MAX_UPLOAD_PHOTOS:
            raise HTTPException(status_code=400, detail=f"Photos are limited to {MAX_UPLOAD_PHOTOS} per day")

        uploaded_by_day_id[trip_day.id] = []
        for index, draft in enumerate(grouped_drafts):
            display_order = existing_count + index
            try:
                processed = process_upload_image(
                    raw_bytes=draft.raw_bytes,
                    original_filename=draft.original_filename,
                    upload_root=_UPLOAD_ROOT,
                    public_root=_UPLOAD_PUBLIC_ROOT,
                    trip_id=trip.id,
                    day_number=trip_day.day_number,
                    trip_date=trip_day.date,
                    display_order=display_order,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image processing failed: {draft.original_filename}",
                ) from exc

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
                display_order=display_order,
                created_at=datetime.now(),
            )
            db.add(photo)
            db.flush()

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

    db.commit()
    for trip_day_id, gen_id in generation_jobs:
        background_tasks.add_task(_run_generation, trip_day_id, gen_id)

    first_trip_day = trip_days_by_date[sorted_dates[0]]
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
            for grouped_date in sorted_dates
        ],
    )


@router.post("/trip-days/{trip_day_id}/generate", response_model=GenerationStartResponse)
def start_trip_day_generation(
    trip_day_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GenerationStartResponse:
    # 로딩 화면에서 호출하는 생성 시작 API.
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
