import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function HomePage() {
  const session = await auth();
  const noticeCount = await prisma.notice.count();
  const archiveCount = await prisma.archive.count();

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between bg-white rounded-xl p-5 border border-stone-200">
        <div>
          <h2 className="text-lg font-medium">
            안녕하세요, {session?.user?.name}님
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            오늘도 파트너센터를 이용해 주셔서 감사합니다.
          </p>
        </div>
        <span className="px-3 py-1 bg-fuchsia-50 text-fuchsia-700 text-xs font-medium rounded-full">
          골드 파트너
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="미확인 공지" value={String(noticeCount)} sub="전체 공지사항" accent />
        <MetricCard label="신규 자료" value={String(archiveCount)} sub="등���된 자료" />
        <MetricCard label="계정 상태" value="정상" sub="마지막 로그인 오늘" />
        <MetricCard label="파트너 등급" value="골드" sub="2025년 1월 갱신" accent />
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium">최신 공지사항</h3>
            <a href="/notice" className="text-xs text-stone-400 hover:text-fuchsia-600">
              전체보기 &rsaquo;
            </a>
          </div>
          <p className="text-sm text-stone-400">공지사항이 여기에 표시됩니다.</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-stone-200">
          <h3 className="text-sm font-medium mb-4">빠른 메뉴</h3>
          <p className="text-sm text-stone-400">빠른 메뉴가 여기에 표시됩니다.</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-stone-200">
      <div className="text-xs text-stone-400 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${accent ? "text-fuchsia-600" : "text-stone-900"}`}>
        {value}
      </div>
      <div className="text-xs text-stone-400 mt-1">{sub}</div>
    </div>
  );
}
