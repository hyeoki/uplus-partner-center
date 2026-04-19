import { prisma } from "@/lib/db";
import { Suspense } from "react";
import ArchiveShell from "@/components/archive-shell";
import { auth } from "@/lib/auth";
import { parseRoleNamesField } from "@/lib/role-access";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;

  const session = await auth();
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { roleNames: true, role: true },
      })
    : null;
  const myRoles = parseRoleNamesField(me?.roleNames);
  const isAdmin = me?.role === "admin";
  // admin은 모든 자료 조회 가능 (visibleRoles 필터 우회)
  const roleFilter = isAdmin
    ? {}
    : myRoles.length > 0
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

  const [allArchives, categories] = await Promise.all([
    prisma.archive.findMany({
      where: roleFilter,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, content: true, type: true,
        ext: true, size: true, url: true, fileName: true,
        downloads: true, visibleRoles: true,
        createdAt: true, categoryId: true,
        category: { select: { id: true, name: true, colorId: true } },
        author: { select: { name: true, photoUrl: true } },
      },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, colorId: true },
    }),
  ]);

  const filteredArchives = allArchives.filter((a) => {
    const matchQ = q ? a.title.toLowerCase().includes(q.toLowerCase()) : true;
    const matchCat = category ? a.categoryId === Number(category) : true;
    return matchQ && matchCat;
  });

  return (
    <Suspense fallback={null}>
      <ArchiveShell
        categories={categories}
        allArchives={allArchives}
        filteredArchives={filteredArchives}
        q={q}
        category={category}
        isAdmin={isAdmin}
      />
    </Suspense>
  );
}
