import os
from pathlib import Path

from google import genai
from google.genai import types


def load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

PROJECT_ID = os.getenv("GEMINI_PROJECT_ID")
LOCATION = os.getenv("GEMINI_LOCATION", "us-west1")
BASE_MODEL = os.getenv("GEMINI_BASE_MODEL", "gemini-2.5-flash-lite")


def main() -> None:
    if not PROJECT_ID:
        raise RuntimeError("GEMINI_PROJECT_ID is not set in .env")

    client = genai.Client(
        vertexai=True,
        project=PROJECT_ID,
        location=LOCATION,
    )

    response = client.models.generate_content(
        model=BASE_MODEL,
        contents="한국어로 짧은 여행 일기 한 문단을 JSON으로 써줘.",
        config=types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=500,
            response_mime_type="application/json",
        ),
    )

    print(f"project: {PROJECT_ID}")
    print(f"location: {LOCATION}")
    print(f"model: {BASE_MODEL}")
    print(response.text)


if __name__ == "__main__":
    main()
