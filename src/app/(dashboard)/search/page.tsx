import Link from "next/link";
import { auth } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

type Props = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

const TAB_TYPES = ["all", "site", "archive", "notice", "inquiry"] as const;
type TabType = (typeof TAB_TYPES)[number];

const TAB_LABEL: Record<TabType, string> = {
  all: "전체",
  site: "사이트",
  archive: "자료실",
  notice: "공지사항",
  inquiry: "문의게시판",
};

const SERVER_COLOR: Record<string, { bg: string; color: string }> = {
  AWS: { bg: "rgba(255,153,0,0.12)", color: "#FF9900" },
  NCP: { bg: "rgba(3,199,90,0.12)", color: "#03C75A" },
};

const TAG_COLOR: Record<string, { bg: string; color: string }> = {
  중요: { bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
  시스템: { bg: "rgba(26,28,30,0.06)", color: "#1A1C1E" },
  정책: { bg: "rgba(79,79,79,0.08)", color: "#4F4F4F" },
  일반: { bg: "#e8e9ea", color: "#4F4F4F" },
};

const INQ_CATEGORY: Record<string, { bg: string; color: string }> = {
  "기술 문의": { bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
  "사용 가이드 문의": { bg: "rgba(87,38,226,0.08)", color: "#5726E2" },
  "서비스 교육 요청": { bg: "rgba(22,163,74,0.10)", color: "#16a34a" },
  "미팅 요청": { bg: "rgba(255,153,0,0.12)", color: "#FF9900" },
  기타: { bg: "#e8e9ea", color: "#4F4F4F" },
};

const INQ_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: "대기", bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
  answered: { label: "답변완료", bg: "rgba(22,163,74,0.10)", color: "#16a34a" },
  closed: { label: "종료", bg: "#e8e9ea", color: "#6b7280" },
};

/** 본문에서 검색어 주변 텍스트 추출 (스니펫) */
function snippet(text: string | null | undefined, q: string, len = 100): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text.length > len ? `${text.slice(0, len)}...` : text;
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + qLower.length + 70);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ")}${suffix}`;
}

/** 검색어 하이라이트 (대소문자 무시) */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  let i = 0;
  let from = 0;
  while ((i = lower.indexOf(qLower, from)) !== -1) {
    if (i > from) parts.push(text.slice(from, i));
    parts.push(
      <mark
        key={i}
        style={{ background: "rgba(230,0,126,0.15)", color: "#E6007E", fontWeight: 600, padding: "0 1px", borderRadius: "2px" }}
      >
        {text.slice(i, i + q.length)}
      </mark>,
    );
    from = i + q.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tab: TabType = (TAB_TYPES.find((t) => t === params.type) as TabType) ?? "all";

  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = await isCurrentUserAdmin();

  const empty = { sites: [] as Awaited<ReturnType<typeof fetchSites>>, notices: [] as Awaited<ReturnType<typeof fetchNotices>>, archives: [] as Awaited<ReturnType<typeof fetchArchives>>, inquiries: [] as Awaited<ReturnType<typeof fetchInquiries>> };
  let sites = empty.sites,
    notices = empty.notices,
    archives = empty.archives,
    inquiries = empty.inquiries;

  if (q.length > 0 && userId) {
    [sites, notices, archives, inquiries] = await Promise.all([
      fetchSites(userId, q),
      fetchNotices(q),
      fetchArchives(q),
      fetchInquiries(userId, isAdmin, q),
    ]);
  }

  const counts = {
    site: sites.length,
    notice: notices.length,
    archive: archives.length,
    inquiry: inquiries.length,
    all: sites.length + notices.length + archives.length + inquiries.length,
  };

  const showSite = tab === "all" || tab === "site";
  const showNotice = tab === "all" || tab === "notice";
  const showArchive = tab === "all" || tab === "archive";
  const showInquiry = tab === "all" || tab === "inquiry";

  return (
    <div className="space-y-6 w-full">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}>
          검색 결과
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
          {q ? (
            <>
              <span className="font-semibold" style={{ color: "#1A1C1E" }}>&ldquo;{q}&rdquo;</span> 에 대한 결과 {counts.all}건
            </>
          ) : (
            "상단 검색창에 검색어를 입력해주세요."
          )}
        </p>
      </div>

      {q.length > 0 && (
        <>
          {/* 탭 */}
          <div className="flex items-center gap-2 flex-wrap">
            {TAB_TYPES.map((t) => {
              const active = tab === t;
              const count = counts[t];
              return (
                <Link
                  key={t}
                  href={`/search?q=${encodeURIComponent(q)}${t !== "all" ? `&type=${t}` : ""}`}
                  scroll={false}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: active ? "#1A1C1E" : "#ffffff",
                    color: active ? "#ffffff" : "#4F4F4F",
                    border: active ? "1px solid #1A1C1E" : "1px solid #e8e9ea",
                  }}
                >
                  {TAB_LABEL[t]}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: active ? "rgba(255,255,255,0.18)" : "#f3f4f5",
                      color: active ? "#ffffff" : "#9ca3af",
                    }}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {counts.all === 0 ? (
            <div
              className="rounded-2xl p-16 text-center"
              style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
            >
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-sm" style={{ color: "#9ca3af" }}>
                검색 결과가 없습니다. 다른 검색어로 시도해보세요.
              </p>
            </div>
          ) : tab !== "all" && counts[tab] === 0 ? (
            <div
              className="rounded-2xl p-16 text-center"
              style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
            >
              <div className="text-3xl mb-3">🔍</div>
              <p className="text-sm mb-3" style={{ color: "#9ca3af" }}>
                <span className="font-semibold" style={{ color: "#1A1C1E" }}>{TAB_LABEL[tab]}</span>에서 &ldquo;{q}&rdquo;에 대한 검색 결과가 없습니다.
              </p>
              <Link
                href={`/search?q=${encodeURIComponent(q)}`}
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "#E6007E" }}
              >
                전체 결과 {counts.all}건 보기 →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 사이트 */}
              {showSite && sites.length > 0 && (
                <Section title="사이트" count={sites.length}>
                  {sites.map((s) => {
                    const sc = SERVER_COLOR[s.server];
                    return (
                      <Link
                        key={s.id}
                        href="/customers"
                        className="block px-5 py-4 rounded-xl transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold" style={{ color: "#1A1C1E" }}>
                            <Highlight text={s.alias || s.name} q={q} />
                          </span>
                          {sc && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: sc.bg, color: sc.color }}>
                              {s.server === "NCP" ? "네이버공공클라우드" : s.server}
                            </span>
                          )}
                        </div>
                        {s.productHost && (
                          <p className="text-xs" style={{ color: "#9ca3af" }}>
                            https://{s.name}.{s.productHost}/{s.productContextPath || ""}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </Section>
              )}

              {/* 자료실 */}
              {showArchive && archives.length > 0 && (
                <Section title="자료실" count={archives.length}>
                  {archives.map((a) => (
                    <Link
                      key={a.id}
                      href="/archive"
                      className="block px-5 py-4 rounded-xl transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: "#1A1C1E" }}>
                          <Highlight text={a.title} q={q} />
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#e8e9ea", color: "#4F4F4F" }}>
                          {a.category.name}
                        </span>
                        {a.ext && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: "#f3f4f5", color: "#6b7280" }}>
                            {a.ext}
                          </span>
                        )}
                      </div>
                      {a.content && (
                        <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
                          <Highlight text={snippet(a.content, q, 140)} q={q} />
                        </p>
                      )}
                    </Link>
                  ))}
                </Section>
              )}

              {/* 공지사항 */}
              {showNotice && notices.length > 0 && (
                <Section title="공지사항" count={notices.length}>
                  {notices.map((n) => {
                    const tag = TAG_COLOR[n.tag] ?? TAG_COLOR["일반"];
                    return (
                      <Link
                        key={n.id}
                        href="/notice"
                        className="block px-5 py-4 rounded-xl transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: tag.bg, color: tag.color }}>
                            {n.tag}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: "#1A1C1E" }}>
                            <Highlight text={n.title} q={q} />
                          </span>
                          <span className="text-xs ml-auto" style={{ color: "#9ca3af" }}>
                            {formatDate(new Date(n.createdAt))}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
                          <Highlight text={snippet(n.content, q, 140)} q={q} />
                        </p>
                      </Link>
                    );
                  })}
                </Section>
              )}

              {/* 문의게시판 */}
              {showInquiry && inquiries.length > 0 && (
                <Section title="문의게시판" count={inquiries.length}>
                  {inquiries.map((i) => {
                    const cat = INQ_CATEGORY[i.category] ?? INQ_CATEGORY["기타"];
                    const st = INQ_STATUS[i.status] ?? INQ_STATUS.open;
                    const masked = i.isPrivate && !isAdmin && i.userId !== userId;
                    return (
                      <Link
                        key={i.id}
                        href="/inquiry"
                        className="block px-5 py-4 rounded-xl transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: cat.bg, color: cat.color }}>
                            {i.category}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                          {i.isPrivate && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                          )}
                          <span className="text-sm font-semibold" style={{ color: masked ? "#9ca3af" : "#1A1C1E" }}>
                            {masked ? "🔒 비밀글입니다." : <Highlight text={i.title} q={q} />}
                          </span>
                        </div>
                        {!masked && (
                          <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
                            <Highlight text={snippet(i.content, q, 140)} q={q} />
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl"
      style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
    >
      <div className="px-5 py-3" style={{ borderBottom: "1px solid #f1f3f5" }}>
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#9ca3af" }}>
          {title} <span style={{ color: "#1A1C1E" }}>{count}</span>
        </span>
      </div>
      <div className="py-2">{children}</div>
    </div>
  );
}

// ─── 데이터 fetch ───
async function fetchSites(userId: string, q: string) {
  return prisma.site.findMany({
    where: {
      userId,
      OR: [{ name: { contains: q } }, { alias: { contains: q } }],
    },
    orderBy: [{ bookmark: "desc" }, { hiRtkRegDate: "desc" }],
    select: { id: true, name: true, alias: true, server: true, productHost: true, productContextPath: true },
    take: 30,
  });
}
async function fetchNotices(q: string) {
  return prisma.notice.findMany({
    where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, content: true, tag: true, createdAt: true },
    take: 30,
  });
}
async function fetchArchives(q: string) {
  return prisma.archive.findMany({
    where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true, title: true, content: true, ext: true,
      category: { select: { name: true } },
    },
    take: 30,
  });
}
async function fetchInquiries(userId: string, isAdmin: boolean, q: string) {
  return prisma.inquiry.findMany({
    where: {
      AND: [
        { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
        isAdmin ? {} : { OR: [{ userId }, { isPrivate: false }] },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true, title: true, content: true, category: true,
      status: true, isPrivate: true, userId: true,
    },
    take: 30,
  });
}
