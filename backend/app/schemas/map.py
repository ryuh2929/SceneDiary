from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class Days(BaseModel):
    id: int
    trip_id: int
    day_number: int
    date: date  

    location_summary: Optional[str] = None  
    weather: Optional[str] = None           
    subtitle: Optional[str] = None          
    emotion: Optional[str] = None           
    content: Optional[str] = None           
               

    representative_lat: Optional[float] = None  
    representative_lon: Optional[float] = None  
    represent_image: Optional[int] = None   
    # word_count: Optional[int] = None       

    # 🕒 시간 필드들도 DB나 모델 상태에 따라 null 구조로 인식될 수 있으니 임시로 Optional 처리해봅니다.
    # created_at: Optional[datetime] = None                    
    # updated_at: Optional[datetime] = None                    
    # generated_at: Optional[datetime] = None                  

    model_config = ConfigDict(from_attributes=True)

class PhotoSchema(BaseModel):
    id: int
    file_url: str
    thumbnail_url: str  # <--- 이 필드를 스키마에 추가하세요!
    image_url: Optional[str] = None      # 가공된 원본 URL
    thumbnail_image_url: Optional[str] = None # 가공된 썸네일 URL

    model_config = ConfigDict(from_attributes=True)

class DaysWithPhotos(Days):
    photos: list[PhotoSchema] = []
    