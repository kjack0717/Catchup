<div align="center">

# 🍅 Catchup <sub>(캐치업)</sub>

**놓친 우리 학교 소식, Catchup 해**
전국 모든 고등학교마다 독립된 커뮤니티를 제공하는, 재학생 전용 학교별 정보 공유 앱

![status](https://img.shields.io/badge/status-in%20development-F57E4E)
![platform](https://img.shields.io/badge/platform-Expo%20(React%20Native)-000020)
![backend](https://img.shields.io/badge/backend-Supabase-3ECF8E)
![node](https://img.shields.io/badge/node-v24-339933)
![schools](https://img.shields.io/badge/schools-2%2C404-D9A441)

</div>

---

## 목차

1. [소개](#소개)
2. [핵심 기능](#핵심-기능)
3. [기술 스택](#기술-스택)
4. [아키텍처](#아키텍처)
5. [프로젝트 구조](#프로젝트-구조)
6. [시작하기](#시작하기)
7. [환경 변수](#환경-변수)
8. [데이터베이스 & 학교 격리(RLS)](#데이터베이스--학교-격리rls)
9. [재학 인증 (학생증 OCR)](#재학-인증-학생증-ocr)
10. [개발 로드맵 (Stage & Gate)](#개발-로드맵-stage--gate)
11. [법적·정책 준수](#법적정책-준수)
12. [팀](#팀)
13. [라이선스](#라이선스)

---

## 소개

**Catchup**은 대한민국 모든 고등학교가 예외 없이 자기 학교만의 독립된 커뮤니티를 갖도록 만드는 재학생 전용 앱입니다. 학교코드(`SD_SCHUL_CODE`)가 곧 커뮤니티 ID이며, 서로 다른 학교의 게시물은 데이터베이스 레벨에서 완전히 격리됩니다.

### 이름의 이중 의미

> **catch up** (따라잡다·정보를 붙잡다) × **ketchup** (짜면 나오는 소스·친근함)
> 통합 메시지 — *"짜면 나오는, 놓친 우리 학교 정보"*

- **표기 규칙**: 영문 `Catchup` 붙여쓰기 통일 / 한글 병기 시 `캐치업`
- **메인 태그라인**: 놓친 우리 학교 소식, Catchup 해
- **서브 태그라인**: 짜면 나오는 우리 학교 정보
- **로고**: 케첩 병을 짜는 손

### 설계 철학

| 원칙 | 내용 |
|---|---|
| **리텐션 우선** | 급식·학사일정·내신·D-day 등 매일 여는 유틸리티가 1차 훅. 습관이 형성된 뒤 커뮤니티를 활성화 |
| **학교 격리는 기능이 아닌 기반** | Supabase RLS로 DB 레벨에서 강제. 토글이 아닌 아키텍처 |
| **학생증이 주 인증** | 고교생은 학교 이메일이 없음 → 이메일 도메인 인증은 비현실적. 학생증 OCR + 검수가 "어느 학교 재학생인가"를 증명 |

### 브랜드 컬러

| 용도 | 색상 | HEX |
|---|---|---|
| 배경 (아이보리) | `#FFFFF0` | RGB 255/255/240 |
| 버튼·강조 (주홍) | `#F57E4E` | RGB 245/126/78 |
| 관리자 채팅 (골드) | `#D9A441` | 일반 채팅과 시각적으로 구분 |

---

## 핵심 기능

### 제품 트랙 — 매일 여는 훅

| 기능 | 데이터 소스 | 설명 |
|---|---|---|
| 🍚 급식표 | NEIS `mealServiceDietInfo` | 메뉴 정제 + 열량 추출 |
| 📅 학사일정 · D-day | NEIS `SchoolSchedule` | 시험·수능 D-day 자동 계산 (2026학년도 수능 `2026-11-19`) |
| 🕐 시간표 | NEIS `hisTimetable` | 커스터마이징 가능 |
| 📊 내신 등급 계산기 | 자체 계산 | 과목 선택·단위 수 반영 가중 계산 |
| 🎯 모의고사 등급컷 | 자체 갱신 | 원점수·표준점수·등급 표시 |
| 🏫 대학 입학처 바로가기 | 자체 링크 | 모집요강 직행 링크, ㄱㄴㄷ 정렬 |

### 커뮤니티 트랙 — 습관 형성 후 활성화

- **학교별 격리 피드** — 같은 학교 재학생만 서로의 글을 봄
- **단일 태그 시스템** — 잡담·입시정보·분실물·수행평가 등 (게시판 분리 대신 태그로 분류)
- **실명 / 익명 토글** — 글 단위로 선택
- **인기글** — 인기 점수 = 좋아요 + (댓글 × 2)
- **댓글 · 대댓글** — 익명 넘버링 (`글쓴이` / `익명N`)
- **쪽지(DM)** — 하단 탭 알림 뱃지 연동
- **관리자 골드 채팅** — 문의·피드백 접근성 확보 (일방향, 상단 고정, 챗봇 자동 정리)
- **스크랩 · 프로필** — 내 글 / 내 댓글 / 스크랩 모아보기, 프로필 편집, 탈퇴 시 게시물 처리 선택
- **졸업생 학사모 표시** — 졸업 후 최대 2년까지 활동, 닉네임 옆 학사모 마크 + 기수 표시

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 클라이언트 | Expo (React Native) |
| 백엔드 | Supabase — PostgreSQL · RLS · Edge Functions (Seoul 리전) |
| 외부 API | NEIS 개방포털 (학교·급식·학사일정), CLOVA OCR (학생증 판독) |
| 런타임 | Node.js v24 |
| 인증 | 학생증 OCR 검수(주 인증) + 이메일/소셜(로그인용) |
| 푸시 | FCM / APNs *(예정)* |

---

## 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                      Expo (React Native)                      │
│   온보딩 · 학교검색 · 학생증인증 · 홈(급식/D-day) · 커뮤니티 · 프로필   │
└───────────────────────────────┬──────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │        Supabase (Seoul)        │
                │  ┌──────────────────────────┐  │
                │  │  PostgreSQL + RLS         │  │  ← 학교별 격리 (SD_SCHUL_CODE)
                │  │  schools / profiles / posts│  │
                │  └──────────────────────────┘  │
                │  ┌──────────────────────────┐  │
                │  │  Edge Functions          │  │
                │  │  verify-student-id       │  │  ← OCR 판정 + identity_hash
                │  │  admin-review            │  │  ← 검수 어드민
                │  └──────────────────────────┘  │
                └───────────────┬───────────────┘
                                │
                ┌───────────────┴───────────────┐
                │          외부 API              │
                │  NEIS (학교/급식/학사일정)       │
                │  CLOVA OCR (학생증 판독)         │
                └───────────────────────────────┘
```

**핵심 원리**: 학교코드(`SD_SCHUL_CODE`) = 커뮤니티 ID. 모든 게시물·프로필은 학교코드에 묶이며, RLS 정책이 다른 학교 데이터 조회를 DB 레벨에서 차단합니다.

---

## 프로젝트 구조

> 참고용 디렉터리 구조입니다. 실제 산출물 인덱스를 기준으로 정리했습니다.

```
catchup/
├── app/                          # Expo (React Native) 클라이언트
│   ├── components/
│   │   ├── SchoolSearch.jsx       # 학교 검색 화면
│   │   ├── TodayCard.jsx          # 홈 급식·D-day 훅 카드
│   │   └── AdminReview.jsx        # 검수 어드민 UI
│   └── lib/
│       ├── supabaseClient.js      # Supabase 클라이언트
│       └── schools-api.js         # 학교 검색 API 연동
│
├── supabase/
│   ├── migrations/
│   │   ├── catchup-schema-rls.sql # 스키마 + 학교 격리 RLS
│   │   ├── search-schools.sql     # 학교 검색 RPC (랭킹·지역검색)
│   │   ├── verification-schema.sql# 학생증 인증 스키마
│   │   └── admin-setup.sql        # 검수 어드민 스키마
│   └── functions/
│       ├── verify-student-id/
│       │   ├── index.ts           # OCR 인증 Edge Function
│       │   └── logic.ts           # 판정 로직 + identity_hash (HMAC)
│       └── admin-review/
│           └── index.ts           # 검수 어드민 Edge Function
│
├── scripts/
│   ├── ingest-schools.mjs         # 전국 고교 수집 (NEIS 순회)
│   ├── neis-core.mjs              # 급식·D-day 로직
│   └── neis-format.js             # NEIS 응답 정제
│
├── tests/
│   └── test-logic.mjs            # 판정 로직 테스트 (21케이스)
│
├── docs/
│   ├── catchup-master-pipeline.pdf
│   ├── catchup-community-guidelines.md
│   ├── catchup-moderation-schema.sql
│   ├── catchup-ai-filter.md
│   ├── catchup-terms-of-service.md
│   └── catchup-privacy-policy.md
│
└── README.md
```

---

## 시작하기

> Windows / PowerShell 기준. 앱 프로젝트와 백엔드/문서 경로를 분리해 관리합니다.

### 사전 요구사항

- Node.js **v24**
- Expo CLI
- Supabase CLI
- NEIS 개방포털 인증키
- CLOVA OCR (Invoke URL · Secret)

### 설치 및 실행

```powershell
# 1. 저장소 클론
git clone https://github.com/<org>/catchup.git
cd catchup

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정 (.env 참고: 아래 '환경 변수' 섹션)
Copy-Item .env.example .env
#   → .env 파일에 실제 값 입력

# 4. DB 마이그레이션 적용
supabase db push

# 5. Edge Function 배포 (OCR·검수)
supabase functions deploy verify-student-id
supabase functions deploy admin-review

# 6. 시크릿 등록 (재가입 차단 pepper)
supabase secrets set IDENTITY_PEPPER=<your-pepper>

# 7. 전국 고교 데이터 수집 (최초 1회)
node scripts/ingest-schools.mjs

# 8. 앱 실행
npx expo start
```

> ⚠️ `node_modules` 동기화 충돌을 피하기 위해 앱 프로젝트는 클라우드 동기화 폴더(OneDrive 등) 밖에 두는 것을 권장합니다.

---

## 환경 변수

`.env.example`을 복사해 `.env`를 생성하고 값을 채웁니다. **실제 키·시크릿은 절대 커밋하지 마세요.**

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용 — 클라이언트에 절대 노출 금지

# NEIS 개방포털
NEIS_API_KEY=

# CLOVA OCR
CLOVA_OCR_INVOKE_URL=
CLOVA_OCR_SECRET=

# 재가입 차단 해시 (Supabase Secret으로 등록)
IDENTITY_PEPPER=
```

---

## 데이터베이스 & 학교 격리(RLS)

- **적재 규모**: 전국 **2,404개 학교**, 16개 광역단체 전부 커버 (일반고 1,642 · 특성화고 490 · 특목고 160 · 자율고 112)
- **격리 방식**: RLS 정책으로 서로 다른 학교 계정이 상대 게시물을 **절대 조회 못 함** (검증 통과)
- **학교 검색 RPC**: 랭킹·지역 검색·방어 로직 포함
- **동기화 정책**: 월 1회 증분 + 매년 3월 전량 재수집 (신설·폐교·개명·통폐합 반영)

> 📌 NEIS 지역 데이터는 실시간으로 변합니다. 2026-07-01 광역단체 통합(17→16개, 전남광주통합특별시)을 반영해, 지역 검증 로직을 하드코딩된 '17개 시도'가 아닌 **권역 키워드 방식**으로 구현했습니다.

---

## 재학 인증 (학생증 OCR)

이메일 도메인 인증은 고교생 현실에 맞지 않아 **로그인용으로만** 존치하고, 재학 증명은 학생증이 담당합니다.

**인증 플로우**

```
학교 검색 → 기본 정보 입력 → 학생증 제출(30일 파기 고지)
   → CLOVA OCR 판독 + 검수 → SessionContext 주입(인증 완료)
```

- **최소 보관·조기 파기**: 학생증 이미지는 최소한으로 보관 후 조기 삭제
- **재가입 차단**: `identity_hash` (HMAC + pepper)로 동일인 재등록 차단
- **졸업생 처리**: 졸업 후 1·2년차 활동 가능, 3월 재인증 시 정리
- **판정 로직**: 테스트 21케이스 통과

---

## 개발 로드맵 (Stage & Gate)

> ✅ 완료 · 🔧 설계완료·구현대기 · ⬜ 예정 · 🔁 상시

| Stage | 내용 | 상태 |
|---|---|---|
| 0 | 브랜드·기획 정의 | ✅ |
| 1 | 설계·문서화 (아키텍처·스키마·가이드라인) | ✅ |
| 2 | 전국 고교 완전 수집 (2,404개) | ✅ |
| 3 | 백엔드·인증·격리 구축 (RLS 실증) | 🔧 (대부분 완료) |
| 4 | 코어 기능 + 운영 방어선 | 🔧 |
| 5 | 앱 이식·브랜딩 (Expo 통합) | ⬜ |
| 6 | 법무·정책 정비 | 🔧 |
| 7 | 비공개 베타 (구글 필수 테스트) | ⬜ |
| 8 | 스토어 심사·정식 출시 | ⬜ |
| 9 | 운영·확장 | 🔁 |

**통과한 관문**: Gate 2(완전수집) ✅ · Gate 3(학교 격리) ✅
**남은 작업**: CLOVA OCR 신청 · Edge Function 배포 · Stage 5 앱 이식

---

## 법적·정책 준수

이용자 다수가 미성년(고교생)이므로 청소년 보호 요건을 필수로 유지합니다.

- **최소 연령**: 만 14세 이상 확인 + 방침·약관 동의
- **개인정보 보호책임자** 지정
- **민감정보 최소화**: 학생증 = 민감정보로 명시, 최소 보관·조기 파기
- **신고 체계**: 신고 3건 자동 블라인드 + 검토 큐, 게시 전 AI 필터(safe/warn/block)
- **피해자 동선**: 즉시 숨김 + 신고 안내(117/1388)
- **회원 탈퇴·차단**: 탈퇴 시 게시물 처리 선택 제공

> 관련 문서: [`docs/catchup-privacy-policy.md`](docs/catchup-privacy-policy.md) · [`docs/catchup-terms-of-service.md`](docs/catchup-terms-of-service.md) · [`docs/catchup-community-guidelines.md`](docs/catchup-community-guidelines.md)

---

## 팀

| 역할 | 담당 |
|---|---|
| 개발·운영 총괄 (Founding Developer) | *(핸들 기입)* |
| CSO · COO (전략·운영) | *(핸들 기입)* |
| CTO (AI·기술) | *(핸들 기입)* |
| CEO (실행·마케팅) | *(핸들 기입)* |
| 콘텐츠·영상·마케팅 | *(핸들 기입)* |

---

## 라이선스

*라이선스 미정 — 상용 서비스 정식 출시 전 확정 예정.*
현재는 **All Rights Reserved**로 간주하며, 무단 복제·배포를 금합니다.

---

<div align="center">
<sub>🍅 짜면 나오는 우리 학교 정보 — Catchup</sub>
</div>
