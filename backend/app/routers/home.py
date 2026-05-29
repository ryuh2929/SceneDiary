from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session , joinedload
from sqlalchemy import extract
from fastapi.encoders import jsonable_encoder

from app.db.models import Trip, TripDay
from app.db.session import get_db
from app.schemas.home import MainList

router = APIRouter(tags=["home"])

# 지정된 연도의 삭제되지 않은 여행(Trip) 목록 조회
def _get_tripList(db: Session, year: int) -> List[Trip]:
    trip = (
        db.query(Trip)
        # start_date에서 연도(year)만 추출
        .filter(extract('year', Trip.start_date) == year, 
        Trip.deleted_at.is_(None))
        .all()
    )
    
    return trip

# 특정 여행(Trip)의 일차별 상세 일정(TripDay)목록을 일차 순으로 조회
def _get_detailList(db:Session, request:Request, trip_id:int) -> List[TripDay]:
    detailList = (
        db.query(TripDay)
        .options(joinedload(TripDay.photos))
        .filter(TripDay.trip_id == trip_id)
        .order_by(TripDay.day_number)
        .all()
    )
    BASE_URL = str(request.base_url).rstrip("/")
    # 2. 데이터를 순회하며 가공합니다.
    for diary in detailList:
        for photo in diary.photos:
            if photo.file_url:
                relative_path = photo.file_url.replace("test_images/", "", 1)
                photo.image_url = f"{BASE_URL}/images/{relative_path}"
            else:
                photo.image_url = None

            if photo.thumbnail_url:
                thumb_relative_path = photo.thumbnail_url.replace("test_images/", "", 1)
                photo.thumbnail_image_url = f"{BASE_URL}/images/{thumb_relative_path}"
            else:
                photo.thumbnail_image_url = None

    return detailList

# 메인 홈 — 연도별 여행 및 일차별 요약 전체 조회
@router.get("/trips",summary="메인 리스트", response_model=List[MainList])
def get_mainlList(
    year: int, request: Request, db: Session = Depends(get_db)
):
    # 해당 연도의 여행 리스트 조회
    tripList = _get_tripList(db, year)

    if not tripList:  # None(데이터 없음) 일 때 
        return {"message": "해당 여행 정보를 찾을 수 없습니다."} 
    
    
    # 각 여행 객체를 순회하며 일차별 상세 스케줄을 동적으로 주입
    for item in tripList:
        
        # 스키마(MainList)의 'tripDays' 필드명과 일치하는 속성에 자식 리스트를 대입
        item.tripDays = _get_detailList(db, request, item.id)
        
    # 3. 데이터 전송(Serialization) 보장
    # SQLAlchemy ORM 인스턴스 구조와 날짜 데이터 등을 안전하게 Pydantic 규격에 맞는 
    # 순수 JSON 호환 데이터(딕셔너리 리스트)로 인코딩하여 반환합니다.    
    return tripList