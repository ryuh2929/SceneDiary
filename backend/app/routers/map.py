from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload

from app.db.models import TripDay
from app.db.session import get_db
from app.schemas.map import DaysWithPhotos
import os

router = APIRouter(tags=["map"])

# ① 여행 전체 조회 
@router.get("/trip_days", summary="지도에 모든 일별 이미지 마커 생성하기",response_model=list[DaysWithPhotos])
def get_days(request: Request, db: Session = Depends(get_db)
) -> list[DaysWithPhotos]:
    # trip_days 모두 호출하기
    all_diaries = db.query(TripDay).options(joinedload(TripDay.photos)).all()
    BASE_URL = str(request.base_url).rstrip("/")
    # 2. 데이터를 순회하며 가공합니다.
    for diary in all_diaries:
        for photo in diary.photos:
            relative_path = photo.file_url.replace("test_images/", "", 1)
            photo.image_url = f"{BASE_URL}/images/{relative_path}"
            # 썸네일 URL 가공 (DB의 thumbnail_url을 사용)
            # 만약 썸네일 경로가 다르다면 replace를 해당 경로에 맞춰 수정하세요.
            thumb_relative_path = photo.thumbnail_url.replace("test_images/", "", 1)
            photo.thumbnail_image_url = f"{BASE_URL}/images/{thumb_relative_path}"

    return all_diaries