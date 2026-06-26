from __future__ import annotations

"""
Create persona-neutral diary evaluation cases from photo_generations rows.

이 스크립트는 DB의 photo_generations.id 범위를 받아서, 사람이 모델 비교 평가에 쓸
중립 JSON 파일을 만듭니다.

중요한 점:
  - 이 파일은 학습셋을 만들지 않습니다.
  - persona, system prompt, 기존 생성 일기 결과를 넣지 않습니다.
  - 출력 JSON에는 location/date/photo_analyses와 추적용 id만 들어갑니다.
  - persona별 payload 조립은 run_pairwise_diary_eval.py가 실행 시점에 합니다.

실행 예:
  docker exec -w /app -e PYTHONPATH=/app scenediary-backend \
    python gemini-tuning/export_diary_inputs_from_photo_generations.py \
      --start-id 660 --end-id 685 \
      --output-prefix /app/gemini-tuning/eval-cases-photo-generation-660-685
"""

import argparse
import json
import os
from pathlib import Path

from sqlalchemy import create_engine, text

def build_records(start_id: int, end_id: int) -> list[dict]:
    """photo_generations 범위를 trip_day 단위 평가 케이스로 묶습니다.

    photo_generations는 사진 1장 단위 분석 결과이고, write_diary()는 하루치 사진 분석
    여러 개를 한 번에 받습니다. 그래서 photo_id -> trip_day_id를 따라가서 같은
    trip_day에 속한 분석들을 하나의 case로 그룹핑합니다.
    """
    engine = create_engine(os.environ["DATABASE_URL"])

    # 기존 ChatGPT/Gemini가 만든 일기 결과는 의도적으로 조회하지 않습니다.
    # 평가셋 원본에는 모델 출력이 섞이면 안 되고, 오직 입력 데이터만 있어야 합니다.
    sql = text(
        """
        SELECT
          pg.id AS photo_generation_id,
          pg.photo_id,
          pg.model_used AS photo_model_used,
          pg.analysis_text,
          pg.status AS photo_generation_status,
          p.display_order,
          p.original_filename,
          p.file_url,
          p.location_name,
          p.country_name,
          p.city_name,
          td.id AS trip_day_id,
          td.trip_id,
          td.day_number,
          td.date,
          td.location_summary
        FROM photo_generations pg
        JOIN photos p ON p.id = pg.photo_id
        JOIN trip_days td ON td.id = p.trip_day_id
        WHERE pg.id BETWEEN :start_id AND :end_id
        ORDER BY td.trip_id, td.day_number, p.display_order, pg.id
        """
    )

    with engine.connect() as conn:
        rows = [
            dict(row._mapping)
            for row in conn.execute(sql, {"start_id": start_id, "end_id": end_id})
        ]

    groups: dict[int, dict] = {}
    for row in rows:
        # 실패한 사진 분석이나 빈 분석은 write_diary 입력으로 쓸 수 없어 제외합니다.
        if row["photo_generation_status"] != "success" or not row["analysis_text"]:
            continue

        key = row["trip_day_id"]
        groups.setdefault(
            key,
            {
                "trip_id": row["trip_id"],
                "trip_day_id": row["trip_day_id"],
                "day_number": row["day_number"],
                "date": row["date"].isoformat(),
                "location": row["location_summary"] or "",
                "source_photo_generation_ids": [],
                "source_photo_ids": [],
                "source_photos": [],
                "_analyses": [],
            },
        )
        group = groups[key]

        # source_* 필드는 나중에 어떤 DB row에서 만들어진 평가 케이스인지 추적하기 위한 정보입니다.
        group["source_photo_generation_ids"].append(row["photo_generation_id"])
        group["source_photo_ids"].append(row["photo_id"])
        group["source_photos"].append(
            {
                "photo_generation_id": row["photo_generation_id"],
                "photo_id": row["photo_id"],
                "display_order": row["display_order"],
                "original_filename": row["original_filename"],
                "file_url": row["file_url"],
                "photo_model_used": row["photo_model_used"],
                "location_name": row["location_name"],
                "country_name": row["country_name"],
                "city_name": row["city_name"],
                "analysis_text": row["analysis_text"],
            }
        )
        group["_analyses"].append(row["analysis_text"])

    records = []
    for group in groups.values():
        # write_diary()가 받는 photo_analyses 형식과 동일하게 order를 1부터 다시 매깁니다.
        analyses = [
            {"order": index, "analysis_text": analysis}
            for index, analysis in enumerate(group.pop("_analyses"), 1)
        ]
        records.append(
            {
                "case_id": f"trip_day_{group['trip_day_id']}",
                **group,
                "photo_analyses": analyses,
            }
        )

    return records


def main() -> None:
    """CLI 인자를 받아 JSON 평가셋 파일을 생성합니다."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-id", type=int, required=True)
    parser.add_argument("--end-id", type=int, required=True)
    parser.add_argument("--output-prefix", required=True)
    parser.add_argument("--jsonl", action="store_true")
    args = parser.parse_args()

    records = build_records(args.start_id, args.end_id)
    output_prefix = Path(args.output_prefix)
    output_prefix.parent.mkdir(parents=True, exist_ok=True)
    json_path = output_prefix.with_suffix(".json")

    json_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    jsonl_path = None
    if args.jsonl:
        # 기본 목적은 JSON 평가셋이지만, 외부 배치 도구가 JSONL을 요구할 때만 선택적으로 만듭니다.
        jsonl_path = output_prefix.with_suffix(".jsonl")
        jsonl_path.write_text(
            "\n".join(json.dumps(record, ensure_ascii=False) for record in records) + "\n",
            encoding="utf-8",
        )

    print(
        json.dumps(
            {
                "record_count": len(records),
                "success_rows_used": sum(
                    len(record["source_photo_generation_ids"]) for record in records
                ),
                "trip_day_ids": [record["trip_day_id"] for record in records],
                "json": str(json_path),
                "jsonl": str(jsonl_path) if jsonl_path else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
