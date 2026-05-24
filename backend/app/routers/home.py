from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.models import Diary, Photo, Trip, TripDay
from app.db.session import get_db
from app.schemas.diary import (
    DetailList,MainList
)

router = APIRouter(tags=["home"])

@router.get("/trips/{trip_id}", response_model=MainList)
def get_trip(
    trip_id: int, request: Request, db: Session = Depends(get_db)
) -> MainList:
    trip = _get_trip_or_404(db, trip_id)
    base = _base_url(request)
    trip_days = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip_id)
        .order_by(TripDay.day_number)
        .all()
    )
    return MainList(
        
    )