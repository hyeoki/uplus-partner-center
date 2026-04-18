import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin";
import SystemChatbotSettings from "@/components/system-chatbot-settings";
import CategoryManager from "@/components/category-manager";
import { getChatbotSettings, maskApiKey } from "@/lib/chatbot-settings";

export default async function SystemPage() {
  if (!(await isCurrentUserAdmin())) redirect("/home");

  const [categories, chatbotSettings] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { archives: true } } },
    }),
    getChatbotSettings(),
  ]);

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
            { label: "버전", value: "v1.0.0" },
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
