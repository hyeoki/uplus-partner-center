# U+ 파트너센터 IA 작성 지침

다른 세션에서 이 프로젝트의 Information Architecture 문서를 작성할 때 참고하는 가이드.

---

## 작업 목적
LG U+ 초정밀측위 파트너센터 웹앱의 **Information Architecture** 문서 작성. 메뉴 구조 / 페이지 계층 / 사용자 흐름 / 권한 매트릭스를 한눈에 보이게 정리.

## 프로젝트 개요
- **무엇**: hi-rtk.io(AWS) / wecoms.com(NCP) 두 백엔드 포털과 연동되는 파트너 대리점용 내부 웹앱
- **사용자**: hi-rtk 시스템에서 "대리점/파트너" 역할이 부여된 사용자, 그리고 Super Admin (관리자)
- **역할 구분**: `admin` (시스템 관리·등록/수정/삭제 권한) vs `partner` (조회·문의 권한)

---

## 코드베이스에서 확인할 것

### 필수 파일
- `AGENTS.md` — 프로젝트 전반 컨텍스트, 색상 팔레트, 권한 정책, 알려진 함정
- `prisma/schema.prisma` — 데이터 모델 전체 (User / Site / SiteLicense / Notice / Comment / Reaction / Archive / Category / NoticeTag / Inquiry / KnownRole)
- `src/components/sidebar.tsx` (`NAV_ITEMS` 배열) — 사이드바 메뉴 정의
- `src/app/(dashboard)/layout.tsx` — 대시보드 보호 라우트 진입점
- `src/lib/auth.ts` — 인증/역할 게이트 로직

### 페이지 디렉토리 (`src/app/(dashboard)/`)
- `home/` — 대시보드 홈 (KPI, 최근 공지/자료, 신규 개통 사이트)
- `notice/` — 공지사항 (목록·상세 드로어·등록 폼)
- `archive/` — 자료실 (카테고리 필터·다중 첨부)
- `customers/` — 고객사 사이트 (사이트별 라이선스)
- `inquiry/` — 헬프센터 (문의 게시판 — 비밀글, admin 답변)
- `system/` — 시스템 관리 (admin 전용: 카테고리/태그/챗봇 설정 등)
- `search/` — 통합 검색 결과 페이지

### API / 액션
- `src/app/api/` — auth / chat / files / upload / me 라우트
- 각 페이지의 `actions.ts` — 서버 액션 (CRUD)

---

## 정리해야 할 항목

### 1) 메뉴 트리
- 사이드바 `NAV_ITEMS` 순서대로 (홈 → 공지사항 → 자료실 → 헬프센터 → 고객사 사이트 → 시스템 관리)
- 각 메뉴 라벨, URL, 권한 표시 (`admin only` / `전체`)
- 사이드바 하단 외부 링크: hi-rtk wiki, GNSS 수신기 wiki, 계정 관리

### 2) 페이지별 구조
각 페이지마다:
- **목적** (한 줄)
- **레이아웃 구성** (헤더 / 필터 / 리스트 / 상세 드로어 / 등록 폼)
- **주요 액션** (등록 / 수정 / 삭제 / 답변 / 다운로드)
- **데이터 소스** (Prisma 모델, hi-rtk API)

### 3) 권한 매트릭스
액션별로 `admin` / `partner` / 비로그인 권한 표시. 예:

| 액션 | partner | admin |
|---|---|---|
| 공지 조회 | `visibleRoles` 매칭 시 | 전체 |
| 공지 등록 | ❌ | ✅ |
| 자료 다운로드 | ✅ | ✅ |
| 시스템 관리 진입 | ❌ | ✅ |

### 4) 사용자 흐름
- **로그인 → 대시보드** (hi-rtk 동시 인증 → 역할 게이트 → 사이트/라이선스 background sync)
- **자료 검색 → 다운로드** (필터/검색 → 상세 → 다운로드)
- **문의 작성 → admin 답변** (헬프센터 등록 → 비밀글 옵션 → admin reply)
- **통합 검색** (⌘K 또는 ? 토글 → /search → deep link)

### 5) 가로축 기능 (모든 페이지 공통)
- 글로벌 검색 (`src/components/global-search.tsx`)
- 챗봇 위젯 (`src/components/chatbot-widget.tsx` — 시스템 관리에서 에이전트/API Key 설정)
- 즐겨찾기 메뉴 (`User.favoriteMenus` CSV)
- 모바일 햄버거 + 드로어 + 풀스크린 오버레이

### 6) 외부 의존성
- **hi-rtk.io (AWS)** — 사용자 / 사이트 / 라이선스 / 사진 / 역할 동기화
- **wecoms.com (NCP)** — 같은 API, 공공기관 사이트 수집
- **Synology NAS** — 자료실 파일 저장 (`/homes/jimin/partner-center-files/`) + 앱 프록시 다운로드 (`/api/files/[...path]`)

---

## 출력 권장 형식

1. **트리 다이어그램** (ASCII or Mermaid) — 메뉴 계층 한눈에
2. **페이지 카드** (한 페이지당 1개 섹션) — 위 "페이지별 구조" 항목 따라
3. **권한 매트릭스 표** — 액션 × 역할
4. **사용자 흐름 시퀀스** (Mermaid sequence diagram 또는 글머리 화살표)
5. **외부 시스템 다이어그램** — 우리 앱 ↔ hi-rtk(AWS/NCP) ↔ NAS

---

## 작업 가이드

- **한국어로 작성**. UI 텍스트는 코드에서 그대로 가져올 것 (직역 금지)
- 권한은 항상 `admin` / `partner` 두 축으로 구분
- hi-rtk role 이름은 정확히 `대리점/파트너` 표기 (auth.ts 참조)
- 모델/필드명은 Prisma schema 그대로 (예: `Site.hiRtkTenantEid`)
- 추측보다 코드 검증. 메뉴 라벨 등은 sidebar.tsx 직접 확인
- 이미지/스크린샷 첨부 가능하면 좋음 (없어도 텍스트만으로 OK)
