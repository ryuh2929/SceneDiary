from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers.diary import router as diary_router
from app.routers.settings import router as settings_router
from app.routers.map import router as map_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router)
app.include_router(diary_router)
app.include_router(map_router)

# 사진 정적 서빙: DB의 photos.file_url 이 "test_images/..." 형태라
# backend/test_images 폴더를 /test_images URL 로 그대로 마운트합니다.
# (file_url "test_images/a/b.jpg" → http://host:8000/test_images/a/b.jpg)
_TEST_IMAGES_DIR = Path(__file__).resolve().parent.parent / "test_images"
app.mount(
    "/test_images",
    StaticFiles(directory=str(_TEST_IMAGES_DIR)),
    name="test_images",
)

@app.get("/")
def root():
    return {"message": "hello"}
