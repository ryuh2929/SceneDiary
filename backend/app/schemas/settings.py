from typing import Literal

from pydantic import BaseModel

TravelTypeIconName = Literal["NotebookPen"]


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


SettingsToggleId = Literal["darkMode", "pushNotification"]


class UpdateSettingsToggleRequest(BaseModel):
    # 설정 화면의 토글 id와 변경할 값을 받습니다.
    # 프런트 id는 camelCase를 쓰고, 백엔드에서 실제 DB 컬럼명으로 매핑합니다.
    toggle_id: SettingsToggleId
    enabled: bool


class UpdateNicknameRequest(BaseModel):
    # 사용자가 설정 화면에서 수정한 닉네임입니다.
    # 공백 제거와 길이 검증은 라우터에서 한 번 더 처리합니다.
    nickname: str
