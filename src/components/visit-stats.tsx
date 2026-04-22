import { prisma } from "@/lib/db";
import ListAvatar from "@/components/list-avatar";

/**
 * 방문 통계 — admin 전용 (시스템 관리 화면에 임베드).
 * - 오늘 / 이번주 / 전체 방문자 수 (unique user)
 * - 최근 방문 목록 30건
 */
export default async function VisitStats() {
  const now = new Date();

  // 오늘 자정 (로컬 시간)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 이번주 시작 (월요일 기준)
  const dayOfWeek = (now.getDay() + 6) % 7; // 월=0, 일=6
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - dayOfWeek);

  const [todayVisits, weekVisits, totalVisits, recent] = await Promise.all([
    prisma.visit.findMany({
      where: { createdAt: { gte: todayStart } },
      select: { userId: true },
    }),
    prisma.visit.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { userId: true },
    }),
    prisma.visit.count(),
    prisma.visit.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: { select: { name: true, loginId: true, photoUrl: true, role: true } },
      },
    }),
  ]);

  const todayUnique = new Set(todayVisits.map((v) => v.userId)).size;
  const weekUnique = new Set(weekVisits.map((v) => v.userId)).size;

  const stats = [
    { label: "오늘 방문자", value: todayUnique, sub: `총 ${todayVisits.length}회` },
    { label: "이번주 방문자", value: weekUnique, sub: `총 ${weekVisits.length}회` },
    { label: "누적 방문", value: totalVisits, sub: "전체 기간" },
  ];

  return (
    <div
      className="rounded-2xl p-7"
      style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}
    >
      <h2
        className="text-sm font-semibold mb-5"
        style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
      >
        방문 통계
      </h2>

      {/* 카드 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, value, sub }) => (
          <div
            key={label}
            className="px-5 py-4 rounded-xl"
            style={{ background: "#f8f9fa" }}
          >
            <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: "#9ca3af" }}>
              {label}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-display)", color: "#E6007E" }}
              >
                {value.toLocaleString("ko-KR")}
              </span>
              <span className="text-xs" style={{ color: "#9ca3af" }}>명</span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* 최근 방문 목록 */}
      <div>
        <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "#9ca3af" }}>
          최근 방문 {recent.length}건
        </div>
        {recent.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "#9ca3af" }}>
            아직 방문 기록이 없습니다.
          </p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f3f5" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#fafbfc", borderBottom: "1px solid #f1f3f5" }}>
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#9ca3af" }}>방문자</th>
                  <th className="hidden md:table-cell text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#9ca3af" }}>IP</th>
                  <th className="text-right px-4 py-2.5 text-[11px] uppercase tracking-wider font-medium" style={{ color: "#9ca3af" }}>시각</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v, i) => (
                  <tr
                    key={v.id}
                    style={{ borderBottom: i === recent.length - 1 ? "none" : "1px solid #f3f4f5" }}
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <ListAvatar name={v.user.name} photoUrl={v.user.photoUrl} />
                        <span className="font-medium" style={{ color: "#1A1C1E" }}>
                          {v.user.name}
                        </span>
                        <span className="text-[11px]" style={{ color: "#9ca3af" }}>
                          {v.user.loginId}
                        </span>
                        {v.user.role === "admin" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                            style={{ background: "rgba(230,0,126,0.10)", color: "#E6007E" }}
                          >
                            admin
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-xs" style={{ color: "#9ca3af" }}>
                      {v.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap" style={{ color: "#9ca3af" }}>
                      {formatRelative(v.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
