import { prisma } from "@/lib/db";

export default async function NoticePage() {
  const notices = await prisma.notice.findMany({
    include: { author: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  const TAG_STYLE: Record<string, string> = {
    "중요": "bg-rose-50 text-rose-700",
    "시스템": "bg-blue-50 text-blue-700",
    "정책": "bg-amber-50 text-amber-700",
    "일반": "bg-stone-100 text-stone-600",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">공지사항</h1>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-stone-400 text-xs">
              <th className="text-left py-3 px-4 font-medium">태그</th>
              <th className="text-left py-3 px-4 font-medium">제목</th>
              <th className="text-left py-3 px-4 font-medium">작성일</th>
            </tr>
          </thead>
          <tbody>
            {notices.map((notice) => (
              <tr
                key={notice.id}
                className="border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TAG_STYLE[notice.tag] ?? TAG_STYLE["일반"]}`}>
                    {notice.tag}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-medium text-stone-800">
                    {notice.pinned && <span className="text-fuchsia-500 mr-1">📌</span>}
                    {notice.title}
                  </span>
                </td>
                <td className="py-3 px-4 text-stone-400 text-xs">
                  {notice.createdAt.toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
