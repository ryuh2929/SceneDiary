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
    



from typing import List, Optional  # 👈 상단에 List 임포트 추가
from datetime import date  # 👈 정확한 날짜 타입을 임포트!
from pydantic import BaseModel

class DetailList(BaseModel):
    id:int
    trip_id:int
    day_number:int
    date:date
    representative_lat: Optional[float] = None
    representative_lon: Optional[float] = None  
    
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
    

