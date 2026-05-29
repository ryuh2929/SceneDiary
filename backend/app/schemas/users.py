from pydantic import BaseModel


class EnsureUserRequest(BaseModel):
    # 프런트에서 생성/보관하는 비로그인 사용자 식별자입니다.
    user_uuid: str


class EnsureUserResponse(BaseModel):
    id: int
    user_uuid: str
    created: bool
