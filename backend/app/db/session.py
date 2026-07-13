"""
DB 연결과 세션 관리를 담당하는 모듈.

이 파일이 만드는 것:
  - engine: DB로 가는 '주 연결 통로' (앱 전체에서 하나만 재사용)
  - SessionLocal: 작업할 때마다 발급받는 짧은 '대화 창'
  - Base: 모든 테이블 모델 클래스의 부모
"""

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

# ─────────────────────────────────────────────────────────
# 1. DB 접속 주소(DATABASE_URL) 읽기
# ─────────────────────────────────────────────────────────
# .env 파일에 적어둔 DATABASE_URL을 환경변수로 읽어옵니다.
# Docker가 컨테이너 시작할 때 .env 내용을 자동으로 환경변수에 주입합니다.
#
# 예: postgresql://scenediary:5433@host.docker.internal:5433/scenediary
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

# ─────────────────────────────────────────────────────────
# 2. 엔진(engine) 생성
# ─────────────────────────────────────────────────────────
# 엔진은 DB로 가는 '주 연결 통로'입니다.
# create_engine()이 내부적으로 커넥션 풀까지 만들어줘서
# 매번 새로 DB에 연결하지 않고 효율적으로 재사용합니다.
#
# (자바 비유: HikariCP 같은 커넥션 풀이 포함된 DataSource)
engine = create_engine(DATABASE_URL)

# ─────────────────────────────────────────────────────────
# 3. 세션 팩토리(SessionLocal) 만들기
# ─────────────────────────────────────────────────────────
# 세션은 DB와의 '짧은 대화 한 번'을 표현합니다.
# 보통 한 HTTP 요청에 한 세션을 만들어서 작업하고 닫습니다.
#
# 사용 예 (나중에 라우터에서):
#   db = SessionLocal()
#   try:
#       diary = db.query(Diary).first()
#   finally:
#       db.close()
#
# (자바 비유: EntityManagerFactory.createEntityManager())
SessionLocal = sessionmaker(
    autocommit=False,  # 자동 저장 안 함. 명시적으로 db.commit() 호출해야 저장됨.
    autoflush=False,   # 자동 동기화 안 함. 의도치 않은 쿼리 발생 방지.
    bind=engine,       # 어떤 엔진(=DB)에 연결할지 지정
)

# ─────────────────────────────────────────────────────────
# 4. 모델 클래스의 부모(Base) 선언
# ─────────────────────────────────────────────────────────
# 앞으로 만들 모든 테이블 클래스는 이 Base를 상속받습니다.
#
# 예 (다음 단계 models.py에서):
#   class Diary(Base):
#       __tablename__ = "diaries"
#       ...
#
# Alembic은 이 Base.metadata를 통해 "프로젝트 안에 어떤 테이블들이 있는지"
# 파악하고, 그걸 기준으로 마이그레이션 파일을 자동 생성합니다.
class Base(DeclarativeBase):
    pass

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()