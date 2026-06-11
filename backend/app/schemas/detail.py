from typing import List, Optional  # 👈 상단에 List 임포트 추가
from datetime import date  # 👈 정확한 날짜 타입을 임포트!
from pydantic import BaseModel

class DayList(BaseModel):
    id:int
    trip_id:int
    day_number:int
    date:date
    location_summary:Optional[str] = None
    weather:Optional[str] = None
    subtitle:Optional[str] = None
    emotion:Optional[str] = None
    # DB(trip_days.represent_image)는 photos.id 를 가리키는 정수 FK 입니다.
    # 이전엔 str 로 잘못 선언되어 있어 Pydantic 검증에서 500 이 발생했습니다.
    represent_image:Optional[int] = None
    content:Optional[str] = None
    # 생성이 끝나기 전(또는 실패한 날)에는 word_count 가 NULL 입니다.
    # 필수로 두면 일부 일차만 미완료여도 응답 전체가 500 으로 떨어져 detail 페이지가 못 열립니다.
    word_count:Optional[int] = None
    
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

class DaysWithPhotos(DayList):
    photos: list[PhotoSchema] = []        
class DetailPage(BaseModel):
    id:int
    user_id:int
    title:str
    destination:Optional[str] = None
    flag:Optional[str] = "1f30d"
    start_date:date
    end_date:date
    cover_photo_id:Optional[int] = None
    status:str
    tripDetail:List[DaysWithPhotos]
    
    class Config:
        from_attributes = True  # Pydantic v2 기준 (만약 에러나면 orm_mode = True 로 변경)
    

