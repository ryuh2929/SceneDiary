# 일기 작성 페이지 개발 계획

> 2026-05-21 팀 회의로 흐름이 크게 바뀜. 이 문서는 **새 흐름** 기준으로 재정리됨. (옛 "사진 선택→AI→단일 편집" 흐름은 폐기)

## 1. 개요

### 페이지 역할
AI가 **하루치씩 생성**하는 여행 일기를, 사용자가 **하루씩 순서대로 검토**하는 화면.
대부분 **읽기 전용**이며, 유일하게 편집 가능한 것은 **여행지(지도)** 뿐. 마지막 날에 저장하면 상세(Detail) 페이지로 이동한다.

> ⚠️ **사진 업로드·압축·Trip/trip_days 생성·생성 로딩**은 이 화면이 **아니라 앞 화면**에서 일어남 (이 문서 범위 밖, 5절 참고).

### 담당
- 페이지: 일기 작성/검토 (Diary Write)
- 관련 소스: `frontend/src/app/diary_writing.tsx`
- 저장 후 이동: `frontend/src/app/Detail.tsx`
- 백엔드 엔드포인트: `/api/...` (4절, 미확정)

### 사용 기술
| 영역 | 기술 |
|---|---|
| 프론트엔드 | Expo v55, React Native, TypeScript, NativeWind(Tailwind), Expo Router |
| 백엔드 | FastAPI, Python 3.12, SQLAlchemy |
| DB | PostgreSQL + PostGIS |
| AI | OpenAI Vision (VLM) + GPT (LLM) |
| 이모지 | react-native-twemoji (weather·emotion·symbol = Twemoji 코드포인트) |
| 아이콘 | lucide-react-native |
| 지도(예정) | Google Maps API + 현재 위치 |

---

## 2. 사용자 흐름 (User Flow)

```
[앞 화면 — 사진 업로드 / 생성 로딩]  ← 이 문서 범위 밖
  1. 사진 여러 장 업로드 → 프론트에서 VLM 적정 크기로 압축
  2. Trip 1개 생성
  3. 사진 메타데이터로 분류 → trip_days N개 생성 (이때 총 일수 N 확정)
  4. 1일차 사진 전체(최대 5장으로 제한 예정)를 백엔드 VLM이 분석 → LLM 일기 생성
       - 동시에 VLM이 사진 중 trip 전체를 대표하는 사진 1장도 선택
        ↓
[diary_writing 화면 — 여기서부터 보임]
  5. 1일차 일기 표시 (검토)
  6. 2~N일차는 백엔드에서 계속 생성 중
  7. "다음날로" 버튼 (다음날이 준비됐을 때만 활성)
       - 비활성 시 문구: "다음 추억 생성중"
       - 누르면 현재 날을 diaries 에 저장 후 다음날로 이동
  8. 마지막 날에서만 "저장하기" → trips.status = 'completed' → Detail 페이지로 이동
```

### 핵심 인터랙션 / 규칙
- **순방향 일방통행**: 자유 이동·뒤로가기·작성 중단 **없음** (프로토타입 단순화).
- **읽기 전용 검토**: 제목·소제목·본문·감정·날씨·날짜는 **표시만**.
- **유일한 편집 = 여행지(`location_summary`)**: 사진에 위치 메타데이터가 없을 수 있어, 탭하면 **현재 위치 또는 지도(Google Maps)** 에서 직접 선택.
- **점진적 생성**: 다음날 일기가 백엔드에서 완성돼야 "다음날로"가 활성화됨.
- **하루치씩 저장**: "다음날로" 누를 때 현재 날 일기를 `diaries`에 저장.
- **생성 실패한 날**: 상단 제목 + 대표사진 바만 남기고, 본문 자리에 **"일기 다시 생성하기"** 버튼 노출.

---

## 3. 화면 구성 & 데이터 매핑

### 화면 요소 → DB 컬럼

| 화면 요소 | 출처 | 범위 | 편집 |
|---|---|---|---|
| 상단 큰 제목 | `trips.title` | 여행 전체(매 페이지 동일) | 읽기전용 |
| 상단 좌측 대표사진 | trip 대표사진 (`trips.trip_represent_image` *추가 예정*) — VLM이 선택 | 여행 전체(매 페이지 동일) | 읽기전용 |
| 소제목 | `trip_days.subtitle` | 날마다 | 읽기전용 |
| 여행지 | `trip_days.location_summary` | 날마다 | **편집 O (지도)** |
| 날짜 | `trip_days.date` | 날마다 | 읽기전용 (`YYYY.MM.DD (요일)`) |
| 날씨 아이콘 | `trip_days.weather` (Twemoji 코드포인트) | 날마다 | 읽기전용 |
| 감정 이모지 | `trip_days.emotion` (Twemoji 코드포인트) | 날마다 | 읽기전용 |
| 상징 이모지 | `diaries.symbol` (Twemoji 코드포인트) | 날마다 | 읽기전용 |
| 본문(+글자수) | `diaries.content` | 날마다 | 읽기전용 (글자수 표시 유지) |
| 하단 "대표 사진" 바 | 그날 `photos[].thumbnail_url` 만 (개수 고정, **+버튼 없음**) — 그날 다이어리용 사진들 | 날마다 | 읽기전용(표시만) |

### 타입 스케치 (2단계에서 `frontend/src/types/diary.ts`로 분리)
```typescript
// 여행 전체 (모든 페이지 공통)
type TripDiary = {
  tripId: number;          // trips.id
  title: string;           // trips.title — 매 페이지 동일
  representImage: string;  // trips.trip_represent_image — VLM이 고른 trip 대표사진(매 페이지 동일)
  status: string;          // trips.status — 최종 저장 시 'completed'
  days: DayPage[];         // 길이 = N (총 일수)
};

// 하루치 = trip_day + 그날 diary (페이지 1장)
type DayPage = {
  tripDayId: number;       // trip_days.id
  dayNumber: number;       // trip_days.day_number (1..N)
  date: string;            // trip_days.date "YYYY-MM-DD"
  locationSummary: string; // trip_days.location_summary — ✏️ 편집 가능
  weather: string;         // trip_days.weather — Twemoji 코드포인트(hex) → 이모지
  subtitle: string;        // trip_days.subtitle
  emotion: string;         // trip_days.emotion — Twemoji 코드포인트(hex)
  symbol: string;          // diaries.symbol — Twemoji 코드포인트(hex)
  content: string;         // diaries.content — 본문
  photos: { id: number; thumbnailUrl: string; fileUrl: string }[]; // 그날 다이어리용 사진들
  genStatus: 'ready' | 'generating' | 'failed'; // 프론트 표시용 생성 상태
};
```

### 페이지 상태 3가지
- **ready(정상)**: 전체 표시
- **generating(생성중)**: 진입 불가 (이전 날의 "다음날로"가 비활성, 문구 "다음 추억 생성중")
- **failed(실패)**: 제목 + 대표사진 바만, 본문 자리에 "일기 다시 생성하기"

---

## 4. API 계약 (미확정 — 4단계에서 코드로 확정)

새 흐름에 맞춰 대략 다음이 필요. (필드/경로는 4단계에서 Pydantic ↔ TS 타입으로 1:1 확정)

- **(앞 화면) 업로드/생성 시작**: 사진 업로드 → Trip + trip_days 생성 트리거
- **생성 상태 폴링**: 각 trip_day의 `genStatus`(생성중/완료/실패)를 주기적으로 조회 → "다음날로" 활성화 판단
- **일차 일기 조회**: 특정 trip_day의 일기/사진 묶음 조회
- **일차 저장(PATCH)**: 현재 날 일기(주로 `location_summary`) 저장
- **일차 재생성**: 실패한 날 다시 생성 요청
- **최종 저장**: `trips.status = 'completed'` 로 변경

> 폴링 vs 푸시(WebSocket/SSE)는 4단계에서 결정. 프로토타입은 폴링으로 충분.

---

## 5. 단계별 개발 계획 (이 화면 기준)

### 0단계 — 환경 설정 ✅ 완료
- `npx expo start` → `w` 웹 미리보기, 핫리로드 동작 확인.

### 1단계 — UI 정적 변환 ✅ 완료 (2026-05-21)
디자인팀 최종 목업을 React Native로 변환해 화면에 표시. **단, 입력 가능한 편집형으로 만들어서 2단계에서 읽기 전용으로 전환 필요.**

**HTML → RN 변환표**
| React Web | React Native |
|---|---|
| `<div>` / `<header>` | `<View>` |
| `<img src>` | `<Image source={{uri}}>` (expo-image) |
| `<button onClick>` | `<Pressable onPress>` |
| `<input>` / `<textarea>` | `<TextInput>` (multiline) |
| `<span>`/`<h1>`/`<label>` | `<Text>` |
| `lucide-react` | `lucide-react-native` |

**색/폰트 매핑** (목업 색이 프로젝트에 없어 팀 토큰으로 매핑, 공유 `tailwind.config.js`는 미수정)
| 목업 | 매핑 |
|---|---|
| `text-cobalt-950` | `text-textPrimary` (#152538) |
| `text-cobalt-400/800` | `text-textSecondary` (#39536B) |
| `text-[#6366f1]` | `text-primary` (#5B7DBB) |
| `bg-[#f8f9fc]` | `bg-background` (#F4F6F9) |
| `font-diary` | `font-sans` (GowunDodum) |

**이모지**: `weather`·`emotion`·`symbol`은 Twemoji 코드포인트(hex)로 저장 → `codepointToEmoji()`로 변환 후 `<Twemoji style={{width,height}}>`로 렌더(이 라이브러리는 `size` prop 없음). 미지원 이모지(예: 🥹 `1f979`)는 시스템 이모지로 자동 대체.

> 참고: 1단계 코드는 `weather`를 문자열→lucide 아이콘으로 매핑했음. 2단계에서 **Twemoji 코드포인트 방식으로 교체** 필요.

### 2단계 — 새 흐름에 맞춰 화면 재구성 ⬅ **다음 작업**
**목표**: 1단계의 편집형 화면을 "읽기 전용 일차별 검토 뷰어"로 전환 (mock 데이터).

- [ ] 헤더 **뒤로가기 버튼 제거** (제목만 가운데)
- [ ] 제목·소제목·본문을 **읽기 전용(Text)** 으로 전환 (본문 글자수 표시는 유지)
- [ ] 감정·상징·**날씨**를 Twemoji 이모지로 표시 (날씨는 1단계의 lucide 매핑을 Twemoji 코드포인트로 교체)
- [ ] 여행지 칸은 편집 진입점으로 유지 (지도 피커는 자리만, 실제 연결은 후속)
- [ ] 하단 "대표 사진" 바: **그날 사진들만 표시**(읽기전용), **+버튼 제거**
- [ ] 상단 좌측 대표사진 = VLM이 고른 **trip 대표사진**(읽기전용, 매 페이지 동일). DB 컬럼(`trips.trip_represent_image`) 추가 전엔 첫 사진 사용
- [ ] 하단 버튼 3상태: **"다음날로"**(다음날 ready 시 활성) / **"다음 추억 생성중"**(비활성+스피너) / 마지막날 **"저장하기"**
- [ ] **실패 상태 UI**: 제목+대표사진바 + "일기 다시 생성하기"
- [ ] 타입을 `frontend/src/types/diary.ts`로 분리 (`TripDiary`, `DayPage`)
- [ ] 일차 배열·생성상태는 **mock**으로 (아직 백엔드 없음)

**검증**: mock N일치 데이터로 화면이 일차별로 보이고, 버튼 상태가 ready/generating/마지막날에 따라 바뀜.

### 3단계 — Mock 전체 흐름
- [ ] mock에서 2~N일차 `genStatus`가 **시간차로 ready 되도록** 시뮬레이션 (setTimeout)
- [ ] "다음날로"로 순차 진행 → 현재 날 저장(mock) → 마지막 "저장하기" → Detail 이동
- [ ] 생성중 대기 / 실패→재생성 흐름 검증

### 4단계 — 백엔드 API 계약 정의
- [ ] 4절의 엔드포인트를 Pydantic(`schemas/`) ↔ TS(`types/diary.ts`) 1:1로 확정
- [ ] 백엔드는 더미 응답으로 먼저 구현, 폴링 경로 포함

### 5단계 — 프론트 ↔ 백엔드 연동
- [ ] mock → 실제 API 교체, 에러 처리, baseURL 환경변수

### 6단계 — AI 로직 + DB 저장
- [x] `backend/app/db/session.py`, `models.py`(7개 모델), Alembic baseline ✅ 완료 (`docs/plans/db-setup.md`)
- [ ] **`trip_days.represent_image` 컬럼 추가** → `models.py` + Alembic 마이그레이션 (6절 참고)
- [ ] `services/storage.py`(이미지 저장), `services/diary_generator.py`(VLM→LLM)
- [ ] 일차별 생성/저장 라우터 실제 로직 연결

---

## 6. 미해결 / 분리 작업 (이 화면 밖이지만 연관)

- **[DB] `trips.trip_represent_image` 컬럼 추가** — VLM이 고른 trip 대표사진(상단 좌측, 매 페이지 동일) 저장용. 컬럼 없으면 UI는 "첫 사진"을 대표로 사용. *(DB 담당 본인 작업: models.py 수정 → Alembic revision)*
- **[앞 화면] 사진 업로드 + 압축 + Trip/trip_days 생성 + 생성 로딩** — 별도 화면/라우트. 이 화면은 그 결과(`TripDiary`)를 받아 시작.
- **[지도] 여행지 피커** — Google Maps + 현재 위치. 이 화면의 유일한 편집 기능.
- **[정정] `models.py`의 `trips.status` 주석** — `'draft'/'published'`로 적혀 있으나 실제 테스트 데이터 값은 **`'completed'`**. 나중에 주석만 맞추면 됨.

---

## 7. 진행 체크포인트

| 단계 | 완료 기준 | 상태 |
|---|---|---|
| 0 | 화면이 뜨고 핫리로드 동작 | ✅ |
| 1 | 목업 디자인이 React Native로 보임 | ✅ |
| 2 | 읽기전용 일차별 뷰어 + 버튼 3상태/실패상태 (mock) | ⬜ 다음 |
| 3 | mock으로 전체 흐름 (일차 순차→저장→Detail) 동작 | ⬜ |
| 4 | 더미 응답이지만 백엔드 API가 응답함 | ⬜ |
| 5 | 실제 API 호출로 흐름 동작 | ⬜ |
| 6 | 실제 사진 → 실제 AI → 실제 DB 저장 동작 | ⬜ (DB 모델·마이그레이션은 완료) |

---

## 8. 작업 시 원칙
1. **한 번에 한 단계만** — 단계를 건너뛰면 추적 불가
2. **검증 후 다음 단계**
3. **mock 활용** — 백엔드 없이 프론트 흐름 먼저 검증
4. **계약 먼저** — 4단계에서 API 형식 정한 뒤 함부로 변경 금지(팀원 영향)
5. **타입 일치** — `types/diary.ts`(프론트) ↔ `schemas/`(백엔드) 동기화

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-05-20 | 최초 작성 |
| 2026-05-21 | 현재 상태 반영 — 파일명 정정, 1단계 완료, 색/폰트 매핑표, 6단계 DB 완료 표시 |
| 2026-05-21 | **흐름 전면 개편** — 팀 회의 반영. "사진선택→AI→단일편집"에서 **"AI가 하루치씩 생성, 사용자가 순방향으로 하루씩 검토(읽기전용, 여행지만 편집), 마지막날 저장→Detail"** 로 변경. 데이터 매핑을 실제 DB 컬럼 기준으로 재정리, API 계약·개발 단계 재작성, 미해결 작업 정리 |
| 2026-05-21 | 정정 — ①날씨도 Twemoji 코드포인트(문자열→lucide 아님), ②1일차 사진 전체(최대 5장) VLM 분석, ③상단 좌측 대표사진은 VLM이 고른 **trip** 대표사진(`trips.trip_represent_image` 추가, 하단 일자별 사진 바와 별개) |
