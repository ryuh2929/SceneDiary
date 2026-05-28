from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, ImageOps


# 업로드 이미지는 서버에서 다시 정리합니다.
# 분석용 이미지는 모델 입력에 맞게 줄이고, 썸네일은 글 작성 화면 미리보기용으로 별도 저장합니다.
MAX_ANALYSIS_SIZE = 1024
THUMBNAIL_SIZE = 240
JPEG_QUALITY = 82
THUMBNAIL_QUALITY = 72


@dataclass(frozen=True)
class ProcessedImage:
    file_url: str
    thumbnail_url: str
    file_size_bytes: int
    width: int
    height: int
    mime_type: str


def _safe_stem(filename: str | None) -> str:
    stem = Path(filename or "photo").stem
    stem = re.sub(r"[^0-9A-Za-z가-힣._-]+", "-", stem).strip(".-")
    return stem or "photo"


def _resize_to_fit(image: Image.Image, max_size: int) -> Image.Image:
    resized = image.copy()
    resized.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return resized


def _save_jpeg(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="JPEG", quality=quality, optimize=True)


def extract_image_taken_date(raw_bytes: bytes) -> date | None:
    # EXIF 촬영일을 읽어 날짜별 trip_day 분류에 사용합니다. 없거나 깨져 있으면 호출부에서 fallback 날짜를 씁니다.
    try:
        with Image.open(BytesIO(raw_bytes)) as opened:
            exif = opened.getexif()
    except Exception:
        return None

    for tag in (36867, 36868, 306):  # DateTimeOriginal, DateTimeDigitized, DateTime
        value = exif.get(tag)
        if not value:
            continue
        try:
            return datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S").date()
        except ValueError:
            continue

    return None


def process_upload_image(
    *,
    raw_bytes: bytes,
    original_filename: str | None,
    upload_root: Path,
    public_root: str,
    trip_id: int,
    day_number: int,
    trip_date: date,
    display_order: int,
) -> ProcessedImage:
    # EXIF 회전 정보를 반영한 뒤 JPEG로 통일해 모델 입력과 정적 서빙을 단순하게 맞춥니다.
    with Image.open(BytesIO(raw_bytes)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")

    analysis_image = _resize_to_fit(image, MAX_ANALYSIS_SIZE)
    thumbnail_image = _resize_to_fit(image, THUMBNAIL_SIZE)

    unique_name = f"{display_order + 1:02d}-{_safe_stem(original_filename)}-{uuid4().hex[:10]}.jpg"
    day_folder = f"day-{day_number}-{trip_date.isoformat()}"
    relative_dir = Path(public_root) / f"trip-{trip_id}" / day_folder
    file_url = str(relative_dir / unique_name).replace("\\", "/")
    thumbnail_url = str(relative_dir / f"thumb-{unique_name}").replace("\\", "/")

    file_path = upload_root / f"trip-{trip_id}" / day_folder / unique_name
    thumbnail_path = upload_root / f"trip-{trip_id}" / day_folder / f"thumb-{unique_name}"

    _save_jpeg(analysis_image, file_path, JPEG_QUALITY)
    _save_jpeg(thumbnail_image, thumbnail_path, THUMBNAIL_QUALITY)

    return ProcessedImage(
        file_url=file_url,
        thumbnail_url=thumbnail_url,
        file_size_bytes=file_path.stat().st_size,
        width=analysis_image.width,
        height=analysis_image.height,
        mime_type="image/jpeg",
    )
