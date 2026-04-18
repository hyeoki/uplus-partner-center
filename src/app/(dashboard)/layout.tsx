import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/sidebar";
import ChatbotWidget from "@/components/chatbot-widget";
import TopHeaderBar from "@/components/top-header-bar";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { MobileMenuProvider } from "@/hooks/useMobileMenu";

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
        select: { photoUrl: true, name: true, role: true, favoriteMenus: true },
      })
    : null;
  const profile = {
    name: me?.name ?? session.user?.name ?? "사용자",
    photoUrl: me?.photoUrl ?? null,
  };
  const isAdmin = me?.role === "admin";
  const favoritesInitial = me?.favoriteMenus
    ? me.favoriteMenus.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <FavoritesProvider initial={favoritesInitial}>
    <MobileMenuProvider>
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8f9fa" }}>
      <Sidebar profile={profile} isAdmin={isAdmin} />
      <main className="flex-1 overflow-y-auto min-w-0" style={{ background: "#f8f9fa" }}>
        {/* Beta 안내 배너 + 통합 검색 (스크롤 시 배경 불투명도 강화) */}
        <TopHeaderBar />
        <div className="p-4 md:p-8">{children}</div>
        <ChatbotWidget />
      </main>
    </div>
    </MobileMenuProvider>
    </FavoritesProvider>
  );
}
