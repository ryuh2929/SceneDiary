"""
일기 생성기: 하루치 사진 → 일기 필드(JSON). 2단계로 나눠 처리합니다.

  1단계(analyze_photo)  · VLM: 사진 1장을 보고 "객관적 분석"만 (감성 X)
  2단계(write_diary)    · LLM: 분석 글들만 보고(사진 없이) 감성 일기 작성

지금은 두 단계 모두 같은 모델(gemma4:e4b, vision 지원)을 씁니다. 나중에 단계별로
다른 모델(보는 모델 / 쓰는 모델)로 교체할 수 있게 함수만 분리해 둔 구조입니다.
OpenAI 호환 API(requirements의 openai)를 Ollama(http://localhost:11434/v1)에 연결 →
base_url/모델만 바꾸면 실제 OpenAI 등으로도 전환 가능.

이 파일은 DB와 무관한 "순수 생성 함수"입니다. DB 저장(photo_generations 등)·
백그라운드 연결은 routers/diary.py 가 단계별 함수를 직접 호출해 처리합니다.

단독 테스트:  python -m app.services.diary_generator
  → 1일차(신시모섬) 사진으로 1·2단계를 모두 거쳐 결과를 출력합니다. (로컬 모델이라 느릴 수 있음)
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

# [1단계 · VLM] 사진을 객관적으로만 묘사하게 하는 프롬프트. 감성 해석은 2단계 작가의 몫.
_ANALYZE_PROMPT = """당신은 사진을 객관적으로 묘사하는 분석가입니다.
감성적 해석 없이, 사진에 실제로 보이는 것만 기록하세요.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.

{
  "description": "사진 속 장면을 1~2문장으로 객관적으로 묘사",
  "objects": ["주요 사물/풍경 키워드 몇 개"],
  "weather": "하늘/날씨가 보이면 한 단어(맑음/흐림/비/눈 등), 실내거나 알 수 없으면 빈 문자열",
  "mood": "사진의 전반적 분위기를 한 단어로"
}"""

# [2단계 · LLM] 1단계가 적어준 분석 글들만 보고(사진 없이) 감성 일기를 쓰게 하는 프롬프트.
_WRITE_PROMPT = """당신은 여행 사진 분석 결과를 보고 감성적인 한국어 여행 일기를 쓰는 작가입니다.
아래는 같은 날 찍은 사진들을 분석한 결과입니다. 사진을 직접 보지는 못하지만,
이 분석들을 종합해 그 날의 분위기·장소·감정을 담아 일기를 만드세요.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.

{
  "subtitle": "그 날을 한 줄로 표현한 감성적인 소제목",
  "content": "3~5문장의 따뜻하고 문학적인 한국어 일기 본문",
  "weather": "분석 결과의 날씨를 나타내는 날씨 이모지 1개(예: ☀️ ⛅ ☁️ 🌧️ ❄️). 날씨를 알 수 없으면 빈 문자열",
  "emotion": "그 날의 감정을 나타내는 이모지 1개"
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


def analyze_photo(path: Path) -> dict:
    """[1단계 · VLM] 사진 1장을 보고 객관적 분석을 만듭니다(감성 X).

    반환: {"analysis_text": 자연어 한 줄 요약, "analysis_json": 구조화 dict}
      - analysis_text : 2단계 작가에게 넘길 텍스트 (photo_generations.analysis_text)
      - analysis_json : 묘사·키워드·날씨·분위기 원본 dict (photo_generations.analysis_json)
    """
    resp = _client.chat.completions.create(
        model=DIARY_MODEL,
        messages=[
            {"role": "system", "content": _ANALYZE_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "이 사진을 분석해 주세요."},
                    {"type": "image_url", "image_url": {"url": _encode_image(path)}},
                ],
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.2,  # 분석은 사실 위주라 낮게(작문은 0.8)
    )
    parsed = _parse_json(resp.choices[0].message.content)

    # 작가에게 넘길 한 줄 텍스트로 정리: "묘사 (날씨: .., 분위기: .., 키워드: ..)"
    desc = (parsed.get("description") or "").strip()
    objects = parsed.get("objects") or []
    if isinstance(objects, list):
        objects = ", ".join(str(o) for o in objects)
    extras = []
    if parsed.get("weather"):
        extras.append(f"날씨: {parsed['weather']}")
    if parsed.get("mood"):
        extras.append(f"분위기: {parsed['mood']}")
    if objects:
        extras.append(f"키워드: {objects}")
    analysis_text = desc + (f" ({', '.join(extras)})" if extras else "")

    return {"analysis_text": analysis_text.strip(), "analysis_json": parsed}


def write_diary(
    analyses: list[str], *, location: str = "", date: str = ""
) -> dict:
    """[2단계 · LLM] 사진 분석 텍스트들만 보고(사진 없이) 일기를 씁니다.

    반환: {"subtitle", "content", "weather"(코드포인트), "emotion"(코드포인트)}
    weather·emotion 은 이모지를 Twemoji 코드포인트(hex)로 변환해 돌려줍니다.
    """
    hint = ""
    if location or date:
        hint = f"\n참고: 장소='{location}', 날짜='{date}'."

    # 분석들을 번호 매겨 한 덩어리 텍스트로 (사진 대신 이 글을 모델에 넣음)
    joined = "\n".join(f"{i}. {a}" for i, a in enumerate(analyses, 1)) or "(분석 없음)"
    user_text = (
        f"다음은 같은 날 찍은 사진들의 분석입니다.\n{joined}{hint}\n"
        "이 분석들을 바탕으로 그 날의 일기를 만들어 주세요."
    )

    resp = _client.chat.completions.create(
        model=DIARY_MODEL,
        messages=[
            {"role": "system", "content": _WRITE_PROMPT},
            {"role": "user", "content": user_text},
        ],
        response_format={"type": "json_object"},  # JSON 으로 받기(프롬프트와 이중 안전장치)
        temperature=0.8,
    )
    parsed = _parse_json(resp.choices[0].message.content)

    return {
        "subtitle": (parsed.get("subtitle") or "").strip(),
        "content": (parsed.get("content") or "").strip(),
        "weather": _emoji_to_codepoint(parsed.get("weather", "")),
        "emotion": _emoji_to_codepoint(parsed.get("emotion", "")),
    }


def generate_day_diary(
    image_paths: list[Path], *, location: str = "", date: str = ""
) -> dict:
    """[편의 함수] 1단계(사진별 분석) → 2단계(일기 작성)를 한 번에 잇습니다.

    DB 저장 없이 "사진 → 일기"만 빠르게 확인할 때(단독 테스트 등) 씁니다.
    실제 서비스(재생성)에서는 router 가 사진별 분석을 photo_generations 에 저장하려고
    analyze_photo / write_diary 를 단계별로 직접 호출합니다.
    """
    analyses = [analyze_photo(p)["analysis_text"] for p in image_paths]
    return write_diary(analyses, location=location, date=date)


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
