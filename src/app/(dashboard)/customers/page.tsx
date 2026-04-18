import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CustomersTable, { type SiteRow } from "@/components/customers-table";
import SyncStatusPoller from "@/components/sync-status-poller";

type Props = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  const session = await auth();
  const userId = session?.user?.id;
  const params = await searchParams;
  const filter = params.filter ?? null;

  // PoC 마감 임박 필터 (홈에서 "더보기"로 진입)
  const today = new Date();
  const expiringSoonThreshold = new Date();
  expiringSoonThreshold.setDate(expiringSoonThreshold.getDate() + 14);
  const siteWhere =
    filter === "poc-expiring"
      ? {
          userId: userId!,
          licenses: {
            some: {
              siteLicenseType: "POC",
              licenseStatus: true,
              endDate: { gte: today, lte: expiringSoonThreshold },
            },
          },
        }
      : { userId: userId! };

  const [me, sites] = userId
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { lastSyncedAt: true } }),
        prisma.site.findMany({
          where: siteWhere,
          orderBy: [{ bookmark: "desc" }, { hiRtkRegDate: "desc" }, { id: "desc" }],
          include: {
            licenses: {
              orderBy: [{ expireStatus: "asc" }, { endDate: "desc" }],
            },
          },
        }),
      ])
    : [null, []];
  const syncing = me ? me.lastSyncedAt === null : false;

  const rows: SiteRow[] = sites.map((s) => ({
    id: s.id,
    alias: s.alias,
    name: s.name,
    bookmark: s.bookmark,
    server: s.server,
    productName: s.productName,
    productHost: s.productHost,
    productContextPath: s.productContextPath,
    licenses: s.licenses.map((l) => ({
      id: l.id,
      licenseName: l.licenseName,
      licenseType: l.licenseType,
      licenseColor: l.licenseColor,
      siteLicenseType: l.siteLicenseType,
      plan: l.plan,
      sessionCount: l.sessionCount,
      startDate: l.startDate ? l.startDate.toISOString() : null,
      endDate: l.endDate ? l.endDate.toISOString() : null,
      licenseStatus: l.licenseStatus,
    })),
  }));

  const totalLicenses = rows.reduce((sum, s) => sum + s.licenses.length, 0);

  return (
    <div className="space-y-6 w-full">
      <SyncStatusPoller syncing={syncing} />
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
          >
            사이트 관리
          </h1>
          <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
            고객사 사이트 및 라이선스 현황을 확인해보세요.
          </p>
        </div>
        <span className="text-xs" style={{ color: "#9ca3af" }}>
          사이트 {sites.length}건 · 라이선스 {totalLicenses}건
        </span>
      </div>

      {filter === "poc-expiring" && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "rgba(230,0,126,0.06)", border: "1px solid rgba(230,0,126,0.15)" }}
        >
          <span className="text-sm" style={{ color: "#1A1C1E" }}>
            <span className="font-semibold" style={{ color: "#E6007E" }}>PoC 마감 임박</span>
            {" "}필터 적용 중 — 2주 이내 만료 예정인 PoC 라이선스 보유 사이트만 표시
          </span>
          <Link
            href="/customers"
            className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors hover:bg-white"
            style={{ color: "#E6007E", background: "transparent" }}
          >
            필터 해제 ✕
          </Link>
        </div>
      )}

      {sites.length === 0 ? (
        syncing ? (
          <div
            className="rounded-2xl p-10"
            style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
          >
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl animate-pulse"
                  style={{ background: "#f3f4f6" }}
                />
              ))}
            </div>
            <p className="text-sm mt-6 text-center" style={{ color: "#9ca3af" }}>
              사이트 정보를 불러오는 중...
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
          >
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              동기화된 사이트가 없습니다. hi-rtk.io 계정으로 로그인하면 자동으로 표시됩니다.
            </p>
          </div>
        )
      ) : (
        <CustomersTable sites={rows} />
      )}
    </div>
  );
}
