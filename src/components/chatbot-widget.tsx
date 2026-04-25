"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요. U+초정밀측위 파트너센터 챗봇입니다. 서비스 이용 방법이나 화면 안내가 필요하면 편하게 물어보세요.",
};

const SUGGESTED_QUESTIONS = [
  "최근 공지사항 핵심만 알려줘",
  "자료실에서 소개서나 브로슈어를 어떻게 찾을 수 있어?",
  "고객사 사이트 메뉴에서 무엇을 확인할 수 있어?",
];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdRef = useRef(1);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isPending, open]);

  // ESC 키로 챗봇 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // 모바일에선 자동 포커스 X — 열자마자 키보드 올라와서 화면 가림
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) inputRef.current?.focus();
  }, [open]);

  function nextMessageId(prefix: string) {
    const id = messageIdRef.current;
    messageIdRef.current += 1;
    return `${prefix}-${id}`;
  }

  async function sendMessage(rawInput: string) {
    const trimmed = rawInput.trim();
    if (!trimmed || isPending) return;
    const nextUserMessage: ChatMessage = {
      id: nextMessageId("user"),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    if (inputRef.current) inputRef.current.style.height = "36px";

    startTransition(async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content }) => ({ role, content })),
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | { reply?: string; error?: string }
          | null;

        if (!res.ok || !data?.reply) {
          const message =
            data?.error ?? "지금은 답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.";
          setError(message);
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId("assistant-error"),
              role: "assistant",
              content: message,
            },
          ]);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId("assistant"),
            role: "assistant",
            content: data.reply ?? "",
          },
        ]);
      } catch {
        const message = "네트워크 상태를 확인한 뒤 다시 시도해주세요.";
        setError(message);
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId("assistant-network"),
            role: "assistant",
            content: message,
          },
        ]);
      }
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(input);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 md:bg-transparent animate-[chatbotBackdrop_0.18s_ease-out]"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed right-4 bottom-4 z-50 md:right-8 md:bottom-8">
        {open && (
          <div
            className="mb-3 flex w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-[28px] border"
            style={{
              background: "rgba(255,255,255,0.96)",
              borderColor: "rgba(230, 0, 126, 0.10)",
              boxShadow: "0px 24px 64px rgba(26, 28, 30, 0.18)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              maxHeight: "min(75vh, 720px)",
              animation: "chatbotPopIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
              transformOrigin: "bottom right",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex items-start justify-between gap-3 px-5 py-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(230,0,126,0.08) 0%, rgba(248,249,250,0.95) 100%)",
                borderBottom: "1px solid rgba(230, 0, 126, 0.08)",
              }}
            >
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
                >
                  파트너센터 챗봇
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "#6b7280" }}>
                  서비스 이용과 화면 안내를 도와드립니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ background: "#ffffff", color: "#6b7280" }}
                aria-label="챗봇 닫기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-6"
                      style={{
                        background: isUser ? "#E6007E" : "#f3f4f5",
                        color: isUser ? "#ffffff" : "#1A1C1E",
                        borderTopRightRadius: isUser ? 8 : 18,
                        borderTopLeftRadius: isUser ? 18 : 8,
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })}

              {messages.length === 1 && !isPending && (
                <div className="space-y-2">
                  <div className="px-1 text-[11px] font-medium" style={{ color: "#9ca3af" }}>
                    추천 질문
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void sendMessage(question)}
                        className="rounded-full border px-3 py-2 text-left text-[12px] transition-colors hover:border-[#E6007E] hover:text-[#E6007E]"
                        style={{
                          borderColor: "#e8e9ea",
                          background: "#ffffff",
                          color: "#4F4F4F",
                        }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isPending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl px-4 py-3 text-[13px]"
                    style={{ background: "#f3f4f5", color: "#6b7280" }}
                  >
                    답변을 준비하고 있습니다...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t px-4 py-4" style={{ borderColor: "#edeeef" }}>
              <div
                className="flex items-end gap-2 rounded-3xl border pl-4 pr-2 py-1.5"
                style={{ borderColor: "#e8e9ea", background: "#ffffff" }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    // 자동 높이 조절 — scrollHeight만큼 늘어나다가 max에서 스크롤
                    const el = event.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                  }}
                  rows={1}
                  placeholder="궁금한 점을 입력해보세요"
                  className="flex-1 min-w-0 resize-none bg-transparent text-sm outline-none placeholder:text-[#9ca3af] leading-5 py-2 max-h-[140px]"
                  style={{ height: "36px" }}
                  onKeyDown={(event) => {
                    // 한글 IME 조합 중(나머지 자모 입력 중)에는 Enter 무시 — 그래야 마지막 글자가 입력란에 안 남음
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isPending || !input.trim()}
                  className="shrink-0 inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: "#E6007E", color: "#ffffff" }}
                >
                  전송
                </button>
              </div>
            </form>
          </div>
        )}

        {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-15 w-15 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-[1.03] animate-[chatbotFabIn_0.2s_ease-out]"
          style={{
            width: 60,
            height: 60,
            background: "linear-gradient(135deg, #E6007E 0%, #FF5AA5 100%)",
            color: "#ffffff",
            boxShadow: "0px 16px 32px rgba(230, 0, 126, 0.28)",
          }}
          aria-label="챗봇 열기"
        >
          {/* 챗봇 — 말풍선 안에 로봇 얼굴 (로봇이랑 채팅하는 느낌) */}
          <svg width="30" height="30" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {/* 안테나 */}
            <line x1="14" y1="2" x2="14" y2="4.5" />
            <circle cx="14" cy="2" r="1" fill="currentColor" stroke="none" />
            {/* 말풍선 (로봇 머리 역할 겸함) — 우측 하단 꼬리 */}
            <path d="M5 6 h18 a2 2 0 0 1 2 2 v9 a2 2 0 0 1 -2 2 h-7 l-3.5 3 v-3 h-7.5 a2 2 0 0 1 -2 -2 v-9 a2 2 0 0 1 2 -2 z" />
            {/* 눈 (반짝이는 큰 동공) */}
            <circle cx="10.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="17.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
            {/* 사이드 이어 (안테나 라인) */}
            <line x1="2" y1="11" x2="2" y2="14" />
            <line x1="26" y1="11" x2="26" y2="14" />
          </svg>
        </button>
        )}
      </div>
    </>
  );
}
