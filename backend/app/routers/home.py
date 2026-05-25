from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import extract
from fastapi.encoders import jsonable_encoder

from app.db.models import Trip, TripDay
from app.db.session import get_db
from app.schemas.home import MainList

router = APIRouter(tags=["home"])


def _get_tripList(db: Session, year: int) -> List[Trip]:
    trip = (
        db.query(Trip)
        .filter(extract('year', Trip.start_date) == year, 
        Trip.deleted_at.is_(None))
        .all()
    )
    return trip

def _get_detaiList(db:Session, trip_id:int) -> List[TripDay]:
    detailList = (
        db.query(TripDay)
        .filter(trip_id == TripDay.trip_id)
        .order_by(TripDay.day_number)
        .all()
    )
    return detailList

@router.get("/trips", response_model=List[MainList])
def get_mainlList(
    year: int, db: Session = Depends(get_db)
):
    tripList = _get_tripList(db, year)
    
    for item in tripList:
        item.tripDays = _get_detaiList(db,item.id)
        
    return jsonable_encoder(tripList)