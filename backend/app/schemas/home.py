from typing import List, Optional  # 👈 상단에 List 임포트 추가
from datetime import date  # 👈 정확한 날짜 타입을 임포트!
from pydantic import BaseModel

class DetailList(BaseModel):
    id:int
    trip_id:int
    day_number:int
    date:date
    
    weather:Optional[str] = None
    location_summary:Optional[str] = None
    subtitle:Optional[str] = None
    emotion:Optional[str] = None
    content:Optional[str] = None
    represent_image:Optional[int] = None
    class Config:
        from_attributes = True  # Pydantic v2 기준 (만약 에러나면 orm_mode = True 로 변경)

class PhotoSchema(BaseModel):
    id: int
    file_url: str
    thumbnail_url: str
    image_url: Optional[str] = None      # 가공된 원본 URL
    thumbnail_image_url: Optional[str] = None # 가공된 썸네일 URL
    class Config:
        from_attributes = True

class DaysWithPhotos(DetailList):
    photos: list[PhotoSchema] = []
class MainList(BaseModel):
    id : int
    user_id:int
    title: str
    destination:Optional[str] = None
    start_date:date
    end_date:date
    cover_photo_id:Optional[int] = None
    status:str
    flag: Optional[str] = None
    tripDays:List[DaysWithPhotos] = []
    
    class Config:
        from_attributes = True  # Pydantic v2 기준 (만약 에러나면 orm_mode = True 로 변경)
    

