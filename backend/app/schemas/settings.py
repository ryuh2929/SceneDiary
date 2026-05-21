from pydantic import BaseModel


class AppSymbolName(BaseModel):
    ios: str
    android: str
    web: str


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
    icon: AppSymbolName


class SettingsToggle(BaseModel):
    id: str
    label: str
    enabled: bool
    icon: AppSymbolName


class SettingsProfile(BaseModel):
    nickname: str
    persona: Persona
    travelType: TravelType
    toggles: list[SettingsToggle]
