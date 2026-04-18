import "server-only";
import { promises as fs } from "fs";
import path from "path";
import {
  type ChatbotSettings,
  isChatbotAgent,
} from "@/lib/chatbot-settings-shared";

const DEFAULT_SETTINGS: ChatbotSettings = {
  agent: "gpt-5.2",
  apiKey: null,
};

const SETTINGS_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "chatbot-settings.json");

export async function getChatbotSettings(): Promise<ChatbotSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ChatbotSettings>;
    const agent = parsed.agent && isChatbotAgent(parsed.agent) ? parsed.agent : DEFAULT_SETTINGS.agent;
    const apiKey =
      typeof parsed.apiKey === "string" && parsed.apiKey.trim().length > 0
        ? parsed.apiKey.trim()
        : null;

    return { agent, apiKey };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveChatbotSettings(settings: ChatbotSettings): Promise<void> {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export function maskApiKey(apiKey: string | null): string {
  if (!apiKey) return "미설정";
  if (apiKey.length <= 8) return "저장됨";
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}
