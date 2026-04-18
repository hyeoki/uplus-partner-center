"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { encodeRoles } from "@/lib/role-access";
import { isCurrentUserAdmin } from "@/lib/admin";

export async function createNotice(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "인증이 필요합니다." };
  if (!(await isCurrentUserAdmin())) return { error: "관리자 권한이 필요합니다." };

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const tag = formData.get("tag") as string;
  const pinned = formData.get("pinned") === "on";
  // visibleRoles: "role1,role2" CSV. 빈 값이면 전체 공개(null).
  const visibleRolesRaw = (formData.get("visibleRoles") as string | null) ?? "";
  const visibleRoles = encodeRoles(
    visibleRolesRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!title?.trim() || !content?.trim()) return { error: "제목과 내용을 입력해주세요." };

  await prisma.notice.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      tag: tag || "일반",
      pinned,
      visibleRoles,
      authorId: session.user.id,
    },
  });

  revalidatePath("/notice");
  return { success: true };
}

/** admin 또는 작성자만 수정 가능 */
export async function updateNotice(noticeId: number, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "인증이 필요합니다." };

  const existing = await prisma.notice.findUnique({ where: { id: noticeId }, select: { authorId: true } });
  if (!existing) return { error: "존재하지 않는 공지입니다." };
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin && existing.authorId !== session.user.id) {
    return { error: "본인이 작성한 공지만 수정할 수 있습니다." };
  }

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const tag = formData.get("tag") as string;
  const pinned = formData.get("pinned") === "on";
  const visibleRolesRaw = (formData.get("visibleRoles") as string | null) ?? "";
  const visibleRoles = encodeRoles(
    visibleRolesRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!title?.trim() || !content?.trim()) return { error: "제목과 내용을 입력해주세요." };

  await prisma.notice.update({
    where: { id: noticeId },
    data: {
      title: title.trim(),
      content: content.trim(),
      tag: tag || "일반",
      pinned,
      visibleRoles,
    },
  });

  revalidatePath("/notice");
  return { success: true };
}

/** admin 또는 작성자만 삭제 가능 */
export async function deleteNotice(noticeId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("인증이 필요합니다.");

  const existing = await prisma.notice.findUnique({ where: { id: noticeId }, select: { authorId: true } });
  if (!existing) throw new Error("존재하지 않는 공지입니다.");
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin && existing.authorId !== session.user.id) {
    throw new Error("본인이 작성한 공지만 삭제할 수 있습니다.");
  }

  await prisma.notice.delete({ where: { id: noticeId } });
  revalidatePath("/notice");
}
