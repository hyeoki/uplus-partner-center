"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

const VALID_CATEGORIES = new Set([
  "기술 문의",
  "사용 가이드 문의",
  "서비스 교육 요청",
  "미팅 요청",
  "기타",
]);

export async function createInquiry(_prev: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "로그인이 필요합니다." };

  const category = String(formData.get("category") ?? "기타").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";

  if (!VALID_CATEGORIES.has(category)) return { error: "카테고리를 선택해주세요." };
  if (title.length === 0) return { error: "제목을 입력해주세요." };
  if (content.length === 0) return { error: "내용을 입력해주세요." };
  if (title.length > 200) return { error: "제목은 200자 이내로 입력해주세요." };

  await prisma.inquiry.create({
    data: { userId: session.user.id, category, title, content, isPrivate },
  });

  revalidatePath("/inquiry");
  return { success: true };
}

/** admin 또는 작성자만 수정 가능 */
export async function updateInquiry(inquiryId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "인증이 필요합니다." };
  const existing = await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { userId: true } });
  if (!existing) return { error: "존재하지 않는 문의입니다." };
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin && existing.userId !== session.user.id) {
    return { error: "본인이 작성한 문의만 수정할 수 있습니다." };
  }

  const category = String(formData.get("category") ?? "기타").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const isPrivate = formData.get("isPrivate") === "on";

  if (!VALID_CATEGORIES.has(category)) return { error: "카테고리를 선택해주세요." };
  if (title.length === 0) return { error: "제목을 입력해주세요." };
  if (content.length === 0) return { error: "내용을 입력해주세요." };
  if (title.length > 200) return { error: "제목은 200자 이내로 입력해주세요." };

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { category, title, content, isPrivate },
  });
  revalidatePath("/inquiry");
  return { success: true };
}

/** admin 또는 작성자만 삭제 가능 */
export async function deleteInquiry(inquiryId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("인증이 필요합니다.");
  const existing = await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { userId: true } });
  if (!existing) throw new Error("존재하지 않는 문의입니다.");
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin && existing.userId !== session.user.id) {
    throw new Error("본인이 작성한 문의만 삭제할 수 있습니다.");
  }
  await prisma.inquiry.delete({ where: { id: inquiryId } });
  revalidatePath("/inquiry");
}

/** admin 전용 — 문의에 답변 등록/수정. 답변이 등록되면 status=answered. */
export async function replyInquiry(_prev: unknown, formData: FormData) {
  if (!(await isCurrentUserAdmin())) return { error: "관리자 권한이 필요합니다." };

  const inquiryId = String(formData.get("inquiryId") ?? "").trim();
  const reply = String(formData.get("reply") ?? "").trim();

  if (!inquiryId) return { error: "잘못된 요청입니다." };
  if (reply.length === 0) return { error: "답변을 입력해주세요." };

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { reply, replyAt: new Date(), status: "answered" },
  });

  revalidatePath("/inquiry");
  return { success: true };
}
