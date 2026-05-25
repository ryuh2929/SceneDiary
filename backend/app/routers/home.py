from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
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
def _get_detailList(db:Session, trip_id:int) -> List[TripDay]:
    detailList = (
        db.query(TripDay)
        .filter(trip_id == TripDay.trip_id)
        .order_by(TripDay.day_number)
        .all()
    )
    return detailList

# 메인 홈 — 연도별 여행 및 일차별 요약 전체 조회
@router.get("/trips", response_model=List[MainList])
def get_mainlList(
    year: int, db: Session = Depends(get_db)
):
    # 해당 연도의 여행 리스트 조회
    tripList = _get_tripList(db, year)
    
    # 각 여행 객체를 순회하며 일차별 상세 스케줄을 동적으로 주입
    for item in tripList:
        # 스키마(MainList)의 'tripDays' 필드명과 일치하는 속성에 자식 리스트를 대입
        item.tripDays = _get_detailList(db,item.id)
        
    # 3. 데이터 전송(Serialization) 보장
    # SQLAlchemy ORM 인스턴스 구조와 날짜 데이터 등을 안전하게 Pydantic 규격에 맞는 
    # 순수 JSON 호환 데이터(딕셔너리 리스트)로 인코딩하여 반환합니다.    
    return jsonable_encoder(tripList)