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
