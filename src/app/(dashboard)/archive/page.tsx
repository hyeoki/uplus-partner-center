import { prisma } from "@/lib/db";

export default async function ArchivePage() {
  const archives = await prisma.archive.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const CAT_STYLE: Record<string, string> = {
    "소개서": "bg-indigo-50 text-indigo-700",
    "브로슈어": "bg-green-50 text-green-700",
    "제품 데이터시트": "bg-orange-50 text-orange-700",
    "사용자 가이드": "bg-sky-50 text-sky-700",
    "기타": "bg-stone-100 text-stone-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">자료실</h1>
        <button className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm rounded-lg transition-colors">
          자료 등록
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-stone-400 text-xs">
              <th className="text-left py-3 px-4 font-medium">카테고리</th>
              <th className="text-left py-3 px-4 font-medium">자료명</th>
              <th className="text-left py-3 px-4 font-medium">등���일</th>
              <th className="text-right py-3 px-4 font-medium">다운로드</th>
            </tr>
          </thead>
          <tbody>
            {archives.map((archive) => (
              <tr
                key={archive.id}
                className="border-b border-stone-50 hover:bg-stone-50 transition-colors"
              >
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${CAT_STYLE[archive.category.name] ?? CAT_STYLE["기타"]}`}>
                    {archive.category.name}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div>
                    <span className="font-medium text-stone-800">{archive.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {archive.ext && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded">
                          {archive.ext}
                        </span>
                      )}
                      {archive.size && (
                        <span className="text-xs text-stone-400">{archive.size}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-stone-400 text-xs">
                  {archive.createdAt.toLocaleDateString("ko-KR")}
                </td>
                <td className="py-3 px-4 text-right text-stone-500 text-xs">
                  {archive.downloads}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
