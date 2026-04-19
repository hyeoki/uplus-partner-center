/**
 * 대시보드 영역 공통 스켈레톤.
 * 로그인 직후 또는 메뉴 전환 시 콘텐츠 로딩 동안 표시.
 * 사이드바는 layout.tsx에서 즉시 렌더되므로 본문만 스켈레톤.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 */}
      <div className="flex items-baseline gap-3">
        <div className="h-7 w-40 rounded-md bg-gray-200" />
        <div className="h-4 w-20 rounded-md bg-gray-100" />
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 bg-white"
            style={{ boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}
          >
            <div className="h-3 w-16 rounded-md bg-gray-100 mb-3" />
            <div className="h-7 w-12 rounded-md bg-gray-200 mb-2" />
            <div className="h-3 w-20 rounded-md bg-gray-100" />
          </div>
        ))}
      </div>

      {/* 본문 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 bg-white space-y-3"
            style={{ boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}
          >
            <div className="h-5 w-32 rounded-md bg-gray-200 mb-3" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 py-2">
                <div className="h-4 w-14 rounded-md bg-gray-100 shrink-0" />
                <div className="h-4 flex-1 rounded-md bg-gray-100" />
                <div className="h-3 w-16 rounded-md bg-gray-100 shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
