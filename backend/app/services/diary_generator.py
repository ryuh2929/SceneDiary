"""
일기 생성기 (6-3): 하루치 사진 → Ollama 멀티모달 모델 → 일기 필드(JSON).

gemma4:e4b 는 vision 지원이 확인돼서, 사진들을 직접 넣어 한 번에 생성합니다.
OpenAI 호환 API(requirements의 openai)를 Ollama(http://localhost:11434/v1)에 연결해 사용 →
나중에 base_url/모델만 바꾸면 실제 OpenAI 등으로도 전환할 수 있습니다.

이 단계(6-3)는 DB와 무관한 "순수 생성 함수"입니다. DB 저장·백그라운드 연결은 6-4.

단독 테스트:  python -m app.services.diary_generator
  → 1일차(신시모섬) 사진으로 실제 생성해 결과를 출력합니다. (로컬 모델이라 느릴 수 있음)
"""

import base64
import json
import os
from pathlib import Path

from openai import OpenAI

# 환경변수로 덮어쓸 수 있게(없으면 로컬 Ollama 기본값).
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
DIARY_MODEL = os.getenv("DIARY_MODEL", "gemma4:e4b")

# api_key 는 SDK가 요구하지만 Ollama는 무시합니다.
_client = OpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")

_SYSTEM_PROMPT = """당신은 여행 사진을 보고 감성적인 한국어 여행 일기를 쓰는 작가입니다.
주어진 사진들(같은 날 찍은 사진)을 보고 그 날의 분위기·장소·감정을 담아 일기를 만듭니다.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.

{
  "subtitle": "그 날을 한 줄로 표현한 감성적인 소제목",
  "content": "3~5문장의 따뜻하고 문학적인 한국어 일기 본문",
  "emotion": "그 날의 감정을 나타내는 이모지 1개",
  "symbol": "그 날을 상징하는 사물/풍경 이모지 1개"
}"""


def _encode_image(path: Path) -> str:
    """이미지 파일 → data URI(base64). 멀티모달 모델 입력용."""
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:image/jpeg;base64,{b64}"


def _parse_json(raw: str) -> dict:
    """모델 응답에서 JSON 추출. ```json ... ``` 처럼 감싸여도 중괄호 구간만 파싱."""
    raw = (raw or "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                return {}
        return {}


def _emoji_to_codepoint(value: str) -> str:
    """이모지 문자 → Twemoji 코드포인트(hex, 다중은 '-' 연결). 비었거나 이모지가 아니면 ''."""
    value = (value or "").strip()
    if not value:
        return ""
    # 전부 ASCII 영역이면 이모지가 아님(영문/단어 등) → 버림
    if all(ord(c) < 0x2000 for c in value):
        return ""
    return "-".join(f"{ord(c):x}" for c in value)


def generate_day_diary(
    image_paths: list[Path], *, location: str = "", date: str = ""
) -> dict:
    """하루치 사진들로 일기 필드를 생성합니다.

    반환: {"subtitle", "content", "emotion"(코드포인트), "symbol"(코드포인트)}
    """
    hint = ""
    if location or date:
        hint = f"\n참고: 장소='{location}', 날짜='{date}'."

    # content 는 [텍스트, 이미지, 이미지, ...] 형태로 구성합니다.
    content_parts: list[dict] = [
        {"type": "text", "text": "이 사진들로 그 날의 일기를 만들어 주세요." + hint}
    ]
    for p in image_paths:
        content_parts.append(
            {"type": "image_url", "image_url": {"url": _encode_image(p)}}
        )

    resp = _client.chat.completions.create(
        model=DIARY_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": content_parts},
        ],
        response_format={"type": "json_object"},  # JSON 으로 받기(프롬프트와 이중 안전장치)
        temperature=0.8,
    )
    parsed = _parse_json(resp.choices[0].message.content)

    return {
        "subtitle": (parsed.get("subtitle") or "").strip(),
        "content": (parsed.get("content") or "").strip(),
        "emotion": _emoji_to_codepoint(parsed.get("emotion", "")),
        "symbol": _emoji_to_codepoint(parsed.get("symbol", "")),
    }


if __name__ == "__main__":
    # 1일차(신시모섬) 사진으로 빠른 단독 테스트.
    images_dir = (
        Path(__file__).resolve().parent.parent.parent
        / "test_images"
        / "test_images_korea"
    )
    day1 = sorted(images_dir.glob("20260501_*.jpg"))
    print(f"사진 {len(day1)}장으로 생성 중... (로컬 모델이라 수십 초 걸릴 수 있어요)")
    result = generate_day_diary(day1, location="신시모도", date="2026-05-01")
    print(json.dumps(result, ensure_ascii=False, indent=2))
