# 일기 작성 페이지 개발 계획

## 1. 개요

### 페이지 역할
사용자가 여행 사진 여러 장을 선택하면, AI가 자동으로 일기를 생성해주고, 사용자가 그 결과를 편집해서 저장할 수 있는 페이지.

### 담당
- 페이지: 일기 작성 (Diary Write)
- 관련 소스: `frontend/src/app/diary_writring.tsx`
- 백엔드 엔드포인트: `/api/diaries/*` (예정)

### 사용 기술
| 영역 | 기술 |
|---|---|
| 프론트엔드 | Expo v55, React Native, TypeScript, NativeWind(Tailwind), Expo Router |
| 백엔드 | FastAPI, Python 3.12, SQLAlchemy |
| DB | PostgreSQL + pgvector |
| AI | OpenAI Vision (VLM) + GPT (LLM) |
| 이미지 선택 | expo-image-picker |
| 아이콘 | lucide-react-native |

---

## 2. 사용자 흐름 (User Flow)

```
[1] 사용자가 "일기 작성" 진입
        ↓
[2] 갤러리에서 사진 여러 장 선택
        ↓
[3] "AI 일기 생성" 버튼 클릭
        ↓
[4] 백엔드가 이미지를 받아 VLM으로 분석 → LLM으로 일기 텍스트 생성
        ↓
[5] 생성된 일기가 편집 화면(diary_writring.tsx)에 자동으로 채워짐
        ↓
[6] 사용자가 제목, 본문, 날짜, 여행지, 날씨 등을 수정
        ↓
[7] "저장하기" 클릭 → DB 저장
```

### 핵심 인터랙션
- **다중 사진 선택**: 한 번에 여러 장을 골라야 함 (단일 선택 X)
- **AI 생성 대기**: 보통 5~15초 걸림. 로딩 UI 필수
- **편집 가능**: 생성된 내용은 모두 사용자가 수정 가능해야 함

---

## 3. 데이터 구조 (Type Definition)

### Diary (일기 단위)
```typescript
type Diary = {
  id?: string;              // 신규 생성 시에는 없음, 저장 후 부여
  title: string;            // 제목
  location: string;         // 여행지
  date: string;             // YYYY-MM-DD
  weather: {
    condition: string;      // "맑음", "흐림", "비" 등
    temperature: string;    // "23°C" 같은 표현
  };
  mainImage: string;        // 대표 사진 URL
  content: string;          // 본문 (AI가 생성한 일기 텍스트)
  images: string[];         // 첨부 사진 URL 배열
  createdAt?: string;       // 저장 시점 (서버가 채움)
};
```

### 검토 필요 (팀 합의 후 확정)
- 현재 목업의 `days: [{ content, images }]` 구조 → 다일 여행 지원할지?
  - MVP: 단일 일자로 단순화 (`content`, `images` 직접 필드)
  - 확장 시: `days[]` 배열로 변경
- `weatherTemp` 필드를 `weather` 객체로 묶을지 분리할지

---

## 4. API 계약 (Backend Endpoints)

### 4.1 일기 생성 (AI)
**`POST /api/diaries/generate`**

요청 (multipart/form-data):
```
images: File[]    // 사용자가 선택한 사진들
```

응답 (200 OK):
```json
{
  "title": "제주도 둘째날",
  "content": "오늘은 성산일출봉에 올랐다. 바람이 제법 불었지만 ...",
  "suggestedLocation": "성산일출봉, 제주",
  "suggestedDate": "2026-05-20",
  "imageUrls": [
    "https://.../photo1.jpg",
    "https://.../photo2.jpg"
  ]
}
```

응답 (실패):
- 400: 이미지 없음/포맷 오류
- 500: AI 생성 실패

### 4.2 일기 저장
**`POST /api/diaries`**

요청 (application/json):
```json
{
  "title": "제주도 둘째날",
  "location": "성산일출봉, 제주",
  "date": "2026-05-20",
  "weather": { "condition": "맑음", "temperature": "23°C" },
  "mainImage": "https://.../photo1.jpg",
  "content": "오늘은 성산일출봉에 ...",
  "images": ["https://.../photo1.jpg", "https://.../photo2.jpg"]
}
```

응답 (200 OK):
```json
{
  "id": "uuid-...",
  "createdAt": "2026-05-20T15:30:00Z"
}
```

### 4.3 일기 조회 (편집 진입 시)
**`GET /api/diaries/{id}`** — 추후 단계에서 추가

---

## 5. 단계별 개발 계획

### 0단계 — 환경 설정

**목표**: 코드 변경이 즉시 화면에 반영되는 개발 환경 구성

**작업**
- [ ] `cd frontend && npm install` (의존성 설치)
- [ ] `npx expo start` 실행
- [ ] 웹 미리보기로 화면 띄움 (`w` 키 입력)
- [ ] 핫리로드 동작 확인 (간단한 텍스트 수정 후 자동 반영되는지)

**검증**: `diary_writring.tsx`의 텍스트를 수정하면 브라우저에서 즉시 변경이 보임

**자주 발생하는 문제**
- Expo v55 + React 19 호환성 문제 → AGENTS.md의 Expo 공식 문서 참고
- Windows에서 Watchman 설치가 없으면 핫리로드 느림 → 무시 가능

---

### 1단계 — UI 정적 변환

**목표**: 디자인팀의 React Web 목업을 React Native 코드로 변환하여 화면에 표시

**현재 상태**: `diary_writring.tsx`는 `<div>`, `<img>`, `<button>`, `<input>`, `<textarea>` 등 **HTML 태그**를 쓴 React Web 코드 (다른 디자인 도구에서 export됨)

**변환 표**

| 현재 (React Web) | 변환 후 (React Native) |
|---|---|
| `<div>` | `<View>` |
| `<header>`, `<section>` | `<View>` |
| `<img src={...} />` | `<Image source={{ uri: ... }} />` |
| `<button onClick={...}>` | `<Pressable onPress={...}>` |
| `<input type="text" value={x} onChange={(e) => ...e.target.value}>` | `<TextInput value={x} onChangeText={(t) => ...}>` |
| `<textarea>` | `<TextInput multiline>` |
| `<span>`, `<p>`, `<h1>`, `<label>` | `<Text>` |
| `lucide-react` | `lucide-react-native` |
| `className="..."` | NativeWind는 className 그대로 지원 |

**작업**
- [ ] `lucide-react-native` 설치: `npm install lucide-react-native`
- [ ] `react-native-svg` 설치 (lucide의 의존성): `npm install react-native-svg`
- [ ] `diary_writring.tsx` 상단에 컴포넌트 함수 선언 추가 (현재 `return (` 으로 시작하는 조각만 있음)
- [ ] HTML 태그를 RN 컴포넌트로 일괄 교체
- [ ] 더미 데이터를 useState로 박아두고 화면에 표시되는지 확인

**참고: 화면 구성 요소**
- 헤더 (뒤로가기, 제목, 저장 버튼)
- 요약 카드 (대표 사진 + 제목 입력)
- 정보 입력 행 (여행지, 날짜)
- 날씨 행
- 본문 (툴바 + textarea + 글자수 표시)
- 대표 사진 가로 스크롤
- 하단 고정 저장 버튼

**검증**: 화면에 목업 디자인이 그대로 보임. 입력란에 글자가 타이핑됨.

**자주 발생하는 실수**
- `style={{ ... }}` 와 `className` 혼용 시 NativeWind가 무시될 수 있음 → className 통일
- `<Text>` 안에 `<Text>`가 아닌 다른 컴포넌트 넣으면 에러 → 텍스트는 반드시 `<Text>` 직속
- `onChange={(e) => e.target.value}` 잔존 → RN에서는 `onChangeText={(text) => ...}`

---

### 2단계 — 이미지 선택 기능

**목표**: 사용자가 갤러리에서 사진 여러 장을 선택해서 화면에 표시

**작업**
- [ ] `expo-image-picker` 설치: `npx expo install expo-image-picker`
- [ ] `frontend/src/types/diary.ts` 생성 — Diary, Photo 타입 정의
- [ ] `frontend/src/components/diary/PhotoPicker.tsx` 생성 — 사진 선택 컴포넌트
- [ ] iOS/Android 권한 요청 처리 (`requestMediaLibraryPermissionsAsync`)
- [ ] 다중 선택 옵션 활성화 (`allowsMultipleSelection: true`)
- [ ] 선택된 이미지를 state에 저장하고 썸네일 그리드로 표시
- [ ] 사진 삭제 (선택 취소) 기능

**핵심 코드 패턴**
```typescript
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsMultipleSelection: true,
  quality: 0.8,
});
if (!result.canceled) {
  setImages(result.assets);
}
```

**검증**: "사진 선택" 버튼 → 갤러리 열림 → 여러 장 선택 → 화면에 썸네일이 표시됨

**자주 발생하는 실수**
- 웹에서는 `allowsMultipleSelection` 동작 방식이 다름 → 모바일 우선 테스트
- 권한 거부 시 에러 처리 누락
- `result.uri`는 deprecated, `result.assets[].uri` 사용

---

### 3단계 — Mock 데이터로 전체 흐름 시뮬레이션

**목표**: 백엔드 없이 사진 선택 → 가짜 AI 생성 → 편집 → 저장 흐름 전체를 동작시킴

**작업**
- [ ] `frontend/src/mocks/diary.ts` 생성
  - `mockGenerateDiary(images)`: 2초 대기 후 더미 일기 데이터 반환
  - `mockSaveDiary(data)`: 1초 대기 후 성공 응답
- [ ] 페이지에 로딩 상태 추가 (`isGenerating` state)
- [ ] "AI 일기 생성" 버튼 → mock 함수 호출 → 로딩 표시 → 결과 반영
- [ ] "저장하기" 버튼 → mock 함수 호출 → 성공 시 화면 닫기 or 메시지

**Mock 함수 예시**
```typescript
export async function mockGenerateDiary(images: string[]): Promise<Diary> {
  await new Promise((r) => setTimeout(r, 2000));
  return {
    title: "오늘의 여행",
    location: "어딘가",
    date: "2026-05-20",
    content: "사진 " + images.length + "장으로 만든 더미 일기...",
    weather: { condition: "맑음", temperature: "22°C" },
    mainImage: images[0],
    images,
  };
}
```

**검증**: 사진 선택 → 생성 버튼 → 로딩 보임 → 2초 후 편집 화면 자동 채워짐 → 저장 → 성공

**왜 mock 단계가 중요한가**
- 백엔드와 분리되어 UX 흐름을 먼저 검증할 수 있음
- 로딩/에러 상태 UI를 미리 만들 수 있음
- 4~5단계에서 실제 API로 교체할 때 구조 변경 없음

---

### 4단계 — 백엔드 API 계약 정의

**목표**: 프론트와 백엔드가 주고받을 데이터 형식을 코드로 확정. 백엔드는 더미 응답으로 먼저 구현.

**프론트 작업**
- [ ] `frontend/src/api/client.ts` 생성
  - baseURL (`http://localhost:8000` or env 변수)
  - 공통 헤더, 에러 처리
- [ ] `frontend/src/api/diary.ts` 생성
  - `generateDiary(images: File[])`: `POST /api/diaries/generate`
  - `saveDiary(data: Diary)`: `POST /api/diaries`

**백엔드 작업**
- [ ] `backend/app/routers/diary.py` 생성
  - `POST /api/diaries/generate` — 일단 더미 일기 반환
  - `POST /api/diaries` — 일단 더미 id 반환
- [ ] `backend/app/schemas/diary.py` 생성 — Pydantic 모델로 요청/응답 검증
- [ ] `backend/app/main.py` 수정 — 라우터 등록

**검증**:
- 프론트에서 `curl http://localhost:8000/api/diaries/generate` 호출 시 더미 응답 반환
- Pydantic 검증이 동작 (잘못된 요청 → 422 응답)

**계약 일치 체크리스트**
- [ ] `frontend/src/types/diary.ts`의 타입과 `backend/app/schemas/diary.py`의 Pydantic 모델이 1:1 대응
- [ ] 필드명, 타입, 옵셔널 여부 모두 일치

---

### 5단계 — 프론트엔드 ↔ 백엔드 연동

**목표**: 3단계의 mock 함수를 4단계의 실제 API 호출로 교체

**작업**
- [ ] 페이지에서 `mockGenerateDiary` → `api.generateDiary` 교체
- [ ] `mockSaveDiary` → `api.saveDiary` 교체
- [ ] 에러 처리 추가 (네트워크 오류, 서버 오류, 검증 오류)
- [ ] 환경 변수로 API baseURL 관리 (`process.env.EXPO_PUBLIC_API_URL` 등)

**검증**:
- 프론트 → 백엔드 → 더미 응답 → 프론트 화면 반영
- 네트워크 끊었을 때 에러 메시지 표시됨
- 백엔드 콘솔에 요청 로그 찍힘

**자주 발생하는 실수**
- CORS 설정 안 하면 웹에서 호출 차단됨 → 백엔드에 CORS 미들웨어 추가 필요
- 모바일 에뮬레이터에서 `localhost`는 본인 PC가 아님 → `10.0.2.2`(Android) 또는 `host.docker.internal`
- multipart 업로드 시 헤더 자동 설정 (axios면 FormData만 넘기면 됨)

---

### 6단계 — AI 로직 + DB 저장

**목표**: 백엔드 더미 응답을 실제 OpenAI 호출과 DB 저장으로 교체

**작업**
- [ ] `backend/app/db/session.py` — SQLAlchemy 엔진/세션 (DATABASE_URL 사용)
- [ ] `backend/app/db/models.py` — Diary 테이블 정의
- [ ] DB 마이그레이션 (수동 SQL or Alembic)
- [ ] `backend/app/services/storage.py` — 업로드 이미지 저장
  - MVP: 로컬 폴더 (`backend/uploads/`)
  - 확장: S3
- [ ] `backend/app/services/diary_generator.py`
  - OpenAI Vision API로 각 이미지 분석 → 짧은 설명 추출
  - 설명들을 합쳐서 LLM에 일기 생성 프롬프트 전달
  - 생성된 일기 텍스트 반환
- [ ] `routers/diary.py` 더미 응답 → 실제 로직 호출로 교체

**OpenAI 호출 흐름**
```
이미지 N장
  → VLM (gpt-4o vision) 으로 각 이미지 설명 생성
  → 설명들을 프롬프트로 합침
  → LLM (gpt-4o) 으로 일기 생성
  → 결과 반환
```

**검증**:
- 실제 사진으로 일기가 그럴듯하게 생성됨
- DB에 저장 후 PostgreSQL에서 SELECT로 확인 가능
- 토큰 사용량 모니터링 (비용 관리)

**자주 발생하는 실수**
- OpenAI API 키 누출 (코드에 하드코딩 X, 반드시 env)
- 이미지 크기가 너무 크면 API 호출 실패 → 업로드 시 리사이즈
- DB 마이그레이션 안 하고 코드부터 짜면 런타임 에러

---

## 6. 최종 폴더 구조

```
SceneDiary/
├── frontend/src/
│   ├── app/
│   │   └── diary_writring.tsx           # 메인 페이지 (편집 화면)
│   ├── components/
│   │   └── diary/
│   │       ├── PhotoPicker.tsx          # 사진 선택 컴포넌트
│   │       ├── SummaryCard.tsx          # 제목+썸네일 카드 (선택적 분리)
│   │       └── DiaryEditor.tsx          # 본문 편집 영역 (선택적 분리)
│   ├── types/
│   │   └── diary.ts                     # Diary, Photo 타입
│   ├── api/
│   │   ├── client.ts                    # HTTP 클라이언트 공통
│   │   └── diary.ts                     # 일기 API 함수
│   └── mocks/
│       └── diary.ts                     # mock 함수 (단계 3용, 단계 5에서 제거 가능)
│
└── backend/app/
    ├── main.py                          # 라우터 등록
    ├── routers/
    │   └── diary.py                     # /api/diaries 엔드포인트
    ├── schemas/
    │   └── diary.py                     # Pydantic 모델
    ├── services/
    │   ├── diary_generator.py           # AI 일기 생성
    │   └── storage.py                   # 이미지 저장
    └── db/
        ├── session.py                   # DB 세션
        └── models.py                    # DB 테이블 정의
```

**분리 시점 가이드**
- `components/diary/` 아래 컴포넌트들은 `diary_writring.tsx`가 200줄 넘으면 분리
- 200줄 안 넘으면 한 파일에 그대로 둬도 됨 (불필요한 추상화 피함)

---

## 7. 진행 체크포인트

각 단계 완료 시 다음을 확인하고 다음 단계로 진행:

| 단계 | 완료 기준 |
|---|---|
| 0 | 화면이 뜨고 핫리로드 동작 |
| 1 | 목업 디자인이 React Native로 보임. 입력 가능 |
| 2 | 사진 다중 선택이 동작. 썸네일 표시됨 |
| 3 | mock으로 전체 흐름 (선택→생성→편집→저장) 동작 |
| 4 | 더미 응답이지만 백엔드 API가 응답함 |
| 5 | 실제 API 호출로 흐름 동작 (백엔드 더미 응답으로) |
| 6 | 실제 사진 → 실제 AI → 실제 DB 저장 동작 |

---

## 8. 작업 시 원칙

1. **한 번에 한 단계만**: 단계를 건너뛰면 어느 부분이 망가졌는지 추적 불가
2. **검증 후 다음 단계**: 각 단계 완료 기준을 충족한 뒤에만 진행
3. **mock 활용**: 백엔드 안 되어도 프론트 작업 멈추지 않게
4. **계약 먼저**: 4단계에서 API 형식 정한 뒤에는 함부로 바꾸지 않기 (팀원 영향)
5. **타입 일치**: `types/diary.ts`(프론트)와 `schemas/diary.py`(백엔드) 항상 동기화

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-20 | 최초 작성 |
