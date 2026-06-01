from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers.diary import router as diary_router
from app.routers.settings import router as settings_router
from app.routers.map import router as map_router
from app.routers.home import router as home_router
from app.routers.detail import router as detail_router
from app.routers.upload import router as upload_router
from app.routers.users import router as users_router

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
app.include_router(home_router)
app.include_router(detail_router)
app.include_router(upload_router)
app.include_router(users_router)

_TEST_IMAGES_DIR = Path(__file__).resolve().parent.parent / "test_images"
app.mount(
    "/test_images",
    StaticFiles(directory=str(_TEST_IMAGES_DIR)),
    name="test_images",
)


@app.get("/")
def root():
    return {"message": "hello"}
