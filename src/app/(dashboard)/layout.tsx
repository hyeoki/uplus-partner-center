import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/sidebar";
import ChatbotWidget from "@/components/chatbot-widget";
import GlobalSearch from "@/components/global-search";
import { FavoritesProvider } from "@/hooks/useFavorites";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  // 사이드바 프로필 + 권한 (hi-rtk 동기화 + 우리 role)
  const me = session.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { photoUrl: true, name: true, role: true },
      })
    : null;
  const profile = {
    name: me?.name ?? session.user?.name ?? "사용자",
    photoUrl: me?.photoUrl ?? null,
  };
  const isAdmin = me?.role === "admin";

  return (
    <FavoritesProvider>
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8f9fa" }}>
      <Sidebar profile={profile} isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto" style={{ background: "#f8f9fa" }}>
        {/* Beta 안내 배너 + 통합 검색 */}
        <div className="sticky top-0 z-10 px-8 pt-5 pb-1 flex items-center gap-3">
          <a
            href="/inquiry?compose=1"
            className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: "linear-gradient(90deg, rgba(230,0,126,0.08) 0%, rgba(230,0,126,0.14) 100%)",
              color: "#7a1148",
              border: "1px solid rgba(230, 0, 126, 0.18)",
              boxShadow: "0px 4px 16px rgba(230, 0, 126, 0.08)",
            }}
          >
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wider shrink-0"
              style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
            >
              BETA
            </span>
            <span>
              파트너센터는 현재 베타 운영 중이에요. 사용하시면서 불편한 점이나 제안이 있다면{" "}
              <span className="font-semibold underline underline-offset-2" style={{ color: "#E6007E" }}>
                여기를 눌러 의견
              </span>
              을 들려주세요 🙌
            </span>
          </a>
          <GlobalSearch />
        </div>
        <div className="p-8">{children}</div>
        <ChatbotWidget />
      </main>
    </div>
    </FavoritesProvider>
  );
}
