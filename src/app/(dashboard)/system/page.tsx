import { prisma } from "@/lib/db";

export default async function SystemPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { archives: true } } },
  });

  const COLOR_MAP: Record<string, { bg: string; dot: string }> = {
    blue: { bg: "bg-indigo-50", dot: "bg-indigo-500" },
    green: { bg: "bg-green-50", dot: "bg-green-500" },
    amber: { bg: "bg-orange-50", dot: "bg-orange-500" },
    sky: { bg: "bg-sky-50", dot: "bg-sky-500" },
    pink: { bg: "bg-fuchsia-50", dot: "bg-fuchsia-500" },
    gray: { bg: "bg-stone-100", dot: "bg-stone-500" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">시스템 관리</h1>
        <button className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm rounded-lg transition-colors">
          카테고리 추가
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <h2 className="text-sm font-medium text-stone-700 mb-3">
          자료실 카테고리 관리
        </h2>
        <div className="space-y-2">
          {categories.map((cat) => {
            const color = COLOR_MAP[cat.colorId] ?? COLOR_MAP.gray;
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-stone-100 hover:border-stone-200 transition-colors"
              >
                <span className="text-stone-300 cursor-grab">⠿</span>
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                <span className="text-sm font-medium flex-1">{cat.name}</span>
                <span className="text-xs text-stone-400">
                  {cat._count.archives}개
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    cat.active
                      ? "bg-green-50 text-green-700"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {cat.active ? "활성" : "비활성"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
