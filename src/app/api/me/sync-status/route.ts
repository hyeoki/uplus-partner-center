import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 로그인 직후 background sync 완료 여부 폴링용.
 * - ready: lastSyncedAt이 set되어 있으면 true
 * - 클라이언트는 ready=true가 될 때까지 2초마다 폴링 → router.refresh()로 새 데이터 로드
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ready: false }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastSyncedAt: true },
  });
  return NextResponse.json({ ready: user?.lastSyncedAt !== null });
}
