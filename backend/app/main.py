from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.settings import router as settings_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router)

@app.get("/")
def root():
    return {"message": "hello"}
