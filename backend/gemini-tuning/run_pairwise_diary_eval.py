from __future__ import annotations

"""
Compare Gemini base vs DPO-tuned diary model outputs.

이 스크립트가 하는 일은 단순합니다.
1. eval-cases-*.json의 중립 입력을 읽습니다.
2. 실행 시점에 persona와 실제 앱 시스템 프롬프트를 붙입니다.
3. 같은 입력을 base 모델과 DPO 파인튜닝 endpoint에 넣습니다.
4. 두 출력을 보여주고 사람이 더 나은 쪽을 고릅니다.
5. 선택 결과와 간단한 통계를 JSON으로 저장합니다.

실행:
  cd D:\\Project\\SceneDiary\\backend
  py gemini-tuning/run_pairwise_diary_eval.py --persona daily
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

# 직접 실행해도 app.services.*를 import할 수 있게 backend 폴더를 import path에 추가합니다.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.diary_prompts import DIARY_PERSONAS, write_prompt_for_persona


def parse_json_object(raw: str) -> dict[str, Any]:
    """모델 응답에서 JSON 객체를 파싱합니다. 코드블록이 섞여도 최대한 복구합니다."""
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


def build_contents(case: dict[str, Any], persona: str) -> str:
    """실제 앱의 Gemini 호출처럼 system prompt와 user payload를 하나로 합칩니다."""
    payload = {
        "persona": persona,
        "location": case.get("location") or "",
        "date": case.get("date") or "",
        "photo_analyses": case.get("photo_analyses") or [],
    }
    user_text = (
        "다음 JSON 데이터를 바탕으로 SceneDiary 여행 일기를 작성하세요.\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )
    return f"{write_prompt_for_persona(persona)}\n\n{user_text}"


def tuned_endpoint(project_id: str, location: str, persona: str) -> str:
    """daily -> GEMINI_DAILY_ENDPOINT_ID 같은 env 값을 Vertex endpoint 이름으로 바꿉니다."""
    env_name = f"GEMINI_{persona.upper()}_ENDPOINT_ID"
    endpoint_id = (os.getenv(env_name) or "").strip()
    if not endpoint_id:
        raise RuntimeError(f"{env_name} is not set in .env")
    return f"projects/{project_id}/locations/{location}/endpoints/{endpoint_id}"


def call_model(client: genai.Client, model: str, contents: str) -> dict[str, Any]:
    """Gemini 모델을 호출하고 원문과 JSON 파싱 결과를 함께 반환합니다."""
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=700,
            response_mime_type="application/json",
        ),
    )
    raw = response.text or ""
    return {"model": model, "raw": raw, "parsed": parse_json_object(raw)}


def print_output(label: str, output: dict[str, Any]) -> None:
    """터미널에서 비교하기 좋게 subtitle/content 중심으로 출력합니다."""
    parsed = output["parsed"]
    print(f"\n===== {label} =====")
    if not parsed:
        print(output["raw"])
        return
    print(f"subtitle: {parsed.get('subtitle', '')}")
    print(f"content : {parsed.get('content', '')}")
    print(f"weather : {parsed.get('weather', '')}")
    print(f"emotion : {parsed.get('emotion', '')}")


def shuffled_order(case_id: str, persona: str) -> list[str]:
    """케이스마다 base/tuned 표시 순서를 섞되, 재실행해도 같은 순서가 나오게 합니다."""
    digest = hashlib.sha256(f"{case_id}:{persona}".encode("utf-8")).hexdigest()
    return ["base", "tuned"] if int(digest[:2], 16) % 2 == 0 else ["tuned", "base"]


def choose() -> str:
    """사람 평가 입력을 받습니다."""
    while True:
        value = input("\n선택 [1 / 2 / t=tie / q=quit] > ").strip().lower()
        if value in {"1", "2", "t", "q"}:
            return value


def summarize(evaluations: list[dict[str, Any]]) -> dict[str, Any]:
    """누적 선택 결과를 간단히 집계합니다."""
    valid = [item for item in evaluations if item["choice"] in {"base", "tuned", "tie"}]
    base = sum(item["choice"] == "base" for item in valid)
    tuned = sum(item["choice"] == "tuned" for item in valid)
    tie = sum(item["choice"] == "tie" for item in valid)
    decided = base + tuned
    return {
        "evaluated": len(valid),
        "base_wins": base,
        "tuned_wins": tuned,
        "ties": tie,
        "tuned_win_rate_excluding_ties": round(tuned / decided, 4) if decided else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--persona", default="daily", choices=sorted(DIARY_PERSONAS))
    parser.add_argument("--cases", default="gemini-tuning/eval-cases-photo-generation-660-685.json")
    parser.add_argument("--base-model", default="gemini-2.5-flash-lite")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    load_dotenv(BACKEND_DIR.parent / ".env")
    project_id = os.getenv("GEMINI_PROJECT_ID")
    location = os.getenv("GEMINI_LOCATION", "us-west1")
    if not project_id:
        raise RuntimeError("GEMINI_PROJECT_ID is not set in .env")

    cases_path = Path(args.cases)
    if not cases_path.is_absolute():
        cases_path = BACKEND_DIR / cases_path
    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    if args.limit:
        cases = cases[: args.limit]

    base_model = args.base_model
    tuned_model = tuned_endpoint(project_id, location, args.persona)
    result_path = BACKEND_DIR / "gemini-tuning" / f"pairwise-results-{cases_path.stem}-{args.persona}.json"
    results: dict[str, Any] = {
        "metadata": {
            "cases": str(cases_path),
            "persona": args.persona,
            "base_model": base_model,
            "tuned_model": tuned_model,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        "evaluations": [],
    }

    client = genai.Client(vertexai=True, project=project_id, location=location)

    for index, case in enumerate(cases, 1):
        print("\n" + "=" * 80)
        print(f"[{index}/{len(cases)}] {case['case_id']} | {case.get('date')} | {case.get('location')}")
        for analysis in case.get("photo_analyses", []):
            print(f"{analysis['order']}. {analysis['analysis_text']}")

        contents = build_contents(case, args.persona)
        outputs = {
            "base": call_model(client, base_model, contents),
            "tuned": call_model(client, tuned_model, contents),
        }

        order = shuffled_order(case["case_id"], args.persona)
        label_to_model = {"1": order[0], "2": order[1]}
        print_output("1", outputs[label_to_model["1"]])
        print_output("2", outputs[label_to_model["2"]])

        selected = choose()
        if selected == "q":
            break
        choice = "tie" if selected == "t" else label_to_model[selected]
        print(
            f"\n정답 공개: 1={label_to_model['1']} / 2={label_to_model['2']} "
            f"(선택: {choice})"
        )

        results["evaluations"].append(
            {
                "case_id": case["case_id"],
                "trip_day_id": case.get("trip_day_id"),
                "shown_order": {"1": label_to_model["1"], "2": label_to_model["2"]},
                "choice": choice,
                "base_output": outputs["base"],
                "tuned_output": outputs["tuned"],
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        results["summary"] = summarize(results["evaluations"])
        result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print("\n현재 통계")
        print(json.dumps(results["summary"], ensure_ascii=False, indent=2))

    results["summary"] = summarize(results["evaluations"])
    result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n결과 저장: {result_path}")


if __name__ == "__main__":
    main()
