import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin";
import SystemChatbotSettings from "@/components/system-chatbot-settings";
import CategoryManager from "@/components/category-manager";
import TagManager from "@/components/tag-manager";
import { getChatbotSettings, maskApiKey } from "@/lib/chatbot-settings";

export default async function SystemPage() {
  if (!(await isCurrentUserAdmin())) redirect("/home");

  const [categories, noticeTags, chatbotSettings] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { archives: true } } },
    }),
    prisma.noticeTag.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    getChatbotSettings(),
  ]);
  // 태그별 사용 공지 수 — name 매칭으로 group
  const noticeCountByTag = await prisma.notice.groupBy({
    by: ["tag"],
    _count: { tag: true },
  });
  const tagCountMap = new Map<string, number>(
    noticeCountByTag.map((r) => [r.tag, r._count.tag]),
  );

  return (
    <div className="space-y-6 w-full">
      {/* Page header */}
      <div>
        <h1
          className="text-xl font-bold"
          style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
        >
          시스템 관리
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#9ca3af" }}>
          자료실 카테고리 및 시스템 설정을 관리합니다.
        </p>
      </div>

      <SystemChatbotSettings
        defaultAgent={chatbotSettings.agent}
        maskedApiKey={maskApiKey(chatbotSettings.apiKey)}
        hasApiKey={Boolean(chatbotSettings.apiKey)}
      />

      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          colorId: c.colorId,
          active: c.active,
          archiveCount: c._count.archives,
        }))}
      />

      <TagManager
        tags={noticeTags.map((t) => ({
          id: t.id,
          name: t.name,
          colorId: t.colorId,
          active: t.active,
          noticeCount: tagCountMap.get(t.name) ?? 0,
        }))}
      />

      {/* System info card */}
      <div
        className="rounded-2xl p-7"
        style={{
          background: "#ffffff",
          boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)",
        }}
      >
        <h2
          className="text-sm font-semibold mb-5"
          style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
        >
          시스템 정보
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "서비스명", value: "U+ 초정밀측위 파트너센터" },
            { label: "버전", value: "v0.5.0 Beta" },
            { label: "데이터베이스", value: "SQLite (Prisma ORM)" },
            { label: "서버 상태", value: "정상 운영 중" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="px-4 py-3.5 rounded-xl"
              style={{ background: "#f8f9fa" }}
            >
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "#9ca3af" }}>
                {label}
              </div>
              <div className="text-sm font-medium" style={{ color: "#1A1C1E" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
