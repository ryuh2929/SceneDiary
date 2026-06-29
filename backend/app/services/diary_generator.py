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
import google.generativeai as genai
from google import genai as vertex_genai
from google.genai import types as vertex_types
from app.services.diary_prompts import write_prompt_for_persona as shared_write_prompt_for_persona

# 환경변수로 덮어쓸 수 있게(없으면 로컬 Ollama 기본값).
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
DIARY_MODEL = os.getenv("DIARY_MODEL", "gemma4:e4b")
DIARY_MODEL_PROVIDER = os.getenv("DIARY_MODEL_PROVIDER", "openai").strip().lower()
TITLE_MODEL_PROVIDER = os.getenv("TITLE_MODEL_PROVIDER", "gemini").strip().lower()
TITLE_MODEL = os.getenv("TITLE_MODEL", DIARY_MODEL)
TITLE_GEMINI_MODEL = os.getenv("TITLE_GEMINI_MODEL", "models/gemini-3.1-flash-lite")
GEMINI_PROJECT_ID = os.getenv("GEMINI_PROJECT_ID", "project-19fbb1da-6ea1-4a56-8c1")
GEMINI_LOCATION = os.getenv("GEMINI_LOCATION", "us-west1")
DIARY_PERSONAS = {"daily", "playful", "poetic", "romantic"}

GOOGLE_API_KEY= os.getenv("GENAI_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
# 2. 모델 선택 (gemini-1.5-flash 또는 gemini-1.5-pro 등)
google_model = genai.GenerativeModel(
    model_name=TITLE_GEMINI_MODEL,
    # 응답 형식을 JSON으로 강제
    generation_config={
        "response_mime_type": "application/json",
        "temperature": 0.2, # 신뢰도와 관련이 깊은 창의성 설정
    })

API_KEY = os.getenv("OPENAI_API_KEY")
# api_key 는 SDK가 요구하지만 Ollama는 무시합니다.
_client = OpenAI(base_url="https://api.openai.com/v1", api_key=API_KEY)

# [1단계 · VLM] 사진과 메타데이터를 함께 보고 일기 작성용 단서를 구조화합니다.
_ANALYZE_PROMPT = """당신은 여행 사진을 분석해 일기 작성에 필요한 사실 기반 단서를 구조화하는 분석가입니다.
사진에 보이는 장면을 우선으로 기록하고, 제공된 시간/위치 메타데이터는 참고 정보로만 사용하세요.
사진 내용과 맞지 않으면 장소명, 랜드마크, 활동을 단정하지 마세요.
감성적인 문장 작성은 하지 말고, 관찰 가능한 정보와 신중한 추정만 JSON으로 반환하세요.
confidence 값은 0.0~1.0 숫자로 작성하세요.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.

{
  "description": "사진 속 장면을 1~2문장으로 객관적으로 묘사",
  "objects": ["주요 사물/풍경 키워드 몇 개"],
  "weather": "하늘/날씨가 보이면 한 단어(맑음/흐림/비/눈 등), 실내거나 알 수 없으면 빈 문자열",
  "mood": "사진의 전반적 분위기를 한 단어로",
  "place_type": "반드시 landmark, street, nature, restaurant, cafe, hotel, transport, museum, shop, event, unknown 중 하나",
  "indoor_outdoor": "반드시 indoor, outdoor, mixed, unknown 중 하나",
  "activity": ["walking", "sightseeing"]처럼 사진에서 보이는 활동 키워드",
  "landmark_guess": "사진과 메타데이터가 함께 뒷받침할 때만 구체 랜드마크명, 아니면 빈 문자열",
  "landmark_confidence": 0.0,
  "landmark_basis": ["visual_match", "gps_context"]처럼 판단 근거 키워드 배열",
  "people_type": "반드시 selfie, portrait_of_user, group_photo, performance, crowd, stranger, landscape_only, unclear 중 하나",
  "people_importance": "반드시 main_subject, background, incidental, none, unclear 중 하나",
  "time_hint": "반드시 early_morning, morning, afternoon, evening, night, unknown 중 하나",
  "time_confidence": 0.0,
  "time_basis": ["exif_time", "visual_cues"]처럼 판단 근거 키워드 배열
}"""

# [2단계 · LLM] 1단계가 적어준 분석 글들만 보고(사진 없이) 감성 일기를 쓰게 하는 프롬프트.
_WRITE_PROMPT = """당신은 여행 사진 분석 결과를 보고 한국어 여행 일기를 쓰는 작가입니다.
아래는 같은 날 찍은 사진들을 분석한 결과입니다. 사진을 직접 보지는 못하지만,
이 분석들을 종합해 그 날의 분위기·장소·감정을 담아 일기를 만드세요.
입력의 persona 값에 맞는 모델/문체로 작성하되, 입력에 없는 사실을 새로 만들지 마세요.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.
사진 분석 내용만 바탕으로 하루의 기록을 일기 형식으로 작성하세요.
지역 이름을 일일이 나열하지 말고, 장소의 느낌 위주로 서술하세요.
입력에 없는 관계, 사건, 감정, 장소명은 새로 만들지 마세요.
오늘 하루를 되돌아보는 일기처럼 자연스럽게 작성하세요.
사진을 해설하듯 쓰지 말고, 사용자가 그 순간을 다시 떠올리는 일기처럼 작성하세요.
'사진에는', '장면이었다' 같은 제3자 관찰 표현은 피하세요.

[subtitle 규칙]
1. 구체성: 여행지에서 먹은 음식, 본 풍경, 했던 경험 등 구체적인 소재를 반드시 하나 포함할 것.
2. 말투: persona에 맞는 자연스러운 한국어 제목으로 작성할 것.
3. 과장 금지: 입력 분석보다 지나치게 큰 의미를 부여하거나 없는 감정을 만들지 말 것.
4. 길이: 공백 포함 25자 이내로 짧고 간결하게 작성할 것.
5. 너는 여행자의 하루 기록을 보고, 가장 자연스러운 한 줄 제목을 뽑아내는 에디터야.

{
  "subtitle": "여행자가 친구에게 말하듯 간결하게 작성할 것",
  "content": "3~5문장의 평범한 일상을 적는 인스타 감성으로 한국어 일기 본문",
  "weather": "반드시 다음 중 하나만 사용하세요 (☀️, ⛅, ☁️, 🌧️, ❄️, 🌙, '')",
  "emotion": "그 날의 감정을 나타내는 이모지 1개",
  "summaryShort": "content의 핵심 장면을 30자 내외로 요약."
}"""

_PERSONA_STYLE_PROMPTS = {
    "daily": "문체 지시: 담백하고 편안한 구어체로, 과장된 문학 표현과 불필요한 수식어는 피하세요.",
    "playful": "문체 지시: 제목은 유머러스하지만 과격한 표현을 자제해서 짧은 제목으로 하고, 작성하는 일기는 현재 진행형이 아닌 이미 일어난 일입니다. 단어를 ~~하고있다. 식의 표현은 삼가해주세요. 그리고 가볍고 유머 있는 구어체로 쓰되, 장면에 없는 농담이나 과장은 만들지 말고, 과격한 단어 표현이나 감성적인 표현, 예를 들면 눈깔, 궁디, 조졌어, 감성 한스푼, 짜릿하다, 늪에 빠지다, 붙여넣기 한것 같은 등등 LLM이 자주 사용하는 표현은 자제하세요",
    "poetic": """문체 지시: 실제 사진 분석에 있는 장면을 바탕으로 문학적인 표현을 사용하되, 사실을 꾸며내지는 마세요. 
    1. 풍경, 빛, 소리, 온도 등 오감을 자극하는 언어로 감정을 암시하고 직접적인 감정 표현('행복하다', '힐링된다' 등)은 피하세요. 
    2. 사건의 나열이 아닌 하나의 풍경화처럼 서술하며, 과장된 상징이나 운명적인 서사는 배제하세요. 
    3. 문장은 간결하고 절제된 시어를 사용하여 약 200자 이내로 작성하고, 장면을 압축한 시적인 제목(subtitle)을 붙이세요. 
    4. 마지막 문장은 감정을 요약하지 말고, 현장의 여운이 남는 묘사로 마무리하세요.""",
    "romantic": "문체 지시: 따뜻하고 다정한 분위기로 쓰되, 입력에 없는 관계성이나 과한 사랑 표현은 만들지 마세요. 사진 분석에 손잡기, 가까이 기대기, 나란히 앉기처럼 친밀한 장면이 명시되어 있으면 그 장면의 온기를 자연스럽게 살려 쓰세요.",
}

# [3단계 · LLM] 모든 일차가 완료되면, 전체 여행을 아우르는 짧은 제목 한 줄을 만듭니다.
# write_diary 와 동일한 모델·호출 패턴을 쓰지만 입력은 "여러 날의 subtitle/본문 발췌".
_TITLE_PROMPT = """당신은 사진을 보고 센스있는 제목을 짓는 작가입니다.
여러 일차의 분위기·장소·감정을 종합해 짧고 인상적인 한국어 제목 한 줄을 만드세요.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.



{
  "title": "16자 이내의 한국어 제목",
  "img_id": 0
}

지침:
1. 구체성: 여행지에서 먹은 음식, 본 풍경, 했던 경험 등 구체적인 소재를 반드시 하나 포함할 것.
2. 말투: 친구에게 무심하게 한마디 툭 던지는 듯한 일상적인 구어체 사용. (예: "~하는 길에", "~에서 찾은", "~ 생각보다 좋음")
3. 감성 금지: '낭만', '심장', '영원히', '눈부신', '잊지 못할' 같은 지나치게 감성적인 단어는 절대 사용하지 말 것.
4. 길이: 공백 포함 25자 이내로 짧고 간결하게 작성할 것.
5. 너는 20대 여행자의 일기장을 보고, 가장 자연스러운 한 줄 제목을 뽑아내는 에디터야. """

def _encode_image(path: Path) -> str:
    """이미지 파일 → data URI(base64). 멀티모달 모델 입력용."""
    b64 = base64.b64encode(path.read_bytes()).decode()
    print(f"인코딩된 데이터 길이: {len(b64)}")
    return f"data:image/jpeg;base64,{b64}"

def get_gemini_image_blob(path: Path):
    """Base64 문자열을 제미나이가 이해할 수 있는 Blob 객체로 변환"""
    data = path.read_bytes()
    return {
        "mime_type": "image/jpeg", # 또는 파일 확장자에 따라 image/png
        "data": data
    }


def _parse_dict(raw: str) -> dict:
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


def _confidence(value: object) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, score))


_PLACE_TYPES = {
    "landmark",
    "street",
    "nature",
    "restaurant",
    "cafe",
    "hotel",
    "transport",
    "museum",
    "shop",
    "event",
    "unknown",
}
_INDOOR_OUTDOOR = {"indoor", "outdoor", "mixed", "unknown"}
_PEOPLE_TYPES = {
    "selfie",
    "portrait_of_user",
    "group_photo",
    "performance",
    "crowd",
    "stranger",
    "landscape_only",
    "unclear",
}
_PEOPLE_IMPORTANCE = {"main_subject", "background", "incidental", "none", "unclear"}
_TIME_HINTS = {"early_morning", "morning", "afternoon", "evening", "night", "unknown"}


def _enum_value(value: object, allowed: set[str], fallback: str) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized in allowed else fallback


def _token_usage_from_response(resp) -> dict[str, int | None]:
    usage = getattr(resp, "usage", None)
    if usage is not None:
        return {
            "input_tokens": getattr(usage, "prompt_tokens", None),
            "output_tokens": getattr(usage, "completion_tokens", None),
            "total_tokens": getattr(usage, "total_tokens", None),
        }

    usage_metadata = getattr(resp, "usage_metadata", None)
    if usage_metadata is not None:
        return {
            "input_tokens": getattr(usage_metadata, "prompt_token_count", None),
            "output_tokens": getattr(usage_metadata, "candidates_token_count", None),
            "total_tokens": getattr(usage_metadata, "total_token_count", None),
        }

    return {
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
    }


def _normalize_persona(persona: str | None) -> str:
    normalized = (persona or "daily").strip().lower()
    return normalized if normalized in DIARY_PERSONAS else "daily"


def _write_prompt_for_persona(persona: str) -> str:
    return shared_write_prompt_for_persona(persona)


def _openai_diary_model_for_persona(persona: str) -> str:
    env_name = f"DIARY_OPENAI_MODEL_{persona.upper()}"
    return os.getenv(env_name, DIARY_MODEL)


def _gemini_diary_endpoint_for_persona(persona: str) -> str:
    env_name = f"GEMINI_{persona.upper()}_ENDPOINT_ID"
    endpoint_id = (os.getenv(env_name) or "").strip()
    if not endpoint_id:
        raise RuntimeError(
            f"{env_name} is not configured. "
            f"Set {env_name} or use DIARY_MODEL_PROVIDER=openai for this persona."
        )
    return f"projects/{GEMINI_PROJECT_ID}/locations/{GEMINI_LOCATION}/endpoints/{endpoint_id}"


def _generate_diary_with_openai(persona: str, user_text: str) -> dict:
    model = _openai_diary_model_for_persona(persona)
    resp = _client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _write_prompt_for_persona(persona)},
            {"role": "user", "content": user_text},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    print(f"write_diary provider=openai persona={persona} model={resp.model}")
    return _parse_dict(resp.choices[0].message.content)


def _generate_diary_with_gemini(persona: str, user_text: str) -> dict:
    vertex_client = vertex_genai.Client(
        vertexai=True,
        project=GEMINI_PROJECT_ID,
        location=GEMINI_LOCATION,
    )
    response = vertex_client.models.generate_content(
        model=_gemini_diary_endpoint_for_persona(persona),
        contents=f"{_write_prompt_for_persona(persona)}\n\n{user_text}",
        config=vertex_types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=700,
            response_mime_type="application/json",
        ),
    )
    print(f"write_diary provider=gemini persona={persona}")
    return _parse_dict(response.text)


def analyze_photo(path: Path, *, photo_metadata: dict | None = None) -> dict:
    """[1단계 · VLM] 사진 1장을 보고 객관적 분석을 만듭니다(감성 X).

    반환: {"analysis_text": 자연어 한 줄 요약, "analysis_json": 구조화 dict}
      - analysis_text : 2단계 작가에게 넘길 텍스트 (photo_generations.analysis_text)
      - analysis_json : 묘사·키워드·날씨·분위기 원본 dict (photo_generations.analysis_json)
    """
    
    metadata_text = json.dumps(photo_metadata or {}, ensure_ascii=False)
    user_text = (
        "이 사진을 분석해 주세요.\n"
        "아래 photo_metadata는 사진에서 직접 얻은 사실값입니다. 참고만 하고, "
        "사진 내용과 맞지 않으면 장소/랜드마크/시간대를 단정하지 마세요.\n"
        f"photo_metadata: {metadata_text}"
    )

    resp = _client.chat.completions.create(
        model=DIARY_MODEL,
        messages=[
            {"role": "system", "content": _ANALYZE_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": _encode_image(path)}},
                ],
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.2,  # 분석은 사실 위주라 낮게(작문은 0.8)
    )
    print(f"analyze_photo 사용한 모델: {resp.model}")
    parsed = _parse_dict(resp.choices[0].message.content)
    parsed["landmark_confidence"] = _confidence(parsed.get("landmark_confidence"))
    parsed["time_confidence"] = _confidence(parsed.get("time_confidence"))
    parsed["place_type"] = _enum_value(parsed.get("place_type"), _PLACE_TYPES, "unknown")
    parsed["indoor_outdoor"] = _enum_value(parsed.get("indoor_outdoor"), _INDOOR_OUTDOOR, "unknown")
    parsed["people_type"] = _enum_value(parsed.get("people_type"), _PEOPLE_TYPES, "unclear")
    parsed["people_importance"] = _enum_value(
        parsed.get("people_importance"),
        _PEOPLE_IMPORTANCE,
        "unclear",
    )
    parsed["time_hint"] = _enum_value(parsed.get("time_hint"), _TIME_HINTS, "unknown")

    # 작가에게 넘길 한 줄 텍스트로 정리: "묘사 (날씨: .., 분위기: .., 키워드: ..)"
    desc = (parsed.get("description") or "").strip()
    objects = parsed.get("objects") or []
    if isinstance(objects, list):
        objects = ", ".join(str(o) for o in objects)
    activities = parsed.get("activity") or []
    if isinstance(activities, list):
        activities = ", ".join(str(a) for a in activities if str(a).strip())
    elif activities:
        activities = str(activities).strip()
    extras = []
    if parsed.get("weather"):
        extras.append(f"날씨: {parsed['weather']}")
    if parsed.get("mood"):
        extras.append(f"분위기: {parsed['mood']}")
    if parsed.get("place_type"):
        extras.append(f"장소유형: {parsed['place_type']}")
    if parsed.get("landmark_guess") and parsed.get("landmark_confidence", 0) >= 0.7:
        extras.append(f"랜드마크: {parsed['landmark_guess']}")
    if parsed.get("time_hint") and parsed.get("time_confidence", 0) >= 0.7:
        extras.append(f"시간대: {parsed['time_hint']}")
    if parsed.get("people_type"):
        extras.append(f"인물: {parsed['people_type']}")
    if activities:
        extras.append(f"활동: {activities}")
    if objects:
        extras.append(f"키워드: {objects}")
    analysis_text = desc + (f" ({', '.join(extras)})" if extras else "")
    print(resp.choices[0].message.content)

    return {
        "analysis_text": analysis_text.strip(),
        "analysis_json": parsed,
        "token_usage": _token_usage_from_response(resp),
    }


def write_diary(
    analyses: list[str], *, location: str = "", date: str = "", persona: str = "daily"
) -> dict:
    """[2단계 · LLM] 사진 분석 텍스트들만 보고(사진 없이) 일기를 씁니다.

    반환: {"subtitle", "content", "weather"(코드포인트), "emotion"(코드포인트),"summaryShort"(일기 요약)}
    weather·emotion 은 이모지를 Twemoji 코드포인트(hex)로 변환해 돌려줍니다.
    """
    persona = _normalize_persona(persona)

    # 사진 원본 대신 VLM이 만든 analysis_text 배열을 JSON 입력으로 넘깁니다.
    payload = {
        "persona": persona,
        "location": location or "",
        "date": date or "",
        "photo_analyses": [
            {"order": index, "analysis_text": analysis}
            for index, analysis in enumerate(analyses, 1)
        ],
    }
    user_text = (
        "다음 JSON 데이터를 바탕으로 SceneDiary 여행 일기를 작성하세요.\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )

    if DIARY_MODEL_PROVIDER in {"gemini", "vertex", "vertexai"}:
        parsed = _generate_diary_with_gemini(persona, user_text)
    else:
        parsed = _generate_diary_with_openai(persona, user_text)
    
    return {
        "subtitle": (parsed.get("subtitle") or "").strip(),
        "content": (parsed.get("content") or "").strip(),
        "weather": _emoji_to_codepoint(parsed.get("weather", "")),
        "emotion": _emoji_to_codepoint(parsed.get("emotion", "")),
        "summaryShort":(parsed.get("summaryShort") or "").strip(),
    }

def write_trip_title(
    days: list[dict],
    *,
    destination: str = "",
    path_list: list[Path] | None = None,
    photo_info: list[dict] | None = None,
) -> dict:
    """Create a trip title and choose one representative photo."""
    if not days:
        return {}

    candidate_photos = photo_info or []
    candidate_img_ids = [
        item.get("img_id") for item in candidate_photos if item.get("img_id") is not None
    ]
    payload = {
        "destination": destination or "",
        "days": [
            {
                "day": i,
                "subtitle": (day.get("subtitle") or "").strip(),
                "content_excerpt": (day.get("content_excerpt") or "").strip(),
            }
            for i, day in enumerate(days, 1)
        ],
        "candidate_photos": [
            {
                "img_id": item.get("img_id"),
                "analysis_text": (item.get("analysis_text") or "").strip(),
            }
            for item in candidate_photos
            if item.get("img_id") is not None
        ],
    }
    print("제목 생성할때 참고하는것들: ",payload)
    user_text = (
        "다음 여행 일기 요약과 후보 사진을 보고 여행 제목과 대표사진을 정해줘.\n"
        "반드시 JSON 객체 하나만 반환해.\n"
        "규칙:\n"
        "- title은 null이나 빈 문자열이면 안 된다.\n"
        "- title은 한국어로 16자 이내, 친구에게 말하듯 자연스럽게 작성한다.\n"
        "- title은 여행지, 먹은 것, 본 풍경, 겪은 일 중 구체적인 소재 하나를 담는다.\n"
        "- img_id는 candidate_photos 중 하나만 고른다.\n"
        "- candidate_photos가 비어 있으면 img_id는 null로 둔다.\n"
        '응답 형식: {"title":"...", "img_id":123}\n\n'
        f"입력 데이터:\n{json.dumps(payload, ensure_ascii=False)}"
    )
    print("AI에게 보내는 대표사진 후보:", candidate_img_ids)
    print("제목 AI 모델명:",TITLE_MODEL_PROVIDER)
    if TITLE_MODEL_PROVIDER in {"openai", "chatgpt", "gpt"}:
        resp = _client.chat.completions.create(
            model=TITLE_MODEL,
            messages=[
                {"role": "system", "content": "너는 SceneDiary 여행 제목 생성 모델이다. JSON만 응답한다."},
                {
                    "role": "user",
                    "content": user_text,
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        print(f"write_trip_title provider=openai model={resp.model}")
        dict_text = _parse_dict(resp.choices[0].message.content)
    else:
        response = google_model.generate_content(user_text)
        print(f"write_trip_title provider=gemini model={TITLE_GEMINI_MODEL}")
        print(response.text)
        dict_text = _parse_dict(response.text)

    title = (dict_text.get("title") or "").strip()
    img_id = dict_text.get("img_id")
    try:
        img_id = int(img_id) if img_id is not None else None
    except (TypeError, ValueError):
        img_id = None
    if candidate_img_ids and img_id not in candidate_img_ids:
        img_id = None

    print("AI가 돌려준 제목/이미지:", title, img_id)
    return {"title": title, "img_id": img_id}


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
