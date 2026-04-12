import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-stone-100 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">
              {session.user?.name}님
            </span>
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5v2.5L2 10h12l-1.5-1.5V6A4.5 4.5 0 008 1.5z" stroke="#888" strokeWidth="1.3" />
                <path d="M6.5 12a1.5 1.5 0 003 0" stroke="#888" strokeWidth="1.3" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-fuchsia-500 rounded-full" />
            </div>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
