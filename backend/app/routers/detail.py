from sqlalchemy.orm import Session
from sqlalchemy import extract
from fastapi.encoders import jsonable_encoder
from typing import List
from fastapi import APIRouter, Depends

from app.db.models import Trip, TripDay
from app.db.session import get_db
from app.schemas.detail import DetailPage

router = APIRouter(tags=["detaile"])

# 특정 여행 ID(trip_id)에 해당하는 기본 여행 정보
def _get_detailPage(db:Session,trip_id:int)-> Trip:
    trip =(
        db.query(Trip)
        .filter(Trip.id == trip_id,Trip.deleted_at.is_(None))
        # .all()을 썼기 때문에, 조회된 결과가 딱 1개여도 파이썬은 무조건
        # 대괄호로 감싸인 리스트 형태(예: [Trip객체])로 데이터를 반환
        .all()
    )
    return trip

# 특정 여행 ID(trip_id)에 묶여 있는 모든 일차별(Day 1 ~ Day N) 상세 일정 목록을 조회
def _get_dayDetail(db:Session, trip_id:int)->List[TripDay]:
    dayDetail =(
        db.query(TripDay)
        # 외래키 조건: 해당 여행 ID에 종속된 일차들만 필터링
        .filter(trip_id == TripDay.trip_id)
        # 정렬 조건: day_number(1일 차, 2일 차, 3일 차...) 기준으로 오름차순 정렬
        .order_by(TripDay.day_number)
        .all()
    )
    return dayDetail

# 여행 상세 조회 API — 특정 여행 정보와 함께 Day 1부터 Day N까지의 일정을 한 번에 반환
@router.get("/trip_days",response_model=List[DetailPage])
def get_detailPage(
    trip_id:int, db: Session = Depends(get_db)
):
    detailPage = _get_detailPage(db,trip_id)
    
    for item in detailPage:
        item.tripDetail = _get_dayDetail(db,item.id)
    
    return jsonable_encoder(detailPage)