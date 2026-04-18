// 클라이언트/서버 양쪽에서 안전하게 import 가능한 챗봇 설정 타입/상수.
// fs/path를 쓰는 서버 전용 함수는 chatbot-settings.ts 에 분리.

export const CHATBOT_AGENT_OPTIONS = [
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "claude-opus-4.7", label: "Claude Opus 4.7" },
  { value: "claude-sonnet-4.7", label: "Claude Sonnet 4.7" },
  { value: "claude-haiku-4.7", label: "Claude Haiku 4.7" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
] as const;

export type ChatbotAgent = (typeof CHATBOT_AGENT_OPTIONS)[number]["value"];

export type ChatbotSettings = {
  agent: ChatbotAgent;
  apiKey: string | null;
};

export function isChatbotAgent(value: string): value is ChatbotAgent {
  return CHATBOT_AGENT_OPTIONS.some((option) => option.value === value);
}
