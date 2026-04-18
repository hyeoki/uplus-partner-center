# U+ 파트너센터 작업 지침

LG U+ 초정밀측위 서비스 파트너 대리점을 위한 파트너센터 웹앱.
hi-rtk.io(AWS) / wecoms.com(NCP, 네이버공공클라우드) 두 백엔드 포털과 연동.

---

## 1. 기술 스택

- **Next.js 16** App Router + Turbopack
- **NextAuth v5** (auth.js) Credentials provider
  - Edge-safe `auth.config.ts` + Node 런타임 `auth.ts` 분리
- **Prisma 6** + **SQLite** (`prisma/prisma/dev.db`)
- **TailwindCSS** (peer-checked variants는 sibling-only — input과 토글 핸들이 직접 형제여야 작동)
- **Synology NAS** (FileStation API 업로드 + Web Station 정적 호스팅)

### 자주 쓰는 명령
```bash
npm run dev                  # Turbopack dev server
npx prisma generate          # 스키마 변경 후 필수
npx prisma migrate dev       # 마이그레이션
rm -rf .next/dev             # Prisma client 변경 후 캐시 클리어
sqlite3 prisma/prisma/dev.db # DB 직접 조회
```

---

## 2. 백엔드 포털 (멀티 서버)

U+초정밀측위 서비스는 고객 유형에 따라 두 클라우드에서 운영됨:

| 서버 | 도메인 | 사이트 호스트 | 대상 |
|------|--------|---------------|------|
| AWS | hi-rtk.io | hi-rtk.app | 민간 기업 |
| NCP | wecoms.com | pin-point-gov.app | 공공기관 (네이버 공공클라우드) |

**둘은 동일한 SPA/API 번들** (welink/parfait portal framework on Spring Boot). 호스트만 다르므로 동일 함수에 base URL만 바꿔 호출.

### 핵심 API 엔드포인트 (양쪽 동일)

```
POST /rest/api/v1/auth/login
GET  /rest/api/v1/portal/my/sites
GET  /rest/api/v1/agip2/portal/users/{eid}/sites      # 멤버십 tenant id 배열
GET  /rest/api/v1/portal/site/licenses?productCode=GOSLIN_CCP
GET  /rest/api/v1/portal/auth/roles                    # 시스템 전체 역할 18개
GET  /rest/api/v1/agip2/portal/users/{eid}/photo       # 프로필 사진 (downloadUrl public)
```

### 비밀번호 인코딩

```ts
// hi-rtk 프론트: btoa(CryptoJS.SHA256(password).toString())
function encodePassword(plain: string): string {
  const sha256hex = crypto.createHash("sha256").update(plain).digest("hex");
  return Buffer.from(sha256hex).toString("base64");
}
```

### 인증 + 동기화 흐름 (`src/lib/auth.ts`)

1. 로그인 폼의 ID/PW로 **AWS, NCP 동시 로그인** (`Promise.all`)
2. 양쪽 다 실패 → 로컬 DB 폴백 (테스트 계정/관리자)
3. 한쪽이라도 성공 시 신원/역할 판별 (AWS 우선)
4. **역할 게이트**:
   - `대리점/파트너` 역할 → role=`partner`
   - Super Admin 식별:
     - `roles[].name === "Super Admin"`
     - `entityId === 1` (hi-rtk 시스템상 admin은 1번)
     - `id === "admin"`
     - admin 계정은 `roles` 배열이 비어있을 수 있어서 위 3개 조건 OR
5. 게이트 통과 시 prisma.user upsert
6. **서버별 독립 sync** — 성공 서버는 sync, 실패 서버는 `deleteMany({ userId, server })`로 비움

### 사이트 dedupe 정책

hi-rtk는 (tenant × product)별로 site row를 별도로 만들지만 라이선스는 tenant 단위. **`tenant.entityId` 기준 dedupe**해서 한 고객사가 중복 노출되지 않게 함. (예: HI-RTK 데모/LS엠트론 8x 중복 → 1건)

---

## 3. Prisma 스키마 핵심 모델

```prisma
model User {
  id                  String   @id @default(cuid())
  loginId             String   @unique
  password            String                        // hi-rtk 사용자는 빈 문자열, 로컬은 평문
  name                String
  grade               String?                       // "관리자" / "파트너"
  role                String                        // "admin" / "partner"
  photoUrl            String?
  tenantNames         String?                       // "tenantA, tenantB"
  groupNames          String?
  roleNames           String?
  lastConnectionStatus String?
  lastConnectionAt    DateTime?
  lastDisconnectionAt DateTime?
}

model Site {
  id                 String   @id @default(cuid())
  userId             String
  server             String   @default("AWS")        // "AWS" | "NCP"
  hiRtkSiteEid       Int
  hiRtkTenantEid     Int
  hiRtkPortalUserEid Int
  name               String
  alias              String?
  bookmark           Boolean  @default(false)        // hi-rtk 포털의 즐겨찾기
  productHost        String?                         // hi-rtk.app | pin-point-gov.app
  productContextPath String?
  // 임베드 라이선스 (가장 활성 1건, 홈/요약용)
  licenseName        String?
  licenseType        String?
  licenseColor       String?
  sessionCount       Int?
  licenseStart       DateTime?
  licenseEnd         DateTime?
  expireStatus       Boolean?
  // 1:N
  licenses           SiteLicense[]

  @@unique([userId, server, hiRtkSiteEid])
}

model SiteLicense {
  id                 String   @id @default(cuid())
  siteId             String
  hiRtkSiteLicenseEid Int
  licenseEntityId    Int?
  licenseName        String?
  licenseType        String?     // FREE / BASIC / STANDARD
  licenseColor       String?
  siteLicenseType    String?     // OFFICIAL / POC / DEV
  plan               String?     // 요금제명
  sessionCount       Int?        // 동시접속 수
  startDate          DateTime?
  endDate            DateTime?
  expireStatus       Boolean?    // 만료 여부
  activeStatus       Boolean?
  licenseStatus      Boolean?    // 진짜 활성 플래그 (expireStatus 아님!)
  agencyName         String?
  applicationName    String?
  note               String?
}

model Notice / Archive {
  visibleRoles String?          // CSV ",role1,role2," — 조회 권한 게이트
}

model KnownRole {
  hiRtkRoleEid  Int    @unique
  name          String @unique
  description   String?
}
```

---

## 4. UI 컨벤션

### 색상 팔레트
- Primary: `#E6007E` (LG U+ 핑크)
- AWS chip: `#FF9900` (오렌지)
- NCP chip: `#03C75A` (네이버 그린)
- 본문 회색: `#9ca3af`
- 헤더 검정: `#1A1C1E`
- 카드 그림자: `0px 12px 32px rgba(25, 28, 29, 0.06)`
- 폰트: `var(--font-display)` 헤더 / 본문 기본

### 서버 라벨
- 홈 화면 (`신규 개통한 고객사에요!` 섹션): `네이버공공클라우드` 풀네임
- 사이트 관리 표: `NCP` 단축형 (변경 가능)
- 라벨 위치: 사이트명 우측 인라인 chip

### 레이아웃
- 전체 화면 flex (반응형 width 100%)
- 사이드바: 접힘/펼침 토글, 하단에 위키 링크 + 프로필 드롭다운

### 사이드바 구조 (`src/components/sidebar.tsx`)
```
NAV_ITEMS (홈, 사이트관리, 공지사항, 자료실, 시스템관리[admin])
─────────
WikiLink: U+ 초정밀측위 wiki
WikiLink: GNSS 수신기 wiki
─────────
ProfileMenu (사진+이름 클릭 → 드롭다운)
  - 계정 관리 → https://www.hi-rtk.io/#/main/my-account
  - 로그아웃
```

### 권한 게이트
- `isCurrentUserAdmin()` (`src/lib/admin.ts`): User.role === "admin" 체크
- admin-only: 공지등록, 자료등록, 시스템관리
- 공지/자료 조회 권한: `visibleRoles` CSV로 역할 필터

---

## 5. 챗봇 설정

- **에이전트 선택 + API Key**: 시스템 관리 화면에서 저장 → `data/chatbot-settings.json` (gitignore됨)
- API Key는 평문 JSON으로 저장됨. UI에선 `sk-x ••••xxxx` 형식으로 마스킹 표시
- 챗봇 호출 우선순위: `chatbot-settings.json` → `process.env.OPENAI_API_KEY`
- `chatbot-settings-shared.ts`: 클라이언트/서버 공용 (`CHATBOT_AGENT_OPTIONS`, types)
- `chatbot-settings.ts`: server-only (fs 사용)
- ⚠️ `src/app/api/chat/route.ts`는 현재 OpenAI Responses API만 호출. Claude/Gemini 선택 시 별도 구현 필요

---

## 6. NAS 파일 다운로드

자료실 파일은 Synology Web Station으로 직접 다운로드 (서버 경유 X).

- **업로드 경로**: `/web/partner_center/{timestamp}/{originalName}`
  - timestamp 폴더 안에 원본 파일명 그대로 저장 → URL 마지막 세그먼트가 한글 파일명 유지 (cross-origin이라 `<a download>` 속성 무효, 파일명은 URL에서 추출)
- **다운로드 URL**: `https://{nas-host}/partner_center/{timestamp}/{filename}`
- 다운로드 버튼은 **새 탭**으로 띄우기

---

## 7. 알려진 함정 / 자주 막히는 지점

1. **Prisma 스키마 변경 후**: `npx prisma generate` → `rm -rf .next/dev` → dev 서버 재시작. 안 하면 `PrismaClientValidationError` 발생
2. **TailwindCSS peer-checked**: input과 토글 핸들이 **직접 형제** 관계여야 작동. 한 단계라도 끼면 무시됨 → 둘 다 absolute로 같은 부모 안에 배치
3. **NextAuth `return null`**: 게이트 실패 시 null 반환하면 fallback 차단됨 → 조건 분기 후 fall-through 패턴 사용
4. **hi-rtk admin 계정**: `roles` 배열이 비어있어서 역할명 체크만으로는 식별 불가 → `entityId === 1` 또는 `id === "admin"` 추가 체크
5. **라이선스 활성 판별**: `expireStatus`(만료 여부)가 아니라 `licenseStatus`(true=활성)를 사용
6. **사이트 dedupe**: tenant.entityId 기준으로 합치지 않으면 라이선스 카운트가 N배 부풀려짐
7. **DB 위치**: schema는 `prisma/schema.prisma`지만 실제 db는 `prisma/prisma/dev.db` (중첩됨, sqlite3 직접 조회 시 주의)

---

## 8. 디버깅 팁

### 로그인/sync 동작 확인
- dev 서버 콘솔에서 `[hi-rtk:` `[auth]` 로 시작하는 로그 확인
- 외부에서 띄운 dev 서버는 stdout 캡처 불가. 디버깅 필요 시 background로 재기동:
  ```bash
  npm run dev > /tmp/uplus-dev.log 2>&1 &
  ```

### 사이트 동기화 결과 확인
```bash
sqlite3 prisma/prisma/dev.db \
  "SELECT userId, server, COUNT(*) FROM Site GROUP BY userId, server;"
```

### hi-rtk API 직접 호출 시 주의
- POST `/auth/login`은 `application/x-www-form-urlencoded`
- 후속 호출은 응답 헤더의 `welink-*` 쿠키만 추출해 `Cookie` 헤더로 전달
- Node 19.7+ undici fetch는 `headers.getSetCookie()` 지원

---

## 9. 작업 스타일

- **한국어 응답**. 사용자 지시도 한국어로 옴
- 코드 주석은 한국어 + 핵심 영문 키워드
- UI 텍스트 변경 요청이 자주 있음 — 직역하지 말고 사용자가 준 문구 그대로 사용
- 큰 리팩토링보다 **점진적 변경 선호**. 한 번에 한 가지씩
- 사용자가 "니가 직접 확인해봐"라고 하면 → 바로 도구 호출해서 확인. 사용자에게 떠넘기지 말 것
- 화면 보이는 동작이 의심스러우면 **DB 직접 조회**로 검증 (sqlite3)
