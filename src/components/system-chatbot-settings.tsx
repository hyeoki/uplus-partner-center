"use client";

import { useActionState } from "react";
import { updateChatbotSettings } from "@/app/(dashboard)/system/actions";
import {
  CHATBOT_AGENT_OPTIONS,
  type ChatbotAgent,
} from "@/lib/chatbot-settings-shared";

type Props = {
  defaultAgent: ChatbotAgent;
  maskedApiKey: string;
  hasApiKey: boolean;
};

type ActionState = {
  success?: boolean;
  error?: string;
} | null;

export default function SystemChatbotSettings({
  defaultAgent,
  maskedApiKey,
  hasApiKey,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateChatbotSettings,
    null,
  );

  return (
    <div
      className="rounded-2xl p-7"
      style={{
        background: "#ffffff",
        boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
          >
            챗봇 관리
          </h2>
          <p className="mt-1 text-sm" style={{ color: "#9ca3af" }}>
            챗봇에서 사용할 AI Agent와 API Key를 설정합니다.
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-2 text-xs"
          style={{ background: "#f8f9fa", color: "#6b7280" }}
        >
          API Key {hasApiKey ? maskedApiKey : "미설정"}
        </div>
      </div>

      <form action={formAction} className="mt-6 grid gap-5 md:grid-cols-[1.1fr_1.4fr_auto] md:items-end">
        <label className="block">
          <span
            className="mb-2 block text-[11px] uppercase tracking-wider"
            style={{ color: "#9ca3af" }}
          >
            AI Agent
          </span>
          <select
            name="agent"
            defaultValue={defaultAgent}
            className="h-11 w-full rounded-xl px-3 text-sm outline-none"
            style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1px solid #e8e9ea" }}
          >
            {CHATBOT_AGENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span
            className="mb-2 block text-[11px] uppercase tracking-wider"
            style={{ color: "#9ca3af" }}
          >
            API Key
          </span>
          <input
            type="password"
            name="apiKey"
            placeholder={hasApiKey ? "새 키를 입력하면 교체됩니다" : "API Key를 입력하세요"}
            className="h-11 w-full rounded-xl px-3 text-sm outline-none"
            style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1px solid #e8e9ea" }}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span style={{ color: state?.error ? "#E6007E" : state?.success ? "#16a34a" : "#9ca3af" }}>
          {state?.error ?? (state?.success ? "챗봇 설정을 저장했습니다." : "")}
        </span>
      </div>
    </div>
  );
}
