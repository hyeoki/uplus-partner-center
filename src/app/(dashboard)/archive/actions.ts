"use server";

import { prisma } from "@/lib/db";
import { uploadAndShare } from "@/lib/nas";
import { revalidatePath } from "next/cache";
import path from "path";
import { encodeRoles } from "@/lib/role-access";
import { isCurrentUserAdmin } from "@/lib/admin";

export async function createArchive(formData: FormData) {
  if (!(await isCurrentUserAdmin())) return { error: "관리자 권한이 필요합니다." };

  const title = formData.get("title") as string;
  const categoryId = Number(formData.get("categoryId"));
  const content = (formData.get("content") as string) || null;
  const file = formData.get("file") as File | null;
  const visibleRolesRaw = (formData.get("visibleRoles") as string | null) ?? "";
  const visibleRoles = encodeRoles(
    visibleRolesRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!title || !categoryId) return { error: "필수 항목을 입력해주세요." };

  let ext: string | null = null;
  let size: string | null = null;
  let url: string | null = null;
  let fileName: string | null = null;

  if (file && file.size > 0) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name;
    const extRaw = path.extname(originalName).replace(".", "").toUpperCase();
    // 원본 파일명 그대로 사용. 충돌은 nas.ts에서 timestamp 폴더로 회피한다.
    // (cross-origin 직링크에서는 <a download>가 무시되므로 URL 마지막 segment가 다운로드 파일명이 된다)

    try {
      const { shareUrl } = await uploadAndShare(buffer, originalName);
      url = shareUrl;
    } catch (err) {
      console.error("[archive] NAS upload failed:", err);
      return { error: "NAS 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    ext = extRaw || null;
    size = formatBytes(file.size);
    fileName = originalName;
  }

  await prisma.archive.create({
    data: {
      title,
      content,
      categoryId,
      type: file && file.size > 0 ? "file" : "link",
      ext,
      size,
      url,
      fileName,
      visibleRoles,
      downloads: 0,
    },
  });

  revalidatePath("/archive");
  return { success: true };
}

export async function incrementDownload(id: number) {
  await prisma.archive.update({
    where: { id },
    data: { downloads: { increment: 1 } },
  });
  revalidatePath("/archive");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** admin 전용 — 자료 메타 수정 (파일 변경 X) */
export async function updateArchive(archiveId: number, formData: FormData) {
  if (!(await isCurrentUserAdmin())) return { error: "관리자 권한이 필요합니다." };

  const title = formData.get("title") as string;
  const categoryId = Number(formData.get("categoryId"));
  const content = (formData.get("content") as string) || null;
  const visibleRolesRaw = (formData.get("visibleRoles") as string | null) ?? "";
  const visibleRoles = encodeRoles(
    visibleRolesRaw.split(",").map((s) => s.trim()).filter(Boolean),
  );

  if (!title || !categoryId) return { error: "필수 항목을 입력해주세요." };

  await prisma.archive.update({
    where: { id: archiveId },
    data: { title, content, categoryId, visibleRoles },
  });

  revalidatePath("/archive");
  return { success: true };
}

/** admin 전용 — 자료 삭제 */
export async function deleteArchive(archiveId: number) {
  if (!(await isCurrentUserAdmin())) throw new Error("관리자 권한이 필요합니다.");
  await prisma.archive.delete({ where: { id: archiveId } });
  revalidatePath("/archive");
}
