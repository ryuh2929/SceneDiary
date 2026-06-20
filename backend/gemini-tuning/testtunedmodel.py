from google import genai
from google.genai import types

PROJECT_ID = "project-19fbb1da-6ea1-4a56-8c1"
LOCATION = "europe-west4"
ENDPOINT_ID = "3514731854697594880"

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION,
)

model = f"projects/{PROJECT_ID}/locations/{LOCATION}/endpoints/{ENDPOINT_ID}"

response = client.models.generate_content(
    model=model,
    contents="한국어로 짧은 여행 일기 한 문단을 써줘.",
    config=types.GenerateContentConfig(
        temperature=0.7,
        max_output_tokens=500,
    ),
)

print(response.text)