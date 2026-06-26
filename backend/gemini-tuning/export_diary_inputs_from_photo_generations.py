from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from sqlalchemy import create_engine, text

def build_records(start_id: int, end_id: int) -> list[dict]:
    engine = create_engine(os.environ["DATABASE_URL"])
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
