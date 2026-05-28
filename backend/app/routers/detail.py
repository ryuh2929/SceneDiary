from sqlalchemy.orm import Session,joinedload
from sqlalchemy import extract
from fastapi.encoders import jsonable_encoder
from typing import List
from fastapi import APIRouter, Depends, Request

from app.db.models import Trip, TripDay
from app.db.session import get_db
from app.schemas.detail import DetailPage

router = APIRouter(tags=["detail"])

# 특정 여행 ID(trip_id)에 해당하는 기본 여행 정보
def _get_detailPage(db:Session,trip_id:int)-> Trip:
    trip =(
        db.query(Trip)
        .filter(Trip.id == trip_id,Trip.deleted_at.is_(None))
        .first()
    )
    return trip

# 특정 여행 ID(trip_id)에 묶여 있는 모든 일차별(Day 1 ~ Day N) 상세 일정 목록을 조회
def _get_dayDetail(db:Session, request:Request, trip_id:int)->List[TripDay]:
    dayDetail =(
        db.query(TripDay)
        .options(joinedload(TripDay.photos))
        # 외래키 조건: 해당 여행 ID에 종속된 일차들만 필터링
        .filter(TripDay.trip_id == trip_id)
        # 정렬 조건: day_number(1일 차, 2일 차, 3일 차...) 기준으로 오름차순 정렬
        .order_by(TripDay.day_number)
        .all()
    )
    BASE_URL = str(request.base_url).rstrip("/")
    # 2. 데이터를 순회하며 가공합니다.
    for diary in dayDetail:
        for photo in diary.photos:
            relative_path = photo.file_url.replace("test_images/", "", 1)
            photo.image_url = f"{BASE_URL}/images/{relative_path}"
            
            # 썸네일 URL 가공 (DB의 thumbnail_url을 사용)
            # 만약 썸네일 경로가 다르다면 replace를 해당 경로에 맞춰 수정하세요.
            thumb_relative_path = photo.thumbnail_url.replace("test_images/", "", 1)
            photo.thumbnail_image_url = f"{BASE_URL}/images/{thumb_relative_path}"
    return dayDetail

# 여행 상세 조회 API — 특정 여행 정보와 함께 Day 1부터 Day N까지의 일정을 한 번에 반환
@router.get("/trip_days",summary="상세보기", response_model=DetailPage)
def get_detailPage(
    trip_id:int, request: Request, db: Session = Depends(get_db)
):
    # 내부 조회 함수가 .first()를 사용하여 단일 'Trip 객체' 알맹이 하나만 딱 줍니다.
    detailPage = _get_detailPage(db,trip_id)

    if not detailPage:  # detailPage가 None(데이터 없음) 일 때 
     return {"message": "해당 여행 정보를 찾을 수 없습니다."}
    
    # 꺼내온 단일 여행 객체(detailPage)에 곧바로 접근하여, 해당 여행에 묶여 있는 
    # 모든 일차별 스케줄 리스트를 DB에서 싹 긁어와 'tripDetail' 필드 자리에 직접 꽂아줍니다.
    detailPage.tripDetail= _get_dayDetail(db,request,trip_id)
    
    
    return detailPage