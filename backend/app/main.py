from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers.diary import router as diary_router
from app.routers.settings import router as settings_router
from app.routers.map import router as map_router

from fastapi.staticfiles import StaticFiles
import os

from app.routers.home import router as home_router
from app.routers.detail import router as detail_router
from app.routers.upload import router as upload_router
app = FastAPI()
# main.py에서 한 단계 상위로 올라간 후 test_images로 진입
# __file__은 현재 파일의 경로를 의미합니다.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(BASE_DIR, "test_images")

# 정적 파일 마운트
app.mount("/images", StaticFiles(directory=IMAGE_DIR), name="images")

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
app.include_router(home_router)
app.include_router(detail_router)
app.include_router(upload_router)

# 사진 정적 서빙: DB의 photos.file_url 이 "test_images/..." 형태라
# backend/test_images 폴더를 /test_images URL 로 그대로 마운트합니다.
# (file_url "test_images/a/b.jpg" → http://host:8000/test_images/a/b.jpg)
_TEST_IMAGES_DIR = Path(__file__).resolve().parent.parent / "test_images"
app.mount(
    "/test_images",
    StaticFiles(directory=str(_TEST_IMAGES_DIR)),
    name="test_images",
)

# 업로드 사진 정적 서빙: upload 라우터가 backend/uploads/ 아래에 저장한 파일을
# 클라이언트가 /uploads URL 로 받아갈 수 있도록 마운트합니다. 폴더가 없으면 생성.
_UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/uploads",
    StaticFiles(directory=str(_UPLOADS_DIR)),
    name="uploads",
)

@app.get("/")
def root():
    return {"message": "hello"}