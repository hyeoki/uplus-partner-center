"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getChatbotSettings, saveChatbotSettings } from "@/lib/chatbot-settings";
import {
  CHATBOT_AGENT_OPTIONS,
  type ChatbotAgent,
} from "@/lib/chatbot-settings-shared";

const VALID_AGENTS = new Set<ChatbotAgent>(CHATBOT_AGENT_OPTIONS.map((option) => option.value));

export async function updateChatbotSettings(_prev: unknown, formData: FormData) {
  if (!(await isCurrentUserAdmin())) {
    return { error: "관리자 권한이 필요합니다." };
  }

  const agent = String(formData.get("agent") ?? "").trim();
  const apiKeyInput = String(formData.get("apiKey") ?? "").trim();

  if (!VALID_AGENTS.has(agent as ChatbotAgent)) {
    return { error: "AI Agent를 선택해주세요." };
  }

  const current = await getChatbotSettings();
  const nextApiKey = apiKeyInput.length > 0 ? apiKeyInput : current.apiKey;

  await saveChatbotSettings({
    agent: agent as ChatbotAgent,
    apiKey: nextApiKey,
  });

  revalidatePath("/system");
  return { success: true };
}

// ───────── 자료실 카테고리 CRUD (admin 전용) ─────────

async function ensureAdmin() {
  if (!(await isCurrentUserAdmin())) throw new Error("관리자 권한이 필요합니다.");
}

export async function createCategory(_prev: unknown, formData: FormData) {
  try {
    await ensureAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = String(formData.get("name") ?? "").trim();
  const colorId = String(formData.get("colorId") ?? "blue").trim();
  if (name.length === 0) return { error: "카테고리명을 입력해주세요." };
  if (name.length > 30) return { error: "카테고리명은 30자 이내로 입력해주세요." };
  // sortOrder: 마지막 + 1
  const last = await prisma.category.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.category.create({
    data: { name, colorId, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath("/system");
  revalidatePath("/archive");
  return { success: true };
}

export async function renameCategory(id: number, name: string) {
  await ensureAdmin();
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("카테고리명을 입력해주세요.");
  if (trimmed.length > 30) throw new Error("카테고리명은 30자 이내로 입력해주세요.");
  await prisma.category.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/system");
  revalidatePath("/archive");
}

export async function updateCategoryColor(id: number, colorId: string) {
  await ensureAdmin();
  await prisma.category.update({ where: { id }, data: { colorId } });
  revalidatePath("/system");
  revalidatePath("/archive");
}

export async function toggleCategoryActive(id: number) {
  await ensureAdmin();
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new Error("카테고리를 찾을 수 없습니다.");
  await prisma.category.update({ where: { id }, data: { active: !cat.active } });
  revalidatePath("/system");
  revalidatePath("/archive");
}

export async function deleteCategory(id: number) {
  await ensureAdmin();
  const count = await prisma.archive.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(`이 카테고리에 ${count}건의 자료가 있어 삭제할 수 없습니다.`);
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/system");
  revalidatePath("/archive");
}
