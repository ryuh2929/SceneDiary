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
THUMBNAIL_SIZE = 256
DIMENSION_MULTIPLE = 32
JPEG_QUALITY = 85
THUMBNAIL_QUALITY = 72
MAX_ANALYSIS_BYTES = 200 * 1024


@dataclass(frozen=True)
class ProcessedImage:
    file_url: str
    thumbnail_url: str
    file_size_bytes: int
    width: int
    height: int
    mime_type: str


@dataclass(frozen=True)
class SavedProfileImage:
    file_url: str
    file_size_bytes: int
    mime_type: str


@dataclass(frozen=True)
class GpsCoordinates:
    latitude: float
    longitude: float


def _safe_stem(filename: str | None) -> str:
    stem = Path(filename or "photo").stem
    stem = re.sub(r"[^0-9A-Za-z가-힣._-]+", "-", stem).strip(".-")
    return stem or "photo"


def _resize_to_fit(image: Image.Image, max_size: int) -> Image.Image:
    resized = image.copy()
    resized.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return resized


def _floor_to_multiple(value: int, multiple: int) -> int:
    return max(multiple, value - (value % multiple))


def _resize_to_fit_multiple(image: Image.Image, max_size: int, multiple: int) -> Image.Image:
    resized = _resize_to_fit(image, max_size)
    width = _floor_to_multiple(resized.width, multiple)
    height = _floor_to_multiple(resized.height, multiple)
    if resized.width == width and resized.height == height:
        return resized
    return resized.resize((width, height), Image.Resampling.LANCZOS)


def _save_jpeg(image: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="JPEG", quality=quality, optimize=True)


def _save_analysis_jpeg(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    current = image
    while True:
        for quality in (JPEG_QUALITY, 82, 78, 74, 70, 65):
            current.save(path, format="JPEG", quality=quality, optimize=True)
            if path.stat().st_size <= MAX_ANALYSIS_BYTES:
                return

        next_size = max(current.width, current.height) - DIMENSION_MULTIPLE
        if next_size < DIMENSION_MULTIPLE:
            return
        current = _resize_to_fit_multiple(current, next_size, DIMENSION_MULTIPLE)


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
            match = re.match(r"^(20\d{2})[:/-](\d{2})[:/-](\d{2})", str(value))
            if match:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

    return None


def _gps_rational_to_float(value: object) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        pass

    try:
        numerator, denominator = value  # type: ignore[misc]
        return float(numerator) / float(denominator)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _gps_degrees_to_float(value: object) -> float | None:
    try:
        degrees, minutes, seconds = value  # type: ignore[misc]
    except (TypeError, ValueError):
        return None

    parsed_degrees = _gps_rational_to_float(degrees)
    parsed_minutes = _gps_rational_to_float(minutes)
    parsed_seconds = _gps_rational_to_float(seconds)
    if parsed_degrees is None or parsed_minutes is None or parsed_seconds is None:
        return None

    return parsed_degrees + (parsed_minutes / 60) + (parsed_seconds / 3600)


def _gps_ref(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode(errors="ignore").upper()
    return str(value).upper()


def extract_image_gps_coordinates(raw_bytes: bytes) -> GpsCoordinates | None:
    # EXIF GPS IFD의 도/분/초 좌표를 앱에서 쓰는 십진수 위경도로 바꿉니다.
    try:
        with Image.open(BytesIO(raw_bytes)) as opened:
            exif = opened.getexif()
            gps_ifd = exif.get_ifd(34853) if hasattr(exif, "get_ifd") else exif.get(34853)
    except Exception:
        return None

    if not gps_ifd:
        return None

    latitude = _gps_degrees_to_float(gps_ifd.get(2))
    longitude = _gps_degrees_to_float(gps_ifd.get(4))
    if latitude is None or longitude is None:
        return None

    if _gps_ref(gps_ifd.get(1, "N")).startswith("S"):
        latitude = -latitude
    if _gps_ref(gps_ifd.get(3, "E")).startswith("W"):
        longitude = -longitude

    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    if latitude == 0 and longitude == 0:
        return None

    return GpsCoordinates(latitude=latitude, longitude=longitude)


def process_upload_image(
    *,
    raw_bytes: bytes,
    original_filename: str | None,
    analysis_root: Path,
    thumbnail_root: Path,
    analysis_public_root: str,
    thumbnail_public_root: str,
    trip_id: int,
    day_number: int,
    trip_date: date,
    display_order: int,
) -> ProcessedImage:
    # EXIF 회전 정보를 반영한 뒤 JPEG로 통일해 모델 입력과 정적 서빙을 단순하게 맞춥니다.
    with Image.open(BytesIO(raw_bytes)) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")

    analysis_image = _resize_to_fit_multiple(image, MAX_ANALYSIS_SIZE, DIMENSION_MULTIPLE)
    thumbnail_image = _resize_to_fit_multiple(image, THUMBNAIL_SIZE, DIMENSION_MULTIPLE)

    unique_name = f"{display_order + 1:02d}-{_safe_stem(original_filename)}-{uuid4().hex[:10]}.jpg"
    day_folder = f"day-{day_number}-{trip_date.isoformat()}"
    relative_dir = Path(f"trip-{trip_id}") / day_folder
    file_url = str(Path(analysis_public_root) / relative_dir / unique_name).replace("\\", "/")
    thumbnail_url = str(Path(thumbnail_public_root) / relative_dir / f"thumb-{unique_name}").replace("\\", "/")

    file_path = analysis_root / relative_dir / unique_name
    thumbnail_path = thumbnail_root / relative_dir / f"thumb-{unique_name}"

    _save_analysis_jpeg(analysis_image, file_path)
    _save_jpeg(thumbnail_image, thumbnail_path, THUMBNAIL_QUALITY)

    return ProcessedImage(
        file_url=file_url,
        thumbnail_url=thumbnail_url,
        file_size_bytes=file_path.stat().st_size,
        width=analysis_image.width,
        height=analysis_image.height,
        mime_type="image/jpeg",
    )


def save_profile_image(
    *,
    raw_bytes: bytes,
    original_filename: str | None,
    profile_root: Path,
    profile_public_root: str,
    user_id: int,
) -> SavedProfileImage:
    # 프로필 이미지는 프런트에서 이미 256x256 JPEG로 정리해서 보내므로
    # 백엔드에서는 이미지 파일인지 검증한 뒤 그대로 저장합니다.
    try:
        with Image.open(BytesIO(raw_bytes)) as opened:
            opened.verify()
    except Exception as exc:
        raise ValueError("Invalid image file") from exc

    unique_name = f"profile-{_safe_stem(original_filename)}-{uuid4().hex[:10]}.jpg"
    relative_dir = Path(f"user-{user_id}")
    file_url = str(Path(profile_public_root) / relative_dir / unique_name).replace("\\", "/")
    file_path = profile_root / relative_dir / unique_name

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(raw_bytes)

    return SavedProfileImage(
        file_url=file_url,
        file_size_bytes=file_path.stat().st_size,
        mime_type="image/jpeg",
    )
