"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** CSV ",href1,href2," → string[] */
function parse(csv: string | null): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

function encode(list: string[]): string {
  if (list.length === 0) return "";
  return `,${list.join(",")},`;
}

/** 현재 사용자의 즐겨찾기 메뉴 토글 (DB 저장) */
export async function toggleFavoriteMenu(href: string): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteMenus: true },
  });
  const current = parse(user?.favoriteMenus ?? null);
  const next = current.includes(href)
    ? current.filter((h) => h !== href)
    : [...current, href];

  await prisma.user.update({
    where: { id: session.user.id },
    data: { favoriteMenus: encode(next) },
  });

  return next;
}
