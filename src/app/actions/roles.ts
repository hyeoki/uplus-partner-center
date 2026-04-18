"use server";

import { prisma } from "@/lib/db";
import { parseRoleNamesField } from "@/lib/role-access";

/**
 * 등록 폼에서 사용 가능한 역할 옵션 목록.
 * 1순위: hi-rtk 시스템 전체 역할 (KnownRole — 로그인 시 동기화)
 * 2순위(폴백): 기존 User.roleNames union (KnownRole이 비어있는 신규 환경)
 */
export async function listAvailableRoles(): Promise<string[]> {
  const known = await prisma.knownRole.findMany({
    select: { name: true },
    orderBy: { hiRtkRoleEid: "asc" },
  });
  if (known.length > 0) return known.map((r) => r.name);

  // 폴백: 한 번이라도 로그인한 User의 roleNames union
  const users = await prisma.user.findMany({
    select: { roleNames: true },
    where: { roleNames: { not: null } },
  });
  const set = new Set<string>();
  for (const u of users) {
    for (const r of parseRoleNamesField(u.roleNames)) set.add(r);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}
