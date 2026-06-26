import os

from dotenv import load_dotenv
from google import genai
from google.genai import types


load_dotenv()

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
