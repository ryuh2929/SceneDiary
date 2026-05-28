from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, ImageOps


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


def process_upload_image(
    *,
    raw_bytes: bytes,
    original_filename: str | None,
    upload_root: Path,
    public_root: str,
    trip_id: int,
    day_number: int,
    display_order: int,
) -> ProcessedImage:
    with Image.open(BytesIO(raw_bytes)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")

    analysis_image = _resize_to_fit(image, MAX_ANALYSIS_SIZE)
    thumbnail_image = _resize_to_fit(image, THUMBNAIL_SIZE)

    unique_name = f"{display_order + 1:02d}-{_safe_stem(original_filename)}-{uuid4().hex[:10]}.jpg"
    relative_dir = Path(public_root) / f"trip-{trip_id}" / f"day-{day_number}"
    file_url = str(relative_dir / unique_name).replace("\\", "/")
    thumbnail_url = str(relative_dir / f"thumb-{unique_name}").replace("\\", "/")

    file_path = upload_root / f"trip-{trip_id}" / f"day-{day_number}" / unique_name
    thumbnail_path = upload_root / f"trip-{trip_id}" / f"day-{day_number}" / f"thumb-{unique_name}"

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
