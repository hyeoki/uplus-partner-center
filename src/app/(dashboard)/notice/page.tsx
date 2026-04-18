import { prisma } from "@/lib/db";
import { Suspense } from "react";
import NoticeShell from "@/components/notice-shell";
import { auth } from "@/lib/auth";
import { parseRoleNamesField } from "@/lib/role-access";

export default async function NoticePage() {
  const session = await auth();
  // 본인 역할/권한 가져오기 (visibleRoles 매칭 + admin 체크)
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { roleNames: true, role: true },
      })
    : null;
  const myRoles = parseRoleNamesField(me?.roleNames);
  const isAdmin = me?.role === "admin";

  // 조회 권한 필터:
  //   - visibleRoles가 null/empty: 전체 공개 → 항상 노출
  //   - 그 외: 본인 역할 중 하나라도 매칭되면 노출 (",role,"로 contains)
  const roleFilter =
    myRoles.length > 0
      ? {
          OR: [
            { visibleRoles: null },
            { visibleRoles: "" },
            ...myRoles.map((r) => ({
              visibleRoles: { contains: `,${r},` },
            })),
          ],
        }
      : { OR: [{ visibleRoles: null }, { visibleRoles: "" }] };

  const notices = await prisma.notice.findMany({
    where: roleFilter,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, title: true, content: true,
      tag: true, pinned: true, visibleRoles: true,
      authorId: true, createdAt: true,
      author: { select: { name: true } },
    },
  });

  return (
    <Suspense fallback={null}>
      <NoticeShell notices={notices} isAdmin={isAdmin} currentUserId={session?.user?.id ?? null} />
    </Suspense>
  );
}
