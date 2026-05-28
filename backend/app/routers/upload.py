from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import DiaryGeneration, Photo, Trip, TripDay
from app.db.session import get_db
from app.routers.diary import _abs_url, _base_url, _gen_status, _run_generation
from app.services.image_processor import process_upload_image


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


class FirstDayUploadResponse(BaseModel):
    tripId: int
    tripDayId: int
    day: int
    status: LoadingStep
    photos: list[UploadedPhoto]


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


def _get_or_create_trip_day(
    db: Session,
    *,
    trip: Trip,
    day_number: int,
    trip_date: date,
) -> TripDay:
    trip_day = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip.id, TripDay.day_number == day_number)
        .first()
    )
    if trip_day is not None:
        return trip_day

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
    files: list[UploadFile] = File(...),
    user_id: int = Form(1),
    trip_id: int | None = Form(None),
    day_number: int = Form(1),
    trip_date: date | None = Form(None),
    title: str = Form("새 여행"),
    destination: str | None = Form(None),
    db: Session = Depends(get_db),
) -> FirstDayUploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="At least one photo is required")
    if len(files) > MAX_UPLOAD_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Photos are limited to {MAX_UPLOAD_PHOTOS}")
    if day_number < 1:
        raise HTTPException(status_code=400, detail="day_number must be greater than 0")

    effective_date = trip_date or date.today()
    trip = _get_or_create_trip(
        db,
        trip_id=trip_id,
        user_id=user_id,
        title=title,
        destination=destination,
        trip_date=effective_date,
    )
    trip_day = _get_or_create_trip_day(
        db,
        trip=trip,
        day_number=day_number,
        trip_date=effective_date,
    )

    existing_count = (
        db.query(Photo)
        .filter(Photo.trip_day_id == trip_day.id, Photo.deleted_at.is_(None))
        .count()
    )
    if existing_count + len(files) > MAX_UPLOAD_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Photos are limited to {MAX_UPLOAD_PHOTOS} per day")

    base = _base_url(request)
    uploaded: list[UploadedPhoto] = []
    for index, upload_file in enumerate(files):
        if upload_file.content_type and not upload_file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{upload_file.filename} is not an image")

        raw_bytes = await upload_file.read()
        display_order = existing_count + index
        try:
            processed = process_upload_image(
                raw_bytes=raw_bytes,
                original_filename=upload_file.filename,
                upload_root=_UPLOAD_ROOT,
                public_root=_UPLOAD_PUBLIC_ROOT,
                trip_id=trip.id,
                day_number=trip_day.day_number,
                display_order=display_order,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Image processing failed: {upload_file.filename}") from exc

        photo = Photo(
            trip_day_id=trip_day.id,
            user_id=user_id,
            file_url=processed.file_url,
            thumbnail_url=processed.thumbnail_url,
            original_filename=upload_file.filename,
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

        uploaded.append(
            UploadedPhoto(
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
        )

    db.commit()
    return FirstDayUploadResponse(
        tripId=trip.id,
        tripDayId=trip_day.id,
        day=trip_day.day_number,
        status="creating_thumbnails",
        photos=uploaded,
    )


@router.post("/trip-days/{trip_day_id}/generate", response_model=GenerationStartResponse)
def start_trip_day_generation(
    trip_day_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> GenerationStartResponse:
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
