# DB 환경 구성 & 버전관리 정리

작성일: 2026-05-21

이 문서는 SceneDiary의 DB 공유 환경(Docker)과 DB 버전관리(Alembic) 설정 내용을 정리한 것입니다.

---

## 1. 전체 그림

오늘 구성한 것은 크게 두 가지입니다.

- **A. DB 공유 환경** — 사용자의 DB를 팀원과 공유하고, 팀원도 같은 구조의 로컬 DB를 띄울 수 있게 함
- **B. DB 버전관리** — DB 구조 변경을 코드(마이그레이션)로 추적하고 팀원과 동기화

---

## 2. DB 공유 환경 (Docker)

### 구조

```
[사용자 PC]
  ├── scenediary-db  (메인 DB, 실제 데이터)   ← 별도 compose에서 띄움. 계속 사용.
  └── scenediary-backend                      ← 이 프로젝트 compose에서 띄움.

[팀원 PC]
  ├── scenediary-db  (자기 로컬, 빈 상태)      ← 이 프로젝트 compose에서 띄움.
  └── scenediary-backend
```

### 실행 명령

| 사람 | 명령 | 결과 |
|---|---|---|
| 사용자 | `docker-compose up backend` | backend만 실행. 기존 메인 DB 사용. |
| 팀원 | `docker-compose up` | backend + 빈 db 둘 다 실행. |

### 접속 방식 (DATABASE_URL)

- 사용자 본인: `host.docker.internal:5433` (컨테이너 → 자기 PC의 DB)
- 팀원이 사용자 DB에 접속 시: `192.168.22.54:5433` (학교 내부망 IP)
- 팀원이 자기 로컬 DB 사용 시: 자기 db 서비스

### 관련 파일

| 파일 | 역할 |
|---|---|
| `.env` | 실제 접속 정보 (git에 안 올라감) |
| `.env.example` | 팀원 배포용 템플릿 (IP만 교체) |
| `docker-compose.yml` | backend + db(PostGIS) 서비스 정의 |

---

## 3. DB 버전관리 (Alembic)

### 핵심 개념 3가지

| 개념 | 설명 | 자바 비유 |
|---|---|---|
| 모델 (models.py) | 테이블을 파이썬 클래스로 정의 | JPA `@Entity` |
| 마이그레이션 | "DB를 이렇게 바꿔라"를 담은 파일 (변경 이력) | Flyway/Liquibase 스크립트 |
| Alembic | 마이그레이션을 자동 생성·실행하는 도구 | Flyway 같은 마이그레이션 툴 |

### 구축 순서 (완료됨)

```
1. requirements.txt 에 alembic 추가
2. app/db/__init__.py, app/db/session.py 생성   (DB 연결 코드)
3. app/db/models.py 작성                          (7개 테이블 모델)
4. alembic init + alembic.ini, env.py 설정
5. env.py 에 PostGIS 보호 필터 추가
6. baseline 마이그레이션 생성 (7개 테이블 생성문)
7. alembic stamp head        (현재 DB를 시작점으로 표시)
```

### 만들어진 파일

```
backend/
├── requirements.txt          # alembic 추가됨
├── alembic.ini               # alembic 설정 (sqlalchemy.url 은 비워둠)
├── alembic/
│   ├── env.py                # DB연결 + 모델인식 + PostGIS 필터
│   └── versions/
│       └── 61a0e7f2140a_baseline_schema.py   # 7개 테이블 생성 마이그레이션
└── app/db/
    ├── __init__.py           # 빈 파일 (패키지 표시)
    ├── session.py            # engine, SessionLocal, Base
    └── models.py             # 7개 테이블 모델
```

### 7개 테이블

| 테이블 | 역할 |
|---|---|
| users | 사용자 (device_id로 식별) |
| trips | 여행 |
| trip_days | 여행의 날짜별 정보 |
| diaries | 일기 |
| photos | 사진 (EXIF·위치·썸네일 등) |
| diary_generations | 일기 AI 생성 이력 (토큰·비용 추적) |
| photo_generations | 사진 AI 분석 이력 |

관계:
```
users → trips → trip_days → diaries → diary_generations
                          → photos  → photo_generations
```

---

## 4. env.py 의 PostGIS 보호 필터 (중요)

DB에 PostGIS가 설치되어 있어 `tiger`, `topology` 스키마와 `spatial_ref_sys` 등
**우리가 만들지 않은 테이블 40여 개**가 존재합니다.

필터가 없으면 `alembic revision --autogenerate` 가 이 테이블들을 "삭제 대상"으로 잡아
**실수로 PostGIS 테이블을 전부 지우는 마이그레이션**을 만들어버립니다.

이를 막기 위해 `env.py` 에 다음 필터를 추가했습니다:

```python
def include_object(object, name, type_, reflected, compare_to):
    # 우리 모델(models.py)에 없는 테이블은 마이그레이션에서 제외
    if type_ == "table" and name not in target_metadata.tables:
        return False
    return True
```

그리고 `context.configure(...)` 두 곳에 `include_object=include_object` 를 연결했습니다.

**결론: autogenerate 는 우리 7개 테이블 변경분만 잡아냅니다.**

---

## 5. 앞으로 DB 변경하는 방법

예) `diaries` 에 컬럼 추가:

```
1. models.py 의 Diary 클래스에 컬럼 추가
2. docker exec scenediary-backend alembic revision --autogenerate -m "add xxx to diary"
3. 생성된 마이그레이션 파일 검토 (의도한 변경만 있는지 꼭 확인)
4. docker exec scenediary-backend alembic upgrade head    (실제 DB 적용)
5. 마이그레이션 파일 git 커밋
```

### 팀원이 받았을 때 (빈 로컬 DB)

```
git clone → docker-compose up → docker exec scenediary-backend alembic upgrade head
→ baseline 마이그레이션 실행 → 7개 테이블 자동 생성
```

---

## 6. 자주 쓰는 Alembic 명령

| 명령 | 의미 |
|---|---|
| `alembic current` | 현재 DB가 어느 리비전인지 확인 |
| `alembic history` | 마이그레이션 이력 보기 |
| `alembic revision --autogenerate -m "메시지"` | 변경분 자동 감지 → 마이그레이션 생성 |
| `alembic upgrade head` | 최신까지 적용 |
| `alembic downgrade -1` | 한 단계 되돌리기 |
| `alembic stamp head` | (실행 없이) 현재 DB를 최신으로 표시 |

명령은 모두 컨테이너 안에서 실행:
`docker exec scenediary-backend alembic <명령>`

---

## 7. git 에 올려야 할 것 / 올리면 안 되는 것

### 올려야 함
- `backend/alembic/` 전체 (env.py, versions/*.py)
- `backend/alembic.ini`
- `backend/app/db/` (session.py, models.py, __init__.py)
- `backend/requirements.txt`
- `docker-compose.yml`
- `.env.example`

### 올리면 안 됨
- `.env` (실제 비밀번호 포함 → .gitignore 에 이미 등록됨)

---

## 8. 트러블슈팅 기록

| 문제 | 원인 | 해결 |
|---|---|---|
| 컨테이너 2개 중복 생성 | backend의 `depends_on` 이 postgres/neo4j 자동 실행 | 불필요 서비스 제거, depends_on 삭제 |
| autogenerate가 PostGIS 테이블 삭제 시도 | 모델에 없는 테이블 = 삭제 대상으로 판단 | env.py 에 include_object 필터 추가 |
| baseline이 비어있음 | 모델과 기존 DB가 이미 일치 | 임시 빈 DB에 대고 재생성 → create_table 확보 |
| users 테이블 주석 깨짐(?????) | 인코딩 문제로 저장된 무의미 값 | 주석 제거 |
