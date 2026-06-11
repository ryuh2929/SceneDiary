# SceneDiary

SceneDiary는 여행 사진을 기반으로 일기 초안을 생성하고, 사용자의 여행 기록을 홈/지도/상세/설정 화면에서 관리하는 모바일 앱 프로젝트입니다.

프론트엔드는 Expo, React Native, TypeScript, NativeWind v4로 구성되어 있고, 백엔드는 FastAPI와 PostgreSQL/PostGIS, Neo4j를 사용합니다. 사진 분석과 일기 생성은 Ollama의 OpenAI 호환 API를 통해 VLM/LLM 모델을 호출하는 구조이며, 여행 유형 분석은 OpenAI API를 사용합니다.

## 주요 기능

- 여행 사진 업로드 및 일차별 사진 저장
- 사진 기반 VLM 분석 결과 저장
- 사진 분석 결과를 바탕으로 일기 초안 생성
- 여행 홈 목록, 상세 일기, 지도 화면 제공
- 닉네임, 프로필 이미지, 글 작성 페르소나, 다크모드, 푸시 알림 설정
- 최근 여행 사진 분석 결과를 기반으로 여행 유형 분석
- 웹, Android, iOS 환경을 고려한 Expo 기반 모바일 UI

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Expo, React Native, TypeScript, Expo Router, NativeWind v4 |
| UI/Icon | lucide-react-native, react-native-svg, react-native-twemoji |
| State/Storage | React Context, AsyncStorage |
| Backend | FastAPI, Uvicorn, SQLAlchemy, Alembic |
| Database | PostgreSQL 16, PostGIS, Neo4j |
| AI | Ollama OpenAI 호환 API, OpenAI API |
| Infra | Docker Compose |

## 프로젝트 구조

```txt
SceneDiary/
├─ backend/                 # FastAPI 백엔드
│  ├─ app/
│  │  ├─ db/                # SQLAlchemy 모델, DB 세션, Neo4j 세션
│  │  ├─ routers/           # API 라우터
│  │  ├─ schemas/           # Pydantic 응답/요청 스키마
│  │  └─ services/          # 이미지 처리, 일기 생성, 여행 유형 분석
│  ├─ alembic/              # DB 마이그레이션
│  └─ requirements.txt
├─ frontend/                # Expo React Native 앱
│  ├─ src/
│  │  ├─ app/               # Expo Router 화면
│  │  ├─ components/        # 공통 UI 컴포넌트
│  │  ├─ contexts/          # 앱 전역 설정 상태
│  │  ├─ services/          # API 요청, UUID, 로컬 저장소
│  │  ├─ data/              # 타입 및 fallback 데이터
│  │  └─ constants/         # 색상 등 공통 상수
│  └─ package.json
├─ docs/                    # 개발 계획 및 정리 문서
├─ infra/                   # 인프라 관련 파일
├─ docker-compose.yml       # backend, PostGIS, Neo4j 실행 설정
└─ README.md
```

## 사전 준비

- Node.js 24.x
- npm 11.x
- Python 3.13.x
- Docker Desktop
- Expo Go 앱
- Ollama

프로젝트에서 사용하는 모델 기본값은 다음과 같습니다.

```txt
사진 분석/일기 생성: gemma4:e4b
여행 유형 분석: gpt-4.1-mini
```

## 환경변수

루트 경로에 `.env` 파일을 생성합니다.

```env
# PostgreSQL
POSTGRES_DB=scenediary
POSTGRES_USER=scenediary
POSTGRES_PASSWORD=your_password
POSTGRES_PORT=5433
DATABASE_URL=postgresql://scenediary:your_password@db:5432/scenediary

# Neo4j
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# AI
OPENAI_API_KEY=your_openai_api_key
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
DIARY_MODEL=gemma4:e4b
TRAVEL_STYLE_MODEL=gpt-4.1-mini

# Frontend
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_TRAVEL_ANALYSIS_COOLDOWN_SECONDS=60
```

## 실행 방법

### 1. 백엔드와 DB 실행

루트 경로에서 실행합니다.

```bash
docker compose up --build
```

이미 빌드가 끝난 뒤에는 다음 명령으로 실행할 수 있습니다.

```bash
docker compose up -d
```

백엔드만 다시 보고 싶을 때는 다음처럼 실행할 수 있습니다.

```bash
docker compose up backend
```

백엔드 API 문서는 다음 주소에서 확인합니다.

```txt
Swagger: http://localhost:8000/docs
ReDoc:   http://localhost:8000/redoc
```

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm start
```

Expo 개발 서버가 뜨면 Expo Go 앱으로 QR 코드를 스캔합니다.

웹에서 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
npm run web
```

## 주요 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/users/ensure` | 앱 시작 시 사용자 UUID 확인 및 기본 사용자 생성 |
| GET | `/settings/profile` | 설정 화면 프로필 조회 |
| PATCH | `/settings/persona` | 글 작성 페르소나 변경 |
| PATCH | `/settings/toggle` | 다크모드/푸시 알림 설정 변경 |
| PATCH | `/settings/nickname` | 닉네임 변경 |
| POST | `/settings/profile-image` | 프로필 이미지 변경 |
| POST | `/settings/travel-style-analysis` | 여행 유형 분석 요청 |
| GET | `/trips` | 홈/지도 여행 목록 조회 |
| POST | `/trips/upload-first-day` | 첫 일차 사진 업로드 |
| GET | `/trips/{trip_id}` | 일기 작성/상세 화면용 여행 데이터 조회 |
| GET | `/trips/{trip_id}/day-statuses` | 일차별 일기 생성 상태 조회 |
| PATCH | `/trip-days/{trip_day_id}` | 일차별 일기 저장/수정 |
| POST | `/trip-days/{trip_day_id}/generate` | 일차별 일기 생성 시작 |
| POST | `/trip-days/{trip_day_id}/regenerate` | 일차별 일기 재생성 |

## 프론트엔드 화면

| 경로 | 역할 |
| --- | --- |
| `frontend/src/app/(tabs)/home.tsx` | 여행 홈 목록 |
| `frontend/src/app/(tabs)/map.tsx` | 지도 화면 |
| `frontend/src/app/(tabs)/settings.tsx` | 설정 화면 |
| `frontend/src/app/add.tsx` | 여행 사진 추가 |
| `frontend/src/app/loading.tsx` | 사진 분석/일기 생성 대기 |
| `frontend/src/app/diary_writing.tsx` | 일기 작성 화면 |
| `frontend/src/app/detail.tsx` | 여행 상세 화면 |

## AI 처리 흐름

사진 기반 일기 생성은 `backend/app/services/diary_generator.py`에서 처리합니다.

```txt
사진 업로드
-> 사진별 VLM 분석 analyze_photo()
-> photo_generations 테이블에 분석 결과 저장
-> 분석 텍스트를 모아 LLM 일기 생성 write_diary()
-> diary_generations 및 trip_days에 결과 반영
```

여행 유형 분석은 `backend/app/services/travel_style_analysis.py`에서 처리합니다.

```txt
최근 여행의 photos + photo_generations 데이터 수집
-> OpenAI API로 여행 성향 분석
-> users.travel_style_analysis에 title, description, icon 저장
```

## 개발 메모

- `backend/uploads/`, `backend/test_images/`, `.env` 파일은 Git에 올리지 않습니다.
- `db`, `neo4j` 컨테이너는 restart policy가 있어 Docker Desktop 실행 시 자동으로 켜질 수 있습니다.
- `backend` 컨테이너는 `restart` 설정이 없으므로 필요할 때 직접 실행합니다.
- `expo-navigation-bar`처럼 네이티브 모듈이 있는 패키지는 APK를 새로 빌드해야 실제 앱에 포함됩니다.
- Expo Go에서는 네이티브 모듈 사용 범위에 제한이 있을 수 있습니다.
- 전체 타입 체크는 기존 `frontend/src/hooks/use-theme.ts` 타입 오류가 남아 있으면 실패할 수 있습니다.

## 자주 쓰는 명령어

```bash
# 전체 컨테이너 실행
docker compose up -d

# 전체 컨테이너 로그 확인
docker compose logs -f

# 백엔드 로그만 확인
docker compose logs -f backend

# 컨테이너 중지
docker compose down

# 볼륨까지 삭제
docker compose down -v

# 프론트엔드 실행
cd frontend
npm start

# Expo 캐시 초기화 실행
npx expo start --go --clear

# 프론트엔드 타입 체크
cd frontend
npm.cmd exec tsc -- --noEmit
```
