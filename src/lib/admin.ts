import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 현재 로그인 사용자의 role 조회. 미로그인 시 null.
 * (User.role: "partner" | "admin")
 */
export async function getCurrentUserRole(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role ?? null;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === "admin";
}
