from typing import Literal

from pydantic import BaseModel

TravelTypeIconName = Literal["compass"]


class PersonaTag(BaseModel):
    id: str
    label: str
    description: str
    selected: bool


class Persona(BaseModel):
    title: str
    description: str
    tags: list[PersonaTag]


class TravelType(BaseModel):
    id: str
    title: str
    description: str
    icon: TravelTypeIconName


class SettingsToggle(BaseModel):
    id: str
    label: str
    enabled: bool


class SettingsProfile(BaseModel):
    nickname: str
    persona: Persona
    travelType: TravelType
    toggles: list[SettingsToggle]


class UpdateWritingPersonaRequest(BaseModel):
    # 사용자가 선택한 글 작성 페르소나 id입니다.
    # 실제 DB에는 label이 아니라 poetic, daily 같은 안정적인 코드값만 저장합니다.
    persona_id: str
