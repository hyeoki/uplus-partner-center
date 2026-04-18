import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { authConfig } from "@/lib/auth.config";

/** hi-rtk.io 비밀번호 인코딩: Base64(SHA-256(plaintext) hex)
 *  hi-rtk.io 프론트엔드: btoa(CryptoJS.SHA256(password).toString())
 */
function encodePassword(plain: string): string {
  const sha256hex = crypto.createHash("sha256").update(plain).digest("hex");
  return Buffer.from(sha256hex).toString("base64");
}

type HiRtkSite = {
  entityId: number;
  bookmark?: boolean;
  portalUser?: { entityId?: number };
  tenant?: {
    entityId?: number;
    name?: string;
    alias?: string | null;
    description?: string | null;
    totalUserCount?: number | null;
    regDate?: number | null;
  };
  product?: {
    name?: string;
    code?: string;
    host?: string;
    contextPath?: string;
  };
};

type LoginSuccess = {
  success: true;
  userEntity: Record<string, unknown>;
  cookieHeader: string; // 다음 호출(/portal/my/sites)에 붙일 Cookie 헤더
  hiRtkUserEid: number | null;
};
type LoginFail = { success: false };

/** 응답 헤더에서 다음 호출에 사용할 welink-* 쿠키만 추출 */
function extractWelinkCookies(headers: Headers): string {
  // Node 19.7+ undici fetch는 getSetCookie() 지원
  const setCookieList: string[] =
    (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    // fallback — 단일 set-cookie 헤더는 getSetCookie 없을 때 string으로 옴
    (headers.get("set-cookie") ? [headers.get("set-cookie")!] : []);

  return setCookieList
    .map((c) => c.split(";")[0]) // "welink-auth=...;Path=/" → "welink-auth=..."
    .filter((c) => c.startsWith("welink-"))
    .join("; ");
}

/**
 * 서버별 hi-rtk 호환 포털.
 * - AWS: hi-rtk.io
 * - NCP: wecoms.com (네이버 공공클라우드)
 * 둘 다 동일한 API 구조 (같은 SPA 번들).
 */
type HiRtkServer = "AWS" | "NCP";
const HI_RTK_HOSTS: Record<HiRtkServer, string> = {
  AWS: "https://www.hi-rtk.io",
  NCP: "https://www.wecoms.com",
};

/** hi-rtk 호환 포털 로그인 + 후속 호출용 쿠키 확보 (5초 타임아웃) */
async function hiRtkLogin(
  base: string,
  id: string,
  password: string,
): Promise<LoginSuccess | LoginFail> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const body = new URLSearchParams({
      id,
      password: encodePassword(password),
      keepLoginSession: "false",
    }).toString();

    const res = await fetch(`${base}/rest/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    clearTimeout(timer);

    if (res.ok && data?.userEntity) {
      const userEntity = data.userEntity as Record<string, unknown>;
      const hiRtkUserEid =
        typeof userEntity.entityId === "number" ? (userEntity.entityId as number) : null;
      const cookieHeader = extractWelinkCookies(res.headers);
      return { success: true, userEntity, cookieHeader, hiRtkUserEid };
    }

    console.log(`[hi-rtk:${base}] login failed:`, res.status, data?.errorCode, data?.message);
    return { success: false };
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.log(`[hi-rtk:${base}] login timeout`);
    } else {
      console.error(`[hi-rtk:${base}] login error:`, err);
    }
    return { success: false };
  }
}

/**
 * /rest/api/v1/portal/site/licenses 응답 한 행 (필요한 필드만)
 * 사이트당 라이선스 N개. 한 응답에 모든 사용자의 라이선스가 다 들어옴 → site.entityId로 필터.
 */
type HiRtkSiteLicense = {
  entityId: number;
  site?: { entityId?: number };
  licenseEntityId?: number;
  licenseName?: string;
  licenseType?: string; // FREE / BASIC / STANDARD
  licenseIconColor?: string;
  siteLicenseType?: string; // OFFICIAL / POC / DEV
  plan?: string | null;
  sessionCount?: number;
  startDate?: number;
  endDate?: number;
  expireStatus?: boolean;
  activeStatus?: boolean;
  licenseStatus?: boolean;
  agency?: { name?: string } | null;
  applicationName?: string | null;
  note?: string | null;
};

/**
 * hi-rtk 사용자 프로필 사진 URL 가져와서 User.photoUrl 업데이트.
 * 응답: { downloadUrl: "https://www.hi-rtk.io/file/storage/download/{token}" }
 * 이 URL은 인증 없이 GET 가능하므로 src에 그대로 사용.
 * 실패해도 로그인 흐름을 막지 않는다.
 */
async function syncUserPhoto(
  base: string,
  userId: string,
  cookieHeader: string,
  hiRtkUserEid: number,
): Promise<void> {
  try {
    const res = await fetch(
      `${base}/rest/api/v1/agip2/portal/users/${hiRtkUserEid}/photo`,
      { headers: { Cookie: cookieHeader }, cache: "no-store" },
    );
    if (!res.ok) {
      await prisma.user.update({ where: { id: userId }, data: { photoUrl: null } });
      return;
    }
    const data = (await res.json()) as { downloadUrl?: string };
    const url = typeof data.downloadUrl === "string" ? data.downloadUrl : null;
    await prisma.user.update({ where: { id: userId }, data: { photoUrl: url } });
  } catch (err) {
    console.error(`[hi-rtk:${base}] photo sync error:`, err);
  }
}

/**
 * hi-rtk 시스템 전체 역할 목록을 가져와 KnownRole 테이블에 upsert.
 * 등록 폼의 "조회 권한" 옵션 소스로 사용.
 * 실패해도 로그인 흐름을 막지 않는다.
 */
async function syncRoles(base: string, cookieHeader: string): Promise<void> {
  try {
    const res = await fetch(`${base}/rest/api/v1/portal/auth/roles`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      console.log(`[hi-rtk:${base}] roles fetch failed:`, res.status);
      return;
    }
    const arr = (await res.json()) as Array<{
      entityId?: number;
      name?: string;
      description?: string | null;
    }>;
    if (!Array.isArray(arr)) return;
    for (const r of arr) {
      if (typeof r.entityId !== "number" || !r.name) continue;
      await prisma.knownRole.upsert({
        where: { hiRtkRoleEid: r.entityId },
        update: { name: r.name, description: r.description ?? null },
        create: {
          hiRtkRoleEid: r.entityId,
          name: r.name,
          description: r.description ?? null,
        },
      });
    }
  } catch (err) {
    console.error("[hi-rtk] roles sync error:", err);
  }
}

/**
 * 로그인 직후 hi-rtk에서 사용자 사이트 목록을 가져와 DB에 동기화.
 * - 멤버십 기준: 사용자가 사이트의 user 멤버로 등록된 사이트만 저장
 *   /agip2/portal/users/{eid}/sites → tenant.entityId 배열 → 그 tenant의 site row 모두
 * - 사이트별 라이선스(동시접속 수, 시작/만료일, 등급) 정보도 함께 매핑
 * - 기존 행은 모두 지우고 새로 채우는 단순 strategy
 *
 * 실패해도 로그인 흐름을 막지 않는다. (best-effort)
 */
/**
 * 빠른 사이트 동기화 — fetch /sites + /membership만, 라이선스는 제외.
 * 로그인 critical path에 사용. 라이선스 정보 컬럼은 NULL로 채워지고,
 * 별도 background 호출(syncSiteLicenses)이 나중에 채움.
 *
 * 반환: tenantEid → siteId 매핑 (background에서 라이선스 attach 시 사용)
 */
async function syncSitesFast(
  base: string,
  server: HiRtkServer,
  userId: string,
  cookieHeader: string,
  hiRtkUserEid: number,
): Promise<Map<number, string> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const tFetch = Date.now();
    const [memberRes, sitesRes] = await Promise.all([
      fetch(`${base}/rest/api/v1/agip2/portal/users/${hiRtkUserEid}/sites`, {
        headers: { Cookie: cookieHeader }, signal: controller.signal, cache: "no-store",
      }),
      fetch(`${base}/rest/api/v1/portal/my/sites`, {
        headers: { Cookie: cookieHeader }, signal: controller.signal, cache: "no-store",
      }),
    ]);
    clearTimeout(timer);
    console.log(`[sync:${server}/timing-fast] fetch=${Date.now() - tFetch}ms`);

    if (!sitesRes.ok) {
      console.error(`[hi-rtk:${server}] sites fetch failed:`, sitesRes.status);
      return null;
    }
    const tParse = Date.now();
    const [all, memberJson] = await Promise.all([
      sitesRes.json().catch(() => null) as Promise<HiRtkSite[] | null>,
      memberRes.ok ? memberRes.json().catch(() => null) : Promise.resolve(null),
    ]);
    console.log(`[sync:${server}/timing-fast] parse=${Date.now() - tParse}ms`);
    if (!Array.isArray(all)) return null;

    let memberTenantEids = new Set<number>();
    if (Array.isArray(memberJson)) {
      memberTenantEids = new Set(memberJson.filter((x): x is number => typeof x === "number"));
    }

    const matched = memberTenantEids.size > 0
      ? all.filter((s) => typeof s.tenant?.entityId === "number" && memberTenantEids.has(s.tenant.entityId))
      : all.filter((s) => s.portalUser?.entityId === hiRtkUserEid);

    // tenant 기준 dedupe
    const seenTenants = new Set<number>();
    const mine = matched.filter((s) => {
      const teid = s.tenant?.entityId;
      if (typeof teid !== "number" || seenTenants.has(teid)) return false;
      seenTenants.add(teid);
      return true;
    });

    if (mine.length === 0) {
      await prisma.site.deleteMany({ where: { userId, server } });
      return new Map();
    }

    const tenantToSiteId = new Map<number, string>();
    const siteRows: Array<Record<string, unknown>> = [];

    for (const s of mine) {
      const t = s.tenant ?? {};
      const p = s.product ?? {};
      if (typeof t.entityId !== "number") continue;
      const siteId = crypto.randomUUID();
      tenantToSiteId.set(t.entityId, siteId);

      siteRows.push({
        id: siteId,
        server,
        hiRtkSiteEid: s.entityId,
        hiRtkTenantEid: t.entityId,
        hiRtkPortalUserEid: s.portalUser?.entityId ?? hiRtkUserEid,
        name: t.name ?? "",
        alias: t.alias ?? null,
        description: t.description ?? null,
        totalUserCount: typeof t.totalUserCount === "number" ? t.totalUserCount : null,
        bookmark: s.bookmark === true,
        hiRtkRegDate: typeof t.regDate === "number" ? new Date(t.regDate) : null,
        productName: p.name ?? null,
        productCode: p.code ?? null,
        productHost: p.host ?? null,
        productContextPath: p.contextPath ?? null,
        // 라이선스 임베드 컬럼은 background에서 채움
        userId,
      });
    }

    const tDb = Date.now();
    await prisma.$transaction([
      prisma.site.deleteMany({ where: { userId, server } }),
      prisma.site.createMany({ data: siteRows as never }),
    ]);
    console.log(`[sync:${server}/timing-fast] db sites=${siteRows.length} time=${Date.now() - tDb}ms`);

    return tenantToSiteId;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.log(`[hi-rtk:${server}] sites sync timeout`);
    } else {
      console.error(`[hi-rtk:${server}] sites sync error:`, err);
    }
    return null;
  }
}

/**
 * 라이선스 background 동기화 — fetch /licenses, parse, SiteLicense 행 생성 + Site 임베드 컬럼 업데이트.
 * 로그인 응답 후 fire-and-forget으로 실행.
 */
async function syncSiteLicensesBackground(
  base: string,
  server: HiRtkServer,
  userId: string,
  cookieHeader: string,
  tenantToSiteId: Map<number, string>,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const tFetch = Date.now();
    const res = await fetch(`${base}/rest/api/v1/portal/site/licenses?productCode=GOSLIN_CCP`, {
      headers: { Cookie: cookieHeader }, signal: controller.signal, cache: "no-store",
    });
    if (!res.ok) {
      console.log(`[hi-rtk:${server}] licenses fetch failed:`, res.status);
      clearTimeout(timer);
      return;
    }
    const tParse = Date.now();
    const allLicenses = (await res.json().catch(() => null)) as HiRtkSiteLicense[] | null;
    clearTimeout(timer);
    console.log(`[sync:${server}/timing-bg] fetch=${tParse - tFetch}ms parse=${Date.now() - tParse}ms`);
    if (!Array.isArray(allLicenses)) return;

    // tenant 기준 그룹화
    const licByTenant = new Map<number, HiRtkSiteLicense[]>();
    for (const l of allLicenses) {
      const teid = l.site?.entityId;
      if (typeof teid !== "number" || !tenantToSiteId.has(teid)) continue;
      const arr = licByTenant.get(teid) ?? [];
      arr.push(l);
      licByTenant.set(teid, arr);
    }
    function pickPrimary(list: HiRtkSiteLicense[]): HiRtkSiteLicense | null {
      if (list.length === 0) return null;
      const active = list.filter((l) => l.expireStatus === false);
      const pool = active.length > 0 ? active : list;
      return pool.reduce((best, cur) => ((cur.endDate ?? 0) > (best.endDate ?? 0) ? cur : best));
    }

    const licenseRows: Array<Record<string, unknown>> = [];
    const siteUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];

    for (const [tenantEid, siteId] of tenantToSiteId) {
      const lics = licByTenant.get(tenantEid) ?? [];
      const primary = pickPrimary(lics);

      if (primary) {
        siteUpdates.push({
          id: siteId,
          data: {
            licenseName: primary.licenseName ?? null,
            licenseType: primary.licenseType ?? null,
            licenseColor: primary.licenseIconColor ?? null,
            sessionCount: typeof primary.sessionCount === "number" ? primary.sessionCount : null,
            licenseStart: typeof primary.startDate === "number" ? new Date(primary.startDate) : null,
            licenseEnd: typeof primary.endDate === "number" ? new Date(primary.endDate) : null,
            expireStatus: typeof primary.expireStatus === "boolean" ? primary.expireStatus : null,
          },
        });
      }

      for (const l of lics) {
        licenseRows.push({
          id: crypto.randomUUID(),
          siteId,
          hiRtkSiteLicenseEid: l.entityId,
          licenseEntityId: typeof l.licenseEntityId === "number" ? l.licenseEntityId : null,
          licenseName: l.licenseName ?? null,
          licenseType: l.licenseType ?? null,
          licenseColor: l.licenseIconColor ?? null,
          siteLicenseType: l.siteLicenseType ?? null,
          plan: l.plan && l.plan !== "null" ? l.plan : null,
          sessionCount: typeof l.sessionCount === "number" ? l.sessionCount : null,
          startDate: typeof l.startDate === "number" ? new Date(l.startDate) : null,
          endDate: typeof l.endDate === "number" ? new Date(l.endDate) : null,
          expireStatus: typeof l.expireStatus === "boolean" ? l.expireStatus : null,
          activeStatus: typeof l.activeStatus === "boolean" ? l.activeStatus : null,
          licenseStatus: typeof l.licenseStatus === "boolean" ? l.licenseStatus : null,
          agencyName: l.agency?.name ?? null,
          applicationName: l.applicationName ?? null,
          note: l.note ?? null,
        });
      }
    }

    const tDb = Date.now();
    await prisma.$transaction([
      ...(licenseRows.length > 0 ? [prisma.siteLicense.createMany({ data: licenseRows as never })] : []),
      ...siteUpdates.map((u) => prisma.site.update({ where: { id: u.id }, data: u.data })),
    ]);
    console.log(`[sync:${server}/timing-bg] db licenses=${licenseRows.length} updates=${siteUpdates.length} time=${Date.now() - tDb}ms`);
  } catch (err) {
    clearTimeout(timer);
    console.error(`[hi-rtk:${server}] licenses bg sync error:`, err);
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const loginId = credentials.loginId as string;
        const password = credentials.password as string;
        if (!loginId || !password) return null;

        // ① AWS(hi-rtk.io) + NCP(wecoms.com) 동시 인증 — 입력한 ID/PW를 양쪽에 그대로 사용.
        //    실패한 서버의 데이터는 표시하지 않음 (deleteMany로 정리).
        try {
          const t0 = Date.now();
          const [awsRes, ncpRes] = await Promise.all([
            hiRtkLogin(HI_RTK_HOSTS.AWS, loginId, password),
            hiRtkLogin(HI_RTK_HOSTS.NCP, loginId, password),
          ]);
          console.log(`[auth/timing] login both: ${Date.now() - t0}ms (aws=${awsRes.success} ncp=${ncpRes.success})`);

          // 양쪽 다 실패 → 로컬 DB 폴백으로 진행
          if (!awsRes.success && !ncpRes.success) {
            // fall through
          } else {
            // 신원/역할은 AWS 우선, 없으면 NCP에서 가져옴
            const primary = awsRes.success ? awsRes : (ncpRes as LoginSuccess);
            const entity = primary.userEntity;
            const roles = Array.isArray(entity.roles)
              ? (entity.roles as Array<{ entityId?: number; name?: string }>)
              : [];
            const isPartner = roles.some((r) => r?.name === "대리점/파트너");
            const isSuperAdmin =
              roles.some((r) => r?.name === "Super Admin") ||
              entity.entityId === 1 ||
              entity.id === "admin";

            if (isPartner || isSuperAdmin) {
              const assignedRole = isSuperAdmin ? "admin" : "partner";
              const name =
                (entity.name as string) ||
                (entity.userName as string) ||
                (entity.id as string) ||
                loginId;
              const tenantNames = (entity.tenantNames as string | null) ?? null;
              const groupNames = (entity.groupNames as string | null) ?? null;
              const roleNames = (entity.roleNames as string | null) ?? null;
              const lastConnectionStatus =
                (entity.lastConnectionStatus as string | null) ?? null;
              const lastConnectionAt =
                typeof entity.lastConnectionDate === "number"
                  ? new Date(entity.lastConnectionDate as number)
                  : null;
              const lastDisconnectionAt =
                typeof entity.lastDisconnectionDate === "number"
                  ? new Date(entity.lastDisconnectionDate as number)
                  : null;

              const user = await prisma.user.upsert({
                where: { loginId },
                update: {
                  name,
                  role: assignedRole,
                  tenantNames,
                  groupNames,
                  roleNames,
                  lastConnectionStatus,
                  lastConnectionAt,
                  lastDisconnectionAt,
                  lastSyncedAt: null, // background sync 시작 표시
                },
                create: {
                  loginId,
                  password: "",
                  name,
                  grade: assignedRole === "admin" ? "관리자" : "파트너",
                  role: assignedRole,
                  tenantNames,
                  groupNames,
                  roleNames,
                  lastConnectionStatus,
                  lastConnectionAt,
                  lastDisconnectionAt,
                  lastSyncedAt: null,
                },
              });

              // 모든 동기화를 background로 분리 (fire-and-forget). 로그인 응답 즉시 반환.
              // 완료 시 user.lastSyncedAt = now() 갱신 → UI 폴링이 감지해 새로고침.
              const tStart = Date.now();
              void (async () => {
                try {
                  const [awsTenantMap, ncpTenantMap] = await Promise.all([
                    (async () => {
                      if (awsRes.success && awsRes.cookieHeader && awsRes.hiRtkUserEid !== null) {
                        const [tenantMap] = await Promise.all([
                          syncSitesFast(HI_RTK_HOSTS.AWS, "AWS", user.id, awsRes.cookieHeader, awsRes.hiRtkUserEid),
                          syncRoles(HI_RTK_HOSTS.AWS, awsRes.cookieHeader),
                          syncUserPhoto(HI_RTK_HOSTS.AWS, user.id, awsRes.cookieHeader, awsRes.hiRtkUserEid),
                        ]);
                        return tenantMap;
                      }
                      console.log(`[auth] AWS login failed for ${loginId} — clearing AWS sites`);
                      await prisma.site.deleteMany({ where: { userId: user.id, server: "AWS" } });
                      return null;
                    })(),
                    (async () => {
                      if (ncpRes.success && ncpRes.cookieHeader && ncpRes.hiRtkUserEid !== null) {
                        return syncSitesFast(HI_RTK_HOSTS.NCP, "NCP", user.id, ncpRes.cookieHeader, ncpRes.hiRtkUserEid);
                      }
                      console.log(`[auth] NCP login failed for ${loginId} — clearing NCP sites`);
                      await prisma.site.deleteMany({ where: { userId: user.id, server: "NCP" } });
                      return null;
                    })(),
                  ]);

                  // 라이선스도 같은 background flow에서 처리
                  await Promise.all([
                    awsTenantMap && awsRes.success && awsRes.cookieHeader
                      ? syncSiteLicensesBackground(HI_RTK_HOSTS.AWS, "AWS", user.id, awsRes.cookieHeader, awsTenantMap)
                      : Promise.resolve(),
                    ncpTenantMap && ncpRes.success && ncpRes.cookieHeader
                      ? syncSiteLicensesBackground(HI_RTK_HOSTS.NCP, "NCP", user.id, ncpRes.cookieHeader, ncpTenantMap)
                      : Promise.resolve(),
                  ]);

                  await prisma.user.update({
                    where: { id: user.id },
                    data: { lastSyncedAt: new Date() },
                  });
                  console.log(`[auth/timing] full bg sync=${Date.now() - tStart}ms`);
                } catch (err) {
                  console.error("[auth] bg sync error:", err);
                }
              })();

              return { id: user.id, name: user.name, email: user.loginId };
            }

            // 게이트 실패 — 로컬 DB 폴백으로 진행
            const roleList =
              roles.map((r) => r?.name).filter(Boolean).join(", ") || "(none)";
            console.log(
              `[auth] hi-rtk login: required role missing (roles=[${roleList}]) — falling back to local DB for ${loginId}`,
            );
          }
        } catch (err) {
          console.error("[auth] hi-rtk block error:", err);
        }

        // ② Fallback: 로컬 DB 인증 (테스트 계정 / 관리자 / hi-rtk 장애)
        try {
          const user = await prisma.user.findUnique({ where: { loginId } });
          if (user && user.password !== "" && user.password === password) {
            return { id: user.id, name: user.name, email: user.loginId };
          }
        } catch (err) {
          console.error("[auth] local DB error:", err);
        }

        return null;
      },
    }),
  ],
});
