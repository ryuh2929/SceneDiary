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

# 환경변수로 덮어쓸 수 있게(없으면 로컬 Ollama 기본값).
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
DIARY_MODEL = os.getenv("DIARY_MODEL", "gemma4:e4b")
TITLE_MODEL_PROVIDER = os.getenv("TITLE_MODEL_PROVIDER", "gemini").strip().lower()
TITLE_MODEL = os.getenv("TITLE_MODEL", DIARY_MODEL)
TITLE_GEMINI_MODEL = os.getenv("TITLE_GEMINI_MODEL", "models/gemini-3.1-flash-lite")

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
_WRITE_PROMPT = """당신은 여행 사진 분석 결과를 보고 한국어 여행 일기를 쓰는 작가입니다.
아래는 같은 날 찍은 사진들을 분석한 결과입니다. 사진을 직접 보지는 못하지만,
이 분석들을 종합해 그 날의 분위기·장소·감정을 담아 일기를 만드세요.
반드시 아래 JSON 형식으로만, 다른 말 없이 답하세요.

[subtitle 규칙]
1. 구체성: 여행지에서 먹은 음식, 본 풍경, 했던 경험 등 구체적인 소재를 반드시 하나 포함할 것.
2. 말투: 친구에게 무심하게 한마디 툭 던지는 듯한 일상적인 구어체 사용. (예: "~하는 길에", "~에서 찾은", "~ 생각보다 좋음")
3. 감성 금지: '낭만', '심장', '영원히', '눈부신', '잊지 못할' 같은 지나치게 감성적인 단어는 절대 사용하지 말 것.
4. 길이: 공백 포함 25자 이내로 짧고 간결하게 작성할 것.
5. 너는 20대 여행자의 일기장을 보고, 가장 자연스러운 한 줄 제목을 뽑아내는 에디터야.

{
  "subtitle": "여행자가 친구에게 말하듯 간결하게 작성할 것",
  "content": "3~5문장의 평범한 일상을 적는 인스타 감성으로 한국어 일기 본문",
  "weather": "분석 결과의 날씨를 나타내는 날씨 이모지 1개(예: ☀️ ⛅ ☁️ 🌧️ ❄️). 날씨를 알 수 없으면 빈 문자열",
  "emotion": "그 날의 감정을 나타내는 이모지 1개"
}"""

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
    print(f"analyze_photo 사용한 모델: {resp.model}")
    parsed = _parse_dict(resp.choices[0].message.content)

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
    print(resp.choices[0].message.content)

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
    f"다음은 같은 날 찍은 사진들의 분석 내용이야:\n{joined}{hint}\n\n"
    "이 분석 내용을 바탕으로 하루의 기록을 일기 형식으로 작성해 줘.\n\n"
    "주의사항:\n"
    "- 지역 이름(동네 이름 등)을 일일이 나열하지 말고, 장소의 느낌 위주로 서술해.\n"
    "- '한국식' 같은 불필요한 수식어는 빼고, 일기 본연의 개인적인 감상과 느낌을 중심으로 작성해.\n"
    "- 마치 오늘 하루를 되돌아보는 것처럼 편안하고 자연스러운 구어체 말투로 써 줘.\n"
    "- 사진 속 상황을 묘사할 때, 마치 그 자리에 있었던 것처럼 생생하게 느껴지도록 작성해."
)

    resp = _client.chat.completions.create(
        model=DIARY_MODEL,
        messages=[
            {"role": "system", "content": _WRITE_PROMPT},
            {"role": "user", "content": user_text},
        ],
        response_format={"type": "json_object"},  # JSON 으로 받기(프롬프트와 이중 안전장치)
        temperature=0.2,
    )
    print(f"write_diary 사용한 모델: {resp.model}")
    parsed = _parse_dict(resp.choices[0].message.content)

    return {
        "subtitle": (parsed.get("subtitle") or "").strip(),
        "content": (parsed.get("content") or "").strip(),
        "weather": _emoji_to_codepoint(parsed.get("weather", "")),
        "emotion": _emoji_to_codepoint(parsed.get("emotion", "")),
    }


def _write_trip_title_legacy(
    days: list[dict], *, destination: str = "", path_list: list[Path], photo_info:list[dict]
) -> dict:
    """[3단계 · LLM] 모든 일차의 (subtitle, content 요약) 을 보고 여행 제목 한 줄을 만듭니다.

    days : [{"subtitle": str, "content_excerpt": str}, ...] (일차 순서대로)
    destination : trips.destination (예: "일본/도쿄"). 비어있어도 됨.
    반환 : 제목 문자열. 모델 실패 시 빈 문자열.
    """
    if not days:
        return ""

    # 일차별 한 줄 요약을 만들어 모델 입력으로 합칩니다.
    lines = []
    for i, d in enumerate(days, 1):
        sub = (d.get("subtitle") or "").strip()
        excerpt = (d.get("content_excerpt") or "").strip()
        lines.append(f"{i}일차 [{sub}]: {excerpt}")
    joined = "\n".join(lines)
    hint = f"\n참고: 여행지='{destination}'." if destination else ""
    
    
    photo_id_text = [path['img_id'] for path in photo_info]
    print("AI한테 보내는 사진 아이디들:",photo_id_text)
    user_text = (
        f"""이미지 리스트랑 img_id를 알려주면 그 중에서 메인으로 사용할 사진을 한 장만 선택해서 img_id만 형식에 맞게 알려줘\n
        사진 선택할 때는 임팩트 있는 걸로 선택하되 순서 상관없이 골라줘
        {photo_id_text}"""
    )
    
    encoded_images = [get_gemini_image_blob(Path(path['file_url'])) for path in photo_info]

    # 2. 메시지 구성 (기본 텍스트 포함)
    message_content = [{"type": "text", "text": user_text}]

    # 3. 이미지들을 하나씩 별도의 객체로 추가
    for url in encoded_images:
        message_content.append({
            "type": "image_url",
            "image_url": {"url": url}
        })

    # 4. API 호출
    # resp = _client.chat.completions.create(
    #     model=DIARY_MODEL,
    #     messages=[
    #         {"role": "system", "content": _TITLE_PROMPT},
    #         {"role": "user", "content": message_content} # 위에서 만든 리스트를 통째로 전달
    #     ],
    #     response_format={"type": "json_object"},
    #     temperature=0.2,
    # )
    
    if TITLE_MODEL_PROVIDER in {"openai", "chatgpt", "gpt"}:
        openai_images = [
            {
                "type": "image_url",
                "image_url": {"url": _encode_image(Path(path["file_url"]))},
            }
            for path in photo_info
        ]
        resp = _client.chat.completions.create(
            model=TITLE_MODEL,
            messages=[
                {"role": "system", "content": _TITLE_PROMPT},
                {
                    "role": "user",
                    "content": [{"type": "text", "text": user_text}] + openai_images,
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        print(f"write_trip_title provider=openai model={resp.model}")
        dict_text = _parse_dict(resp.choices[0].message.content)
    else:
        response = google_model.generate_content([_TITLE_PROMPT+"\n"+user_text] + encoded_images)
        print(f"write_trip_title provider=gemini model={TITLE_GEMINI_MODEL}")
        print(response.text)
        dict_text = _parse_dict(response.text)
    print("AI가 돌려준 이미지 번호",dict_text.get("img_id"))
    return dict_text


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
            {"img_id": item.get("img_id")}
            for item in candidate_photos
            if item.get("img_id") is not None
        ],
    }

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

    if TITLE_MODEL_PROVIDER in {"openai", "chatgpt", "gpt"}:
        openai_images = [
            {
                "type": "image_url",
                "image_url": {"url": _encode_image(Path(item["file_url"]))},
            }
            for item in candidate_photos
            if item.get("file_url")
        ]
        resp = _client.chat.completions.create(
            model=TITLE_MODEL,
            messages=[
                {"role": "system", "content": "너는 SceneDiary 여행 제목 생성 모델이다. JSON만 응답한다."},
                {
                    "role": "user",
                    "content": [{"type": "text", "text": user_text}] + openai_images,
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        print(f"write_trip_title provider=openai model={resp.model}")
        dict_text = _parse_dict(resp.choices[0].message.content)
    else:
        encoded_images = [
            get_gemini_image_blob(Path(item["file_url"]))
            for item in candidate_photos
            if item.get("file_url")
        ]
        response = google_model.generate_content([user_text] + encoded_images)
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
