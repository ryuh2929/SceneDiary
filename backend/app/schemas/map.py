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
    symbol: Optional[str] = None            

    representative_lat: Optional[float] = None  
    representative_lon: Optional[float] = None  
    represent_image: Optional[int] = None   
    # word_count: Optional[int] = None       

    # 🕒 시간 필드들도 DB나 모델 상태에 따라 null 구조로 인식될 수 있으니 임시로 Optional 처리해봅니다.
    # created_at: Optional[datetime] = None                    
    # updated_at: Optional[datetime] = None                    
    # generated_at: Optional[datetime] = None                  

    model_config = ConfigDict(from_attributes=True)