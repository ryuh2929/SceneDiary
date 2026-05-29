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
| 상단 좌측 대표사진 | trip 대표사진 (`trips.cover_photo_id` — VLM이 선택, 새 컬럼 불필요) | 여행 전체(매 페이지 동일) | 읽기전용 |
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
  representImage: string;  // trips.cover_photo_id가 가리키는 사진 URL — VLM이 고른 trip 대표(매 페이지 동일)
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

### 2단계 — 새 흐름에 맞춰 화면 재구성 ✅ 완료 (2026-05-21)
**목표**: 1단계의 편집형 화면을 "읽기 전용 일차별 검토 뷰어"로 전환 (mock 데이터).

- [x] 헤더 **뒤로가기 버튼 제거** → 일차 표시("N일차 · 총 M일")로 교체
- [x] 제목·소제목·본문을 **읽기 전용(Text)** 으로 전환 (본문 글자수 표시는 유지)
- [x] 감정·상징·**날씨**를 Twemoji 이모지로 표시 (날씨를 lucide → Twemoji 코드포인트로 교체). `EmojiIcon`에 빈 문자열 가드 추가(symbol 미설정 대비)
- [x] 여행지 칸은 편집 진입점으로 유지 (`Pressable`+지도핀, 지도 피커는 stub `handleEditLocation`)
- [x] 하단 "대표 사진" 바: **그날 사진들만 표시**(읽기전용), **+버튼 제거**
- [x] 상단 좌측 대표사진 = VLM이 고른 **trip 대표사진**(읽기전용, 매 페이지 동일). 기존 `trips.cover_photo_id` 사용(새 컬럼 불필요)
- [x] 하단 버튼 3상태: **"다음날로"**(다음날 ready 시 활성) / **"다음 추억 생성중"**(비활성+스피너) / 마지막날 **"저장하기"**
- [x] **실패 상태 UI**: 제목+대표사진바 + "일기 다시 생성하기" (+ generating 진입 시 방어용 스피너)
- [x] 타입을 `frontend/src/types/diary_writing.ts`로 분리 (`TripDiary`, `DayPage`, `DayPhoto`, `GenStatus`)
- [x] mock 데이터 `frontend/src/data/diary_writing.ts` — **실제 DB trip 1(5일치) 전사** (settings.ts 방식)

> mock 메모: weather는 실제 한글값을 코드포인트로 변환해 넣음(원본 주석). symbol은 DB가 비어 빈 문자열. 사진 URL은 `test_images/...` 로컬 경로라 안 열려 picsum placeholder 사용(id·개수·순서는 실제). 전부 ready라, 생성중/실패는 4·5일차 genStatus를 잠깐 바꿔 확인.

**검증**: ✅ mock 5일치로 화면이 일차별로 보이고, "다음날로"로 1→5 진행, 마지막날 "저장하기", genStatus 토글로 생성중/실패 화면 확인. tsc 통과.

### 3단계 — Mock 전체 흐름 ✅ 완료 (2026-05-22)
- [x] mock에서 2~N일차 `genStatus`가 **시간차로 ready 되도록** 시뮬레이션 (setTimeout) — `days`를 `useState`로 들고, 1일차만 ready·나머지 generating으로 시작. 현재 날에 도착하면 `useEffect`가 다음 날을 3초 뒤 ready로 전환.
- [x] "다음날로"로 순차 진행 → 현재 날 저장(mock, `console.log`) → 마지막 "저장하기" → `router.push('/Detail')` 이동
- [x] 생성중 대기 / 실패→재생성 흐름 검증 — `handleRegenerate`가 그 날을 generating→3초→ready로. (실패 화면은 1일차 mock `genStatus`를 잠깐 `'failed'`로 바꿔 확인 후 원복)

> 메모: Detail 이동은 **이동만**(`router.push('/Detail')`) — 우리 `TripDiary`→Detail params(`id/title/details` 등) 매핑은 5단계(API 연동)로 분리. 정식 경로는 `/Detail`(대문자) — 기존 `Home.tsx`는 `/detail` 소문자로 써서 타입 에러가 나 있음(이 화면 밖, 별도 정정 대상).

### 4단계 — 백엔드 API 계약 정의 ✅ 완료 (2026-05-22)
- [x] 응답 스키마를 Pydantic으로 확정 (`schemas/diary.py`) — `GenStatus`, `DayPhoto`, `DayPage`, `TripDiary`. 프론트 `types/diary_writing.ts`와 1:1. 필드명은 카멜케이스로 통일(settings.py 관습).
- [x] 요청/상태 스키마 — `DayStatus`(폴링), `DayUpdate`(여행지 저장 body), `TripStatusUpdate`(최종 저장 body).
- [x] 라우터 6개 + 더미 응답 (`routers/diary.py`), `main.py` 등록. TestClient로 6개 + 404 검증.
- [ ] **요청/상태 TS 타입**(DayStatus/DayUpdate/TripStatusUpdate)은 5단계(API 클라이언트 작성) 때 추가 — 응답 타입은 이미 1:1.

> **확정된 엔드포인트** (업로드/생성 시작 ①은 앞 화면 담당이라 제외 — 6절):
> | # | 메서드 · 경로 | 요청 | 응답 | 비고 |
> |---|---|---|---|---|
> | 여행 전체 조회 | `GET /trips/{trip_id}` | — | `TripDiary` | 진입 시 N일치 한 번에 |
> | 상태 폴링 | `GET /trips/{trip_id}/day-statuses` | — | `list[DayStatus]` | 가벼운 상태만 |
> | 일차 조회 | `GET /trip-days/{trip_day_id}` | — | `DayPage` | ready된 날 본문 재조회 |
> | 일차 저장 | `PATCH /trip-days/{trip_day_id}` | `DayUpdate` | `DayPage` | 여행지만 (지도 좌표는 추후) |
> | 재생성 | `POST /trip-days/{trip_day_id}/regenerate` | — | `DayStatus` | 더미는 즉시 generating |
> | 최종 저장 | `PATCH /trips/{trip_id}` | `TripStatusUpdate` | `TripStatusUpdate` | status='completed' |
>
> 폴링 방식 채택(푸시 아님 — 프로토타입엔 충분). genStatus 출처 = 최신 `diary_generations.status` 번역(success→ready 등), 실제 번역·DB 조회·사진 id→URL 변환은 6단계.

### 5단계 — 프론트 ↔ 백엔드 연동 ✅ 완료 (2026-05-23)
작은 단계로 쪼개 진행, 각 단계 tsc + 실제 서버로 검증.
- [x] 5-1 — API 클라이언트 `services/diary-api.ts`(호출 함수 6개 + 공통 `request<T>` 헬퍼, baseURL은 settings-api 방식 재사용) + 요청/상태 TS 타입 3개(`DayStatus/DayUpdate/TripStatusUpdate`) 추가
- [x] 5-2 — 초기 데이터 mock → `GET /trips/1` fetch. `trip`/`loading`/`error` 상태 + 진입 시 useEffect, 로딩/에러 화면 분기
- [x] 5-3 — 가짜 `setTimeout` → 실제 폴링(`setInterval`로 `day-statuses` 3초마다) + ready 전환 시 `GET /trip-days/{id}`로 본문 채우기. **백엔드 더미를 "시간차"로** 수정(`_gen_status`/`_day_view`, `GET /trips` 진입 시 타이머 리셋)
- [x] 5-4 — 핸들러를 실제 호출로: `handleNext`=`saveDayLocation`(PATCH), `handleSave`=`completeTrip`(PATCH)→Detail, `handleRegenerate`=`regenerateDay`(POST)
- [x] 5-5 — 에러 처리: 로딩 실패 시 "다시 시도" 버튼(`loadTrip` 분리), 액션 실패 시 하단 `actionError` 안내(`text-error`), **성공해야** 진행/이동. Alert 대신 화면 내 상태(웹 안정성·팀 관습)

> 메모: baseURL은 `EXPO_PUBLIC_API_BASE_URL`(없으면 실기기 hostUri:8000 / 웹 localhost:8000). mock 파일 `data/diary_writing.ts`는 5-2부터 미사용(정리 대상). 시간차 더미·타이머 리셋은 데모용 — 6단계에서 실제 DB 상태 조회로 교체.

### 6단계 — AI 로직 + DB 저장 ✅ 핵심 완료 (2026-05-24)
작은 단계로 진행. 6-1~6-4 완료 → "사진→AI→DB→화면" 전체 동작. (남은 건 후속 고도화)
- [x] `backend/app/db/session.py`, `models.py`(7개 모델), Alembic baseline ✅ 완료 (`docs/plans/db-setup.md`)
- [x] **6-1** 읽기 엔드포인트 → 실제 DB 조회 (`routers/diary.py`). 더미 제거, `Depends(get_db)`로 trips→trip_days→(diaries,photos) 조회. genStatus=일기 본문 유무(임시). weather 한글→코드포인트 방어 변환.
- [x] **6-2** 사진 정적 서빙 — `backend/test_images`를 `/test_images`로 마운트(`main.py`), `file_url`/`thumbnail_url`/대표사진을 요청 host 기준 절대 URL로(한글 파일명 인코딩).
- [x] **6-3** 생성기 `services/diary_generator.py` — Ollama `gemma4:e4b`(vision) 멀티모달로 하루 사진→일기 JSON(subtitle/content/emotion/symbol). openai SDK를 `/v1`에 연결(swappable). 이모지→코드포인트 변환. **실측 검증**(사진1장 ~15초, JSON·이모지 정상).
- [x] **6-4** 재생성을 **백그라운드**(FastAPI BackgroundTasks)로 실행 → 결과를 `diaries`(content/symbol/word_count/generated_at)·`trip_days`(subtitle/emotion)에 저장 → 폴링이 generating→ready 반영. genStatus를 **최신 `diary_generations.status` 번역**으로 정교화(running→generating/failure→failed/success→ready). 콘솔 로그 `[diary-gen] start/done`. **실측 검증**(2·3·4일차 생성, 11~27초, 동시 작업 OK).
- [x] **id 자동증가 마이그레이션** — 7개 테이블 PK가 자동증가 없는 BigInteger라 INSERT 시 NULL 위반. `f3a9c1d4b2e6`로 전 테이블에 IDENTITY 추가 + 시퀀스를 max(id) 다음으로. (`alembic.ini` 한글 주석→영문: cp949 디코드 에러 회피)
- [x] `trip_days.represent_image` 컬럼 추가 — 마이그레이션 완료(`docs/plans/db-setup.md` 이력)
- [x] (후속) **2단계화** (2026-05-24) — `diary_generator`를 `analyze_photo`(VLM, 사진별 객관 분석→`photo_generations` 저장·재사용 캐시) + `write_diary`(LLM, 분석글→일기)로 분리. 같은 모델(gemma4:e4b)로 구조만 2단계화. 라우터 백그라운드가 두 단계를 직접 호출
- [x] (후속) **weather 코드포인트 통일** (2026-05-24) — 생성기가 사진에서 추론한 weather도 코드포인트로 출력·저장(emotion·symbol과 동일). 라우터 `_weather_codepoint`는 옛 데이터용 fallback으로 격하
- [ ] (후속) `services/storage.py`(업로드 저장)+앞 업로드 화면의 생성 트리거(①) — **다른 담당**

---

## 6. 미해결 / 분리 작업 (이 화면 밖이지만 연관)

- **[DB] trip 대표사진** — ✅ 결정: 새 컬럼 없이 기존 `trips.cover_photo_id` 사용(VLM이 고른 trip 대표). 추가 컬럼 불필요.
- **[백엔드] `weather`를 Twemoji 코드포인트로 통일** — ✅ 완료(2026-05-24). 생성기(`write_diary`)가 사진에서 추론한 weather를 코드포인트로 출력·저장(emotion·symbol과 동일). 라우터 `_weather_codepoint`는 옛 한글 데이터용 fallback으로 격하 — 기존 데이터는 읽을 때 변환되고 재생성 시 코드포인트로 교체되므로 일괄 정리(UPDATE) 불필요. weather 컬럼 String(50)이라 마이그레이션 없음.
- **[백엔드/인프라] 사진 정적 서빙** — `photos.file_url`/`thumbnail_url`이 `test_images/...` 로컬 경로라 프론트에서 안 열림. 정적 서버나 스토리지 URL로 바꿔야 실제 이미지 표시 가능. (지금 mock은 picsum placeholder)
- **[앞 화면] 사진 업로드 + 압축 + Trip/trip_days 생성 + 생성 로딩** — 별도 화면/라우트. 이 화면은 그 결과(`TripDiary`)를 받아 시작.
- **[지도] 여행지 피커** — ✅ 구현 완료(2026-05-24), **기기 검증 대기**. `frontend/src/components/ui/GoogleMap/LocationPicker.tsx`(native) + `.web.tsx`(웹 폴백·안내 모달). 지도 탭→핀 / "현재 위치"(`expo-location`) → `reverseGeocodeAsync`(키 불필요)로 지명 텍스트 → 그날 `location_summary`에 즉시 반영+저장(백엔드 무변경·텍스트만). 좌표(lat/lon) 저장은 후속. ⚠️ 지도는 앱(Expo Go) 전용이라 웹에선 검증 불가, `/diary_writing` 진입로가 아직 없어 앞 화면 담당 팀원 완료 후 검증 예정(임시 진입 버튼은 안 만들기로).
- **[정정] `models.py`의 `trips.status` 주석** — ✅ 완료(2026-05-24). `'draft'(기본값) → 'completed'(최종저장), 'published' 미사용`으로 정정(주석만, `server_default`는 그대로).

---

## 7. 진행 체크포인트

| 단계 | 완료 기준 | 상태 |
|---|---|---|
| 0 | 화면이 뜨고 핫리로드 동작 | ✅ |
| 1 | 목업 디자인이 React Native로 보임 | ✅ |
| 2 | 읽기전용 일차별 뷰어 + 버튼 3상태/실패상태 (mock) | ✅ |
| 3 | mock으로 전체 흐름 (일차 순차→저장→Detail) 동작 | ✅ |
| 4 | 더미 응답이지만 백엔드 API가 응답함 | ✅ |
| 5 | 실제 API 호출로 흐름 동작 | ✅ |
| 6 | 실제 사진 → 실제 AI → 실제 DB 저장 동작 | ✅ 핵심 완료 (6-1~6-4. 후속 고도화만 남음) |

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
| 2026-05-21 | **2단계 완료** — 읽기전용 멀티데이 뷰어 재구성(`diary_writing.tsx`), 타입(`types/diary_writing.ts`)·mock(`data/diary_writing.ts`, 실제 DB trip 1 전사) 분리. trip 대표사진은 `cover_photo_id`로 확정(새 컬럼 폐기). weather 코드포인트 통일·사진 정적 서빙은 백엔드 후속(6절)으로 분리 |
| 2026-05-22 | **3단계 완료** — mock 전체 흐름 구현(`diary_writing.tsx` 단일 파일). `days`를 `useState`로 관리, `useEffect`+`setTimeout`으로 다음 날 시간차 ready 시뮬레이션. "다음날로"=mock 저장 로그, 마지막 "저장하기"=`router.push('/Detail')` 이동만, `handleRegenerate`=generating→3초→ready. 1·2·3 흐름 검증 완료 |
| 2026-05-22 | **4단계 완료** — 백엔드 API 계약 확정. `schemas/diary.py`(응답 4 + 요청/상태 3, 프론트 TS와 1:1·카멜케이스), `routers/diary.py`(6개 엔드포인트 + 더미 응답), `main.py` 등록. 업로드/생성 ①은 앞 화면 담당이라 제외. TestClient로 6개+404 검증. 요청/상태 TS 타입은 5단계로. genStatus 출처=최신 `diary_generations.status` 번역(6단계 구현) |
| 2026-05-24 | **스키마 리팩터 — diaries→trip_days 합치기** (팀 합의, 1:1이라). `diaries` 제거, 내용 4컬럼(content/symbol/word_count/generated_at)을 `trip_days`로. `title`은 trips.title과 중복이라 버림, user_id는 trips에서 파생. `diary_generations`는 유지하되 FK를 `diary_id`→`trip_day_id`로. 마이그레이션 `a7d2f4b8c1e9`(downgrade로 분리 복귀 가능). `models.py`·`routers/diary.py` 갱신(코드 단순화, 6-4 닭-알 해소). **API(DayPage)·프론트 무변경.** 적용·검증 완료 |
| 2026-05-24 | **6-4 완료 + 전체 동작** — 재생성을 FastAPI BackgroundTasks로 백그라운드 실행→`diaries`/`trip_days` 저장→폴링 반영(`routers/diary.py`). genStatus=최신 `diary_generations.status` 번역. 콘솔 로그 추가. **id 자동증가 마이그레이션**(`f3a9c1d4b2e6`, 전 테이블 IDENTITY+시퀀스 보정 — INSERT 시 NULL PK 위반 해결), `alembic.ini` 한글→영문(cp949 디코드 에러). 실측: 2·3·4일차 생성 11~27초, 동시 OK. → 사진→AI→DB→화면 MVP 완성 |
| 2026-05-24 | **6단계 진행(6-1~6-3)** — 6-1 읽기 엔드포인트를 실제 DB 조회로(`routers/diary.py`, 더미 제거, weather 한글→코드포인트 방어). 6-2 사진 정적 서빙(`main.py` `/test_images` 마운트 + URL 절대화·한글 인코딩, 실제 사진 `backend/test_images/`). 6-3 생성기(`services/diary_generator.py`) Ollama `gemma4:e4b`(vision)로 사진→일기 JSON, 이모지→코드포인트, 실측 검증. 남은 6-4=백그라운드 생성+DB 저장+폴링 연동 |
| 2026-05-23 | **5단계 완료** — 프론트↔백엔드 연동(5-1~5-5). 프론트: `services/diary-api.ts`(호출 6 + `request<T>`), 요청 TS 타입 3개, mock→fetch, `setInterval` 폴링 + ready 시 본문 fetch, 핸들러 실제 호출(save/regenerate/complete), 에러 처리(재시도·`actionError`·성공해야 진행). 백엔드: 더미를 "시간차"로(`_gen_status`/`_day_view`, `GET /trips` 진입 시 타이머 리셋)해 폴링 전환을 눈으로 확인 가능. 서버 on/off로 정상·에러 흐름 검증. `data/diary_writing.ts` mock은 미사용 전환 |
| 2026-05-24 | **후속 고도화 1·2·3·5** — ①weather AI 생성·코드포인트 통일(생성기가 출력·저장, 라우터 변환은 옛 데이터 fallback). ②일기 생성 2단계화(`analyze_photo`+`write_diary`로 분리, 사진별 분석을 `photo_generations`에 저장·재사용→재생성 가속, 같은 모델). ③`models.py` `trips.status` 주석 정정(draft→completed). ⑤여행지 지도 피커(`LocationPicker` native/web, 지도탭+현재위치+`reverseGeocode`→지명 텍스트 저장, 백엔드 무변경). 1·2·3 검증 완료, 5는 `/diary_writing` 진입로 미구현으로 **기기 검증 대기**(앞 화면 담당 완료 후) |
