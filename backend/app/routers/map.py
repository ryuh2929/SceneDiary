from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import TripDay
from app.db.session import get_db
from app.schemas.map import Days

router = APIRouter(tags=["map"])

# ① 여행 전체 조회 
@router.get("/trip_days", summary="지도에 모든 일별 이미지 마커 생성하기",response_model=list[Days])
def get_days(db: Session = Depends(get_db)
) -> list[Days]:
    # trip_days 모두 호출하기
    all_diaries = db.query(TripDay).all()
    return all_diaries