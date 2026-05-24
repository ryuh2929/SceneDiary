from typing import Literal

from pydantic import BaseModel

class DetailList(BaseModel):
    id:int
    day_number:int
    location_summary:str
    subtitle:str
    emotion:str
    represent_image:str

class MainList(BaseModel):
    id : int
    user_id:int
    title: str
    destination:str
    start_date:str
    end_date:str
    cover_photo_id:str
    status:str
    diaries:list[DetailList]
    



    


    
