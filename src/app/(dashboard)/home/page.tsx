import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import SyncStatusPoller from "@/components/sync-status-poller";
import { getCategoryColor } from "@/lib/category-colors";

export default async function HomePage() {
  const session = await auth();
  const recentThreshold = new Date();
  recentThreshold.setDate(recentThreshold.getDate() - 7);
  const [noticeCount, archiveCount, recentNoticeCount, recentArchiveCount] = await Promise.all([
    prisma.notice.count(),
    prisma.archive.count(),
    prisma.notice.count({ where: { createdAt: { gte: recentThreshold } } }),
    prisma.archive.count({ where: { createdAt: { gte: recentThreshold } } }),
  ]);

  // hi-rtk groupNames(대리점명)을 인사말에 표시
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { groupNames: true, lastSyncedAt: true },
      })
    : null;
  const dealerName = me?.groupNames?.split(",")[0]?.trim() || null;
  const syncing = me ? me.lastSyncedAt === null : false;

  // 시간대 기반 랜덤 인사말
  const greetingMessage = (() => {
    const hour = new Date().getHours();
    let pool: string[];
    if (hour >= 5 && hour < 11) {
      pool = [
        "활기찬 하루의 시작이에요. 좋은 아침입니다 ☀️",
        "오늘도 좋은 기운으로 시작해보세요 🌱",
        "굿모닝! 따뜻한 차 한 잔 어떠세요? ☕️",
        "상쾌한 아침이에요. 오늘 하루도 화이팅!",
      ];
    } else if (hour >= 11 && hour < 14) {
      pool = [
        "점심은 든든하게 챙기셨나요? 🍱",
        "잠깐 쉬어가는 시간, 어깨도 한 번 풀어주세요 💪",
        "오전 수고 많으셨어요. 잠시 한숨 돌려보세요",
        "맛있는 점심 시간 보내고 계신가요? 🥗",
      ];
    } else if (hour >= 14 && hour < 18) {
      pool = [
        "오후도 차근차근 잘 풀리고 있길 바라요 ✨",
        "집중 잘 되는 오후 보내고 계신가요?",
        "당이 부족하신가요? 달콤한 간식 한 입! 🍫",
        "오후 햇살이 좋네요. 잠깐 창밖도 보세요 🌤️",
      ];
    } else if (hour >= 18 && hour < 22) {
      pool = [
        "오늘 하루도 정말 수고 많으셨어요 💗",
        "저녁이에요. 든든하게 드시고 마무리해요 🍚",
        "고생한 오늘, 스스로에게 칭찬 한 마디 어때요?",
        "퇴근 모드 ON! 오늘도 고생 많으셨습니다 🎉",
      ];
    } else if (hour >= 22 || hour < 1) {
      pool = [
        "밤 늦게도 고생이 많으세요 🌙",
        "푹 쉬시고 내일 또 좋은 하루 보내세요",
        "오늘도 마무리 잘 하시고 편안한 밤 되세요 ✨",
      ];
    } else {
      pool = [
        "이 시간까지 고생이 많으십니다 🌙",
        "조금 쉬셔도 괜찮아요. 무리하지 마세요",
        "조용한 새벽, 차분히 함께해요",
      ];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  })();

  const [latestNotices, latestArchives] = await Promise.all([
    prisma.notice.findMany({
      take: 5,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, tag: true, pinned: true, createdAt: true },
    }),
    prisma.archive.findMany({
      take: 5,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true, title: true, ext: true, createdAt: true,
        category: { select: { name: true, colorId: true } },
      },
    }),
  ]);

  const TAG_COLOR: Record<string, { bg: string; color: string }> = {
    중요: { bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
    시스템: { bg: "rgba(26,28,30,0.06)", color: "#1A1C1E" },
    정책: { bg: "rgba(79,79,79,0.08)", color: "#4F4F4F" },
    일반: { bg: "#e8e9ea", color: "#4F4F4F" },
  };

  // 라이선스 시작일(startDate)이 가장 최근인 라이선스부터 정렬해 사이트 dedupe → 상위 5개 사이트.
  // 즉 "최근 라이선스가 발급된 고객사" 5건. 각 사이트의 대표 라이선스 = 그 사이트에서 가장 최근 시작된 라이선스.
  const recentLicenses = session?.user?.id
    ? await prisma.siteLicense.findMany({
        where: {
          site: { userId: session.user.id },
          startDate: { not: null },
        },
        orderBy: [{ startDate: "desc" }],
        include: { site: true },
      })
    : [];
  const seenSiteIds = new Set<string>();
  const recentSites = [];
  for (const l of recentLicenses) {
    if (seenSiteIds.has(l.siteId)) continue;
    seenSiteIds.add(l.siteId);
    recentSites.push({ ...l.site, licenses: [l] });
    if (recentSites.length >= 5) break;
  }
  const totalSiteCount = session?.user?.id
    ? await prisma.site.count({ where: { userId: session.user.id } })
    : 0;
  const recentSiteCount = session?.user?.id
    ? await prisma.site.count({
        where: {
          userId: session.user.id,
          OR: [
            { hiRtkRegDate: { gte: recentThreshold } },
            { hiRtkRegDate: null, syncedAt: { gte: recentThreshold } },
          ],
        },
      })
    : 0;

  // 가입 회선 수 = 본인이 멤버로 속한 사이트의 "활성" OFFICIAL 라이선스 동시접속 수 합계
  //   필터: site.userId == 본인 + siteLicenseType == 'OFFICIAL' + licenseStatus == true (활성)
  //   ※ hi-rtk 화면의 "활성/비활성" 표시와 일치하는 필드는 licenseStatus
  //     (expireStatus는 "기간 만료"만, activeStatus는 "admin 토글"만 — 둘의 결합이 licenseStatus)
  const officialSessionAgg = session?.user?.id
    ? await prisma.siteLicense.aggregate({
        where: {
          site: { userId: session.user.id },
          siteLicenseType: "OFFICIAL",
          licenseStatus: true,
        },
        _sum: { sessionCount: true },
      })
    : null;
  const officialSessionTotal = officialSessionAgg?._sum.sessionCount ?? 0;
  const recentOfficialSessionAgg = session?.user?.id
    ? await prisma.siteLicense.aggregate({
        where: {
          site: { userId: session.user.id },
          siteLicenseType: "OFFICIAL",
          licenseStatus: true,
          OR: [
            { startDate: { gte: recentThreshold } },
            { startDate: null, syncedAt: { gte: recentThreshold } },
          ],
        },
        _sum: { sessionCount: true },
      })
    : null;
  const recentOfficialSessionTotal = recentOfficialSessionAgg?._sum.sessionCount ?? 0;

  // PoC 라이선스 만료 임박 (2주 이내, 이미 만료된 것은 제외)
  const today = new Date();
  const expiringSoonThreshold = new Date();
  expiringSoonThreshold.setDate(expiringSoonThreshold.getDate() + 14);
  const expiringPocLicensesAll = session?.user?.id
    ? await prisma.siteLicense.findMany({
        where: {
          site: { userId: session.user.id },
          siteLicenseType: "POC",
          licenseStatus: true,
          endDate: { gte: today, lte: expiringSoonThreshold },
        },
        orderBy: [{ endDate: "asc" }],
        include: { site: { select: { id: true, name: true, alias: true, server: true } } },
      })
    : [];
  const expiringPocLicenses = expiringPocLicensesAll.slice(0, 5);
  const expiringPocCount = expiringPocLicensesAll.length;

  const PRODUCT_BADGE = { bg: "rgba(26,28,30,0.06)", color: "#1A1C1E" };
  const LICENSE_FALLBACK: Record<string, string> = {
    STANDARD: "#5726E2",
    BASIC: "#38A7DA",
    FREE: "#4ba59f",
  };
  const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
    OFFICIAL: { bg: "rgba(22,163,74,0.10)", color: "#16a34a" },
    POC: { bg: "rgba(230,0,126,0.10)", color: "#E6007E" },
    DEV: { bg: "rgba(79,79,79,0.10)", color: "#4F4F4F" },
  };
  const SERVER_COLOR: Record<string, { bg: string; color: string }> = {
    AWS: { bg: "rgba(255,153,0,0.12)", color: "#FF9900" },
    NCP: { bg: "rgba(3,199,90,0.12)", color: "#03C75A" },
  };
  const withAlpha = (hex: string, alpha = 0.12) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  };
  const formatJoinedAt = (date: Date | null) => {
    if (!date) return "날짜 미확인";
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (isToday) return "오늘";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
  };

  return (
    <div className="space-y-8 w-full">
      <SyncStatusPoller syncing={syncing} />
      {/* Welcome */}
      <div
        className="flex items-center justify-between rounded-2xl p-7"
        style={{
          background: "#ffffff",
          boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)",
        }}
      >
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
          >
            안녕하세요, {dealerName ? `${dealerName} ` : ""}{session?.user?.name}님
          </h2>
          <p className="text-sm mt-1" style={{ color: "#4F4F4F" }}>
            {greetingMessage}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="고객사" value={String(totalSiteCount)} delta={recentSiteCount} />
        <MetricCard
          label="활성화 라이선스"
          value={officialSessionTotal.toLocaleString("ko-KR")}
          delta={recentOfficialSessionTotal}
        />
        <MetricCard
          label="새로운 공지"
          value={String(noticeCount)}
          delta={recentNoticeCount}
          href="/notice"
        />
        <MetricCard
          label="새로운 자료"
          value={String(archiveCount)}
          delta={recentArchiveCount}
          href="/archive"
        />
      </div>

      {/* 신규 가입 고객 + PoC 마감 임박 — 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* PoC 만료 임박 — 우측 배치 */}
      <div
        className="rounded-2xl p-7 lg:order-2"
        style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
      >
        <div className="flex justify-between items-start gap-3 mb-5">
          <div className="min-w-0">
            <h3
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
            >
              PoC 마감 임박
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
              2주 이내 종료되는 PoC 라이선스에요. 영업 기회를 놓치지 마세요 🔥
            </p>
          </div>
          {expiringPocCount > 5 ? (
            <Link
              href="/customers?filter=poc-expiring"
              className="shrink-0 whitespace-nowrap text-xs transition-colors hover:text-[#E6007E]"
              style={{ color: "#9ca3af" }}
            >
              더보기 &rsaquo;
            </Link>
          ) : (
            expiringPocCount > 0 && (
              <span
                className="shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-md font-semibold"
                style={{ background: "rgba(230,0,126,0.08)", color: "#E6007E" }}
              >
                {expiringPocCount}건
              </span>
            )
          )}
        </div>

        {expiringPocLicenses.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "#9ca3af" }}>
            2주 이내 만료 예정인 PoC 라이선스가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {expiringPocLicenses.map((l) => {
              const end = l.endDate ? new Date(l.endDate) : null;
              const daysLeft = end
                ? Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              const urgent = daysLeft <= 7;
              const server = l.site.server;
              const serverColor = SERVER_COLOR[server];
              return (
                <Link
                  key={l.id}
                  href="/customers"
                  className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 rounded-xl transition-colors hover:bg-[#f8f9fa]"
                  style={{ background: "#fafbfc" }}
                >
                  {/* D-day 뱃지 */}
                  <div
                    className="flex items-center justify-center px-3 h-10 rounded-lg shrink-0"
                    style={{
                      background: urgent ? "rgba(230,0,126,0.10)" : "rgba(26,28,30,0.04)",
                      color: urgent ? "#E6007E" : "#4F4F4F",
                    }}
                  >
                    <span
                      className="text-sm font-bold whitespace-nowrap"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      D-{daysLeft}
                    </span>
                  </div>
                  {/* 사이트 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: "#1A1C1E" }}
                      >
                        {l.site.alias || l.site.name}
                      </span>
                      {serverColor && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                          style={{ background: serverColor.bg, color: serverColor.color }}
                        >
                          {server === "NCP" ? "네이버공공클라우드" : server}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap" style={{ color: "#9ca3af" }}>
                      {l.licenseName && <span>{l.licenseName}</span>}
                      {l.plan && <span>· {l.plan}</span>}
                      {typeof l.sessionCount === "number" && <span>· 동시접속 {l.sessionCount}</span>}
                      {/* 모바일: 만료일을 인라인 표시 */}
                      {end && (
                        <span className="md:hidden">
                          · 만료 {end.getFullYear()}.{String(end.getMonth() + 1).padStart(2, "0")}.{String(end.getDate()).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 만료일 — 데스크탑만 우측 별도 컬럼 */}
                  <div className="hidden md:block text-right shrink-0">
                    <div className="text-xs" style={{ color: "#9ca3af" }}>만료일</div>
                    <div className="text-sm font-medium mt-0.5" style={{ color: "#1A1C1E" }}>
                      {end
                        ? `${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, "0")}.${String(end.getDate()).padStart(2, "0")}`
                        : "-"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent customer sites */}
      <div
        className="rounded-2xl p-7"
        style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
      >
        <div className="flex justify-between items-center mb-5">
          <h3
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
          >
            신규 가입 고객
          </h3>
          <Link
            href="/customers"
            className="text-xs transition-colors hover:text-[#E6007E]"
            style={{ color: "#9ca3af" }}
          >
            더보기 &rsaquo;
          </Link>
        </div>

        {recentSites.length === 0 ? (
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            최근 가입한 고객사가 없습니다. hi-rtk.io 계정으로 로그인하면 자동 동기화됩니다.
          </p>
        ) : (
          <div className="space-y-1">
            {recentSites.map((site) => {
              // hi-rtk 측위 콘솔 직링크 — 사이트 코드를 서브도메인으로 사용
              const externalUrl =
                site.productHost && site.name
                  ? `https://${site.name}.${site.productHost}${site.productContextPath ?? ""}`
                  : null;
              // 대표 라이선스 — include 정렬상 첫 번째 (활성 OFFICIAL 우선)
              const lic = site.licenses[0] ?? null;
              const licColor =
                lic?.licenseColor ||
                (lic?.licenseType ? LICENSE_FALLBACK[lic.licenseType] : null) ||
                "#9ca3af";
              const joinedAt = lic?.startDate ? new Date(lic.startDate) : null;
              return (
                <div
                  key={site.id}
                  className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "transparent" }}
                >
                  {/* 사이트명 + 서버 라벨 + 사이트 주소 */}
                  <div className="flex-1 min-w-0 w-full">
                    <div
                      className="text-sm font-medium truncate flex items-center gap-1.5 min-w-0"
                      style={{ color: "#1A1C1E" }}
                    >
                      {site.bookmark && (
                        <span style={{ color: "#E6007E" }} className="inline-flex shrink-0">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </span>
                      )}
                      <span className="truncate">{site.alias || site.name}</span>
                      {site.server && SERVER_COLOR[site.server] && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0"
                          style={{
                            background: SERVER_COLOR[site.server].bg,
                            color: SERVER_COLOR[site.server].color,
                          }}
                          title="서버 환경"
                        >
                          {site.server === "NCP" ? "네이버공공클라우드" : site.server}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {externalUrl ? (
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] truncate transition-colors hover:text-[#E6007E] shrink min-w-0 max-w-[280px]"
                          style={{ color: "#9ca3af" }}
                        >
                          {externalUrl}
                        </a>
                      ) : (
                        <div
                          className="text-[11px] truncate shrink min-w-0 max-w-[280px]"
                          style={{ color: "#9ca3af" }}
                        >
                          {site.name}
                        </div>
                      )}
                      <span className="text-[11px] shrink-0" style={{ color: "#9ca3af" }}>
                        {formatJoinedAt(joinedAt)}
                      </span>
                    </div>
                  </div>

                  {/* 구분 / 라이선스 / 요금제 / 동시접속 / 제품 */}
                  <div className="flex items-center gap-1.5 flex-wrap md:shrink-0">
                    {lic?.siteLicenseType && TYPE_COLOR[lic.siteLicenseType] && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                        style={{
                          background: TYPE_COLOR[lic.siteLicenseType].bg,
                          color: TYPE_COLOR[lic.siteLicenseType].color,
                        }}
                        title="구분"
                      >
                        {lic.siteLicenseType}
                      </span>
                    )}
                    {lic?.licenseName && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                        style={{ background: withAlpha(licColor, 0.12), color: licColor }}
                        title="라이선스"
                      >
                        {lic.licenseName}
                      </span>
                    )}
                    {lic?.plan && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium max-w-[160px] truncate"
                        style={{ background: "rgba(79,79,79,0.08)", color: "#4F4F4F" }}
                        title={`요금제: ${lic.plan}`}
                      >
                        {lic.plan}
                      </span>
                    )}
                    {typeof lic?.sessionCount === "number" && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ background: "#edeeef", color: "#4F4F4F" }}
                        title="동시접속 수"
                      >
                        ⇄ {lic.sessionCount}
                      </span>
                    )}
                    {site.productName && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ background: PRODUCT_BADGE.bg, color: PRODUCT_BADGE.color }}
                        title="제품"
                      >
                        {site.productName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>

      {/* Latest notices */}
      <div
        className="rounded-2xl p-7"
        style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
      >
          <div className="flex justify-between items-center mb-5">
            <h3
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
            >
              공지사항
            </h3>
            <Link
              href="/notice"
              className="text-xs transition-colors hover:text-[#E6007E]"
              style={{ color: "#9ca3af" }}
            >
              더보기 &rsaquo;
            </Link>
          </div>

          {latestNotices.length === 0 ? (
            <p className="text-sm" style={{ color: "#9ca3af" }}>등록된 공지사항이 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {latestNotices.map((notice) => {
                const tag = TAG_COLOR[notice.tag] ?? TAG_COLOR["일반"];
                return (
                  <Link
                    key={notice.id}
                    href={`/notice?openId=${notice.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
                    style={{ background: "transparent" }}
                  >
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0"
                      style={{ background: tag.bg, color: tag.color }}
                    >
                      {notice.tag}
                    </span>
                    <span
                      className="text-sm flex-1 truncate font-medium"
                      style={{ color: "#1A1C1E" }}
                    >
                      {notice.pinned && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-px"
                          style={{ background: "#E6007E", verticalAlign: "middle" }}
                        />
                      )}
                      {notice.title}
                    </span>
                    <span className="text-[11px] shrink-0" style={{ color: "#9ca3af" }}>
                      {notice.createdAt.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
      </div>

      {/* Latest archives */}
      <div
        className="rounded-2xl p-7"
        style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
      >
        <div className="flex justify-between items-center mb-5">
          <h3
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
          >
            자료실
          </h3>
          <Link
            href="/archive"
            className="text-xs transition-colors hover:text-[#E6007E]"
            style={{ color: "#9ca3af" }}
          >
            더보기 &rsaquo;
          </Link>
        </div>

        {latestArchives.length === 0 ? (
          <p className="text-sm" style={{ color: "#9ca3af" }}>등록된 자료가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {latestArchives.map((archive) => {
              const cat = getCategoryColor(archive.category.colorId);
              return (
                <Link
                  key={archive.id}
                  href={`/archive?openId=${archive.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
                  style={{ background: "transparent" }}
                >
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0"
                    style={{ background: cat.bg, color: cat.color }}
                  >
                    {archive.category.name}
                  </span>
                  <span
                    className="text-sm flex-1 truncate font-medium"
                    style={{ color: "#1A1C1E" }}
                  >
                    {archive.title}
                  </span>
                  {archive.ext && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
                      style={{ background: "#f3f4f5", color: "#6b7280" }}
                    >
                      {archive.ext}
                    </span>
                  )}
                  <span className="text-[11px] shrink-0" style={{ color: "#9ca3af" }}>
                    {archive.createdAt.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  delta,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** 최근 변동량 (양수=증가, 0=변동 없음). undefined면 표시하지 않음 */
  delta?: number;
  /** 클릭 시 이동할 경로. 지정하면 카드 전체가 링크로 변환 */
  href?: string;
}) {
  const showDelta = delta !== undefined;
  const positive = (delta ?? 0) > 0;
  const Wrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link
          href={href}
          className="block rounded-2xl p-5 transition-shadow hover:shadow-lg"
          style={{
            background: "#ffffff",
            boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)",
          }}
        >
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "#ffffff",
            boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)",
          }}
        >
          {children}
        </div>
      );

  return (
    <Wrapper>
      <div className="text-[11px] uppercase tracking-wider mb-3" style={{ color: "#9ca3af" }}>
        {label}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div
          className="text-3xl font-bold"
          style={{
            fontFamily: "var(--font-display)",
            color: accent ? "#E6007E" : "#1A1C1E",
          }}
        >
          {value}
        </div>
        {showDelta && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold"
            style={{
              background: positive ? "rgba(230,0,126,0.08)" : "#edeeef",
              color: positive ? "#E6007E" : "#9ca3af",
            }}
            title="최근 7일 신규"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            +{delta}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: "#9ca3af" }}>{sub}</div>
      )}
    </Wrapper>
  );
}
