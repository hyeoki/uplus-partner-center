import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseRoleNamesField } from "@/lib/role-access";
import { getChatbotSettings } from "@/lib/chatbot-settings";
import { NextResponse } from "next/server";

type InputMessage = {
  role: "user" | "assistant";
  content: string;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** UI agent value → 실제 API 모델명 매핑 */
const MODEL_NAME_MAP: Record<string, string> = {
  // OpenAI
  "gpt-5.2": "gpt-5.2",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.4": "gpt-5.4",
  // Anthropic — 최신 alias 사용 (자동으로 최신 4.x 가리킴)
  "claude-opus-4.7": "claude-opus-4-5",
  "claude-sonnet-4.7": "claude-sonnet-4-5",
  "claude-haiku-4.7": "claude-haiku-4-5",
  // Gemini
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
};

function getProviderFromAgent(agent: string): "openai" | "anthropic" | "google" {
  if (agent.startsWith("claude")) return "anthropic";
  if (agent.startsWith("gemini")) return "google";
  return "openai";
}
const DEVELOPER_PROMPT = `
당신은 U+초정밀측위 서비스 파트너센터의 안내 챗봇입니다.

역할:
- 사용자가 파트너센터에서 무엇을 할 수 있는지 쉽게 설명합니다.
- 로그인, 공지사항 확인, 자료 다운로드, 고객사 사이트 같은 기능을 친절하게 안내합니다.
- 화면 위치나 메뉴 이동 경로를 묻는 질문에는 한국어로 짧고 명확하게 답합니다.

답변 원칙:
- 항상 한국어로 답합니다.
- 모르면 아는 척하지 말고, 확인이 필요하다고 분명하게 말합니다.
- 답변은 실무적으로 바로 도움이 되게 작성합니다.
- 아래에 제공된 공지사항/자료실 검색 결과가 있으면 그 내용을 우선 근거로 답합니다.
- 근거가 있는 경우 제목이나 자료명을 자연스럽게 언급합니다.
- 제공된 검색 결과에 없는 사실은 단정하지 않습니다.
- 파트너센터의 핵심 맥락은 다음과 같습니다:
  1. U+초정밀측위 계정으로 로그인할 수 있습니다.
  2. 로그인 후 공지사항을 확인할 수 있습니다.
  3. 로그인 후 자료를 다운로드할 수 있습니다.
  4. 고객사 사이트 메뉴에서 고객사 사이트와 라이선스 현황을 확인할 수 있습니다.
`;

function extractOutputText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s/.,!?()[\]:"'`\-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreText(text: string, queryTokens: string[]): number {
  const haystack = text.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (!haystack.includes(token)) return score;
    const occurrences = haystack.split(token).length - 1;
    return score + Math.min(occurrences, 3);
  }, 0);
}

function shorten(text: string | null | undefined, max = 180): string {
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}...`;
}

/** 사용자별 일일 챗봇 사용 한도 (admin은 무제한) */
const DAILY_CHAT_LIMIT = 3;

/** 다음 자정(KST 기준) Date 반환 */
function nextMidnight(): Date {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}

/** 한도 초과 시 보여줄 재치있는 안내 문구 풀 — 매번 랜덤으로 선택 */
const RATE_LIMIT_MESSAGES = [
  // 친근한 톤
  "오늘 질문은 여기까지예요 🙊 내일 다시 만나요!",
  "오늘 정말 많이 도와드렸네요. 챗봇도 잠깐 쉬어야 해요 ☕️",
  "헉, 오늘은 더 이상 답변할 수 없어요. 내일 충전 완료! 🔋",
  // 위트있게
  "이만큼 궁금한 거 진짜 멋져요 👏 오늘은 여기까지, 내일 또 도와드릴게요!",
  "질문 통이 가득 찼어요 🍱 내일 점심에 다시 와주세요",
  "오늘 일은 여기까지! 챗봇도 퇴근시켜주세요 🌙",
  // 살짝 능청
  "혹시 저를 너무 좋아하시나요? 😅 내일 또 만나요!",
  "잠깐, 잠깐! 머리가 슬슬 어지러워요... 🥴 내일 다시 도전해주세요",
  "오늘 한도 다 쓰셨어요. 못 들은 척하기엔 양심이 찔려서요 😬",
  // FAQ 유도
  "오늘은 더 못 도와드려요 ㅠㅠ 자료실에 답이 있을지도 몰라요!",
  "한도가 바닥났어요. 공지사항이나 자료실도 한 번 둘러봐주세요 📚",
];

function pickRateLimitMessage(): string {
  return RATE_LIMIT_MESSAGES[Math.floor(Math.random() * RATE_LIMIT_MESSAGES.length)];
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  // ── 일일 사용량 체크 (admin은 제한 없음) ──
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, roleNames: true, chatCountToday: true, chatResetAt: true },
  });
  const isAdmin = me?.role === "admin";
  if (!isAdmin && me) {
    const now = new Date();
    const needsReset = !me.chatResetAt || me.chatResetAt <= now;
    const currentCount = needsReset ? 0 : me.chatCountToday;
    if (currentCount >= DAILY_CHAT_LIMIT) {
      return NextResponse.json(
        {
          error: pickRateLimitMessage(),
          rateLimited: true,
          used: currentCount,
          limit: DAILY_CHAT_LIMIT,
          resetAt: me.chatResetAt?.toISOString() ?? null,
        },
        { status: 429 },
      );
    }
    // 카운트 +1, 리셋 필요 시 새 자정으로
    await prisma.user.update({
      where: { id: session.user.id },
      data: needsReset
        ? { chatCountToday: 1, chatResetAt: nextMidnight() }
        : { chatCountToday: { increment: 1 } },
    });
  }

  const chatbotSettings = await getChatbotSettings();
  const apiKey = chatbotSettings.apiKey ?? process.env.OPENAI_API_KEY ?? null;
  const modelName = chatbotSettings.agent ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-5.2";

  if (!apiKey) {
    return NextResponse.json(
      { error: "시스템 관리에서 챗봇 API Key를 설정해주세요." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { messages?: InputMessage[] } | null;
  const messages = Array.isArray(body?.messages)
    ? body!.messages
        .filter(
          (message): message is InputMessage =>
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.trim().length > 0,
        )
        .slice(-12)
    : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "질문 내용을 입력해주세요." }, { status: 400 });
  }

  const myRoles = parseRoleNamesField(me?.roleNames);
  const roleFilter =
    myRoles.length > 0
      ? {
          OR: [
            { visibleRoles: null },
            { visibleRoles: "" },
            ...myRoles.map((role) => ({
              visibleRoles: { contains: `,${role},` },
            })),
          ],
        }
      : { OR: [{ visibleRoles: null }, { visibleRoles: "" }] };

  const latestUserQuestion = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
  const queryTokens = tokenize(latestUserQuestion);

  const [notices, archives] = await Promise.all([
    prisma.notice.findMany({
      where: roleFilter,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        content: true,
        tag: true,
        pinned: true,
        createdAt: true,
      },
    }),
    prisma.archive.findMany({
      where: roleFilter,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        ext: true,
        fileName: true,
        createdAt: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const topNotices = notices
    .map((notice) => ({
      ...notice,
      score: scoreText(`${notice.title} ${notice.content} ${notice.tag}`, queryTokens),
    }))
    .filter((notice) => notice.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.pinned) - Number(a.pinned))
    .slice(0, 4);

  const topArchives = archives
    .map((archive) => ({
      ...archive,
      score: scoreText(
        `${archive.title} ${archive.content ?? ""} ${archive.category.name} ${archive.fileName ?? ""} ${archive.ext ?? ""}`,
        queryTokens,
      ),
    }))
    .filter((archive) => archive.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const contextParts: string[] = [];

  if (topNotices.length > 0) {
    contextParts.push(
      [
        "[공지사항 검색 결과]",
        ...topNotices.map(
          (notice, index) =>
            `${index + 1}. 제목: ${notice.title} | 태그: ${notice.tag} | 작성일: ${notice.createdAt.toLocaleDateString("ko-KR")} | 내용: ${shorten(notice.content)}`,
        ),
      ].join("\n"),
    );
  }

  if (topArchives.length > 0) {
    contextParts.push(
      [
        "[자료실 검색 결과]",
        ...topArchives.map(
          (archive, index) =>
            `${index + 1}. 제목: ${archive.title} | 카테고리: ${archive.category.name} | 형식: ${archive.type}${archive.ext ? ` (${archive.ext})` : ""} | 등록일: ${archive.createdAt.toLocaleDateString("ko-KR")} | 설명: ${shorten(archive.content)}`,
        ),
      ].join("\n"),
    );
  }

  if (contextParts.length === 0) {
    contextParts.push(
      "[검색 결과 없음]\n현재 질문과 직접적으로 일치하는 공지사항이나 자료실 항목을 찾지 못했습니다. 이 경우에는 서비스 이용 안내 중심으로 답변하고, 필요하면 사용자가 어느 메뉴를 확인하면 되는지 안내하세요.",
    );
  }

  const provider = getProviderFromAgent(modelName);
  const apiModelName = MODEL_NAME_MAP[modelName] ?? modelName;
  const systemPrompt = `${DEVELOPER_PROMPT.trim()}\n\n${contextParts.join("\n\n")}`;

  try {
    let reply: string | null = null;
    let errorBody: unknown = null;
    let status = 0;

    if (provider === "anthropic") {
      // Anthropic Messages API
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: apiModelName,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      status = response.status;
      const data = (await response.json().catch(() => null)) as {
        content?: Array<{ type?: string; text?: string }>;
      } | null;
      errorBody = data;
      const block = data?.content?.find((c) => c.type === "text");
      reply = typeof block?.text === "string" && block.text.trim() ? block.text.trim() : null;

      if (!response.ok || !reply) {
        console.error("[chat] Anthropic failed:", { status, model: apiModelName, body: data });
      }
    } else if (provider === "google") {
      // Gemini generateContent API
      const url = `${GEMINI_API_URL}/${apiModelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      });
      status = response.status;
      const data = (await response.json().catch(() => null)) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      } | null;
      errorBody = data;
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      reply = text && text.length > 0 ? text : null;

      if (!response.ok || !reply) {
        console.error("[chat] Gemini failed:", { status, model: apiModelName, body: data });
      }
    } else {
      // OpenAI Responses API
      const input = [
        {
          role: "developer",
          content: [{ type: "input_text", text: DEVELOPER_PROMPT.trim() }],
        },
        {
          role: "developer",
          content: [{ type: "input_text", text: contextParts.join("\n\n") }],
        },
        ...messages.map((message) => ({
          role: message.role,
          content: [
            message.role === "assistant"
              ? { type: "output_text", text: message.content }
              : { type: "input_text", text: message.content },
          ],
        })),
      ];

      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: apiModelName,
          input,
          store: false,
          text: { format: { type: "text" } },
        }),
      });
      status = response.status;
      const data = await response.json().catch(() => null);
      errorBody = data;
      reply = extractOutputText(data);

      if (!response.ok || !reply) {
        console.error("[chat] OpenAI failed:", { status, model: apiModelName, body: data });
      }
    }

    if (!reply) {
      void errorBody;
      return NextResponse.json(
        { error: "챗봇 답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] fetch error:", err);
    return NextResponse.json(
      { error: "챗봇 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}
