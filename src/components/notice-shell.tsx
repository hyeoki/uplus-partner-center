"use client";

import { useEffect, useState, useRef, useTransition, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createNotice, deleteNotice, updateNotice } from "@/app/(dashboard)/notice/actions";
import RoleAccessSelector from "@/components/role-access-selector";
import RichTextEditor from "@/components/rich-text-editor";
import RichTextView from "@/components/rich-text-view";
import { getCategoryColor } from "@/lib/category-colors";

interface Notice {
  id: number;
  title: string;
  content: string;
  tag: string;
  pinned: boolean;
  visibleRoles?: string | null;
  authorId?: string;
  createdAt: Date;
  author: { name: string; photoUrl?: string | null };
}

interface TagDef {
  name: string;
  colorId: string;
}

interface Props {
  notices: Notice[];
  isAdmin?: boolean;
  currentUserId?: string | null;
  tags: TagDef[];
}

function tagBg(colorId: string) {
  return getCategoryColor(colorId);
}

type DrawerMode = "closed" | "register" | "edit" | "detail";

export default function NoticeShell({ notices, isAdmin = false, currentUserId = null, tags }: Props) {
  // ── 검색/필터 (URL params) ──
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const tagFilter = searchParams.get("tag") ?? "";
  const [isPendingFilter, startFilterTransition] = useTransition();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startFilterTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    });
  }

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      const matchQ = q ? (n.title.toLowerCase().includes(q.toLowerCase()) || n.content.toLowerCase().includes(q.toLowerCase())) : true;
      const matchTag = tagFilter ? n.tag === tagFilter : true;
      return matchQ && matchTag;
    });
  }, [notices, q, tagFilter]);

  // ?openId=N → 해당 공지 상세 자동 오픈
  const openIdQuery = searchParams.get("openId");
  useEffect(() => {
    if (!openIdQuery) return;
    const target = notices.find((n) => String(n.id) === openIdQuery);
    if (target) {
      setSelected(target);
      setDrawerMode("detail");
    }
    // 쿼리 정리
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openId");
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdQuery]);

  // 태그명 → 색상 lookup map
  const tagColorByName = new Map<string, { bg: string; color: string }>();
  tags.forEach((t) => tagColorByName.set(t.name, tagBg(t.colorId)));
  const FALLBACK_COLOR = { bg: "#e8e9ea", color: "#4F4F4F" };
  function getTagColor(name: string) {
    return tagColorByName.get(name) ?? FALLBACK_COLOR;
  }
  const TAGS_LIST = tags.map((t) => t.name);
  const DEFAULT_TAG = TAGS_LIST.includes("일반") ? "일반" : TAGS_LIST[0] ?? "일반";
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [selected, setSelected] = useState<Notice | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  // 폼 제어: 태그 + 고정 (고정 ON 시 태그 자동 "중요")
  const [tag, setTag] = useState<string>(DEFAULT_TAG);
  const [pinned, setPinned] = useState(false);

  function canEdit(n: Notice | null): boolean {
    if (!n) return false;
    return isAdmin || (currentUserId !== null && n.authorId === currentUserId);
  }

  function openDetail(notice: Notice) {
    setSelected(notice);
    setDrawerMode("detail");
  }

  function openRegister() {
    setSelected(null);
    setFormError("");
    setTag(DEFAULT_TAG);
    setPinned(false);
    formRef.current?.reset();
    setDrawerMode("register");
  }

  function openEdit() {
    if (!selected || !canEdit(selected)) return;
    setFormError("");
    setTag(selected.tag);
    setPinned(selected.pinned);
    formRef.current?.reset();
    setDrawerMode("edit");
  }

  function handleDelete() {
    if (!selected || !canEdit(selected)) return;
    if (!confirm(`"${selected.title}" 공지를 삭제할까요?`)) return;
    startTransition(async () => {
      try {
        await deleteNotice(selected.id);
        closeDrawer();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  }

  function closeDrawer() {
    setDrawerMode("closed");
    setSelected(null);
    setFormError("");
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError("");
    startTransition(async () => {
      const result =
        drawerMode === "edit" && selected
          ? await updateNotice(selected.id, formData)
          : await createNotice(formData);
      if (result?.error) setFormError(result.error);
      else closeDrawer();
    });
  }

  const drawerOpen = drawerMode !== "closed";

  return (
    <div className="flex items-start gap-6 min-h-0">
      {/* ── 메인 콘텐츠 ── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}>공지사항</h1>
            <span className="text-sm" style={{ color: "#9ca3af" }}>총 {notices.length}건</span>
          </div>
          {isAdmin && (
            <button
              onClick={openRegister}
              className="h-9 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
            >
              공지 등록
            </button>
          )}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative shrink-0" style={{ width: "220px" }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPendingFilter ? "#E6007E" : "#9ca3af"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text" placeholder="공지를 검색해주세요." defaultValue={q}
              onChange={(e) => updateParams("q", e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
              style={{ background: "#ffffff", color: "#1A1C1E", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)", border: "1.5px solid transparent" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
            />
          </div>
          <div className="w-px h-5 shrink-0" style={{ background: "#e8e9ea" }} />
          <button
            onClick={() => updateParams("tag", "")}
            className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
            style={{ background: tagFilter === "" ? "#E6007E" : "#ffffff", color: tagFilter === "" ? "#ffffff" : "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}
          >
            전체 ({notices.length})
          </button>
          {TAGS_LIST.map((t) => (
            <button
              key={t}
              onClick={() => updateParams("tag", t)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
              style={{ background: tagFilter === t ? "#E6007E" : "#ffffff", color: tagFilter === t ? "#ffffff" : "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}
            >
              {t}
            </button>
          ))}
          {(q || tagFilter) && (
            <button onClick={() => router.replace(pathname, { scroll: false })} className="ml-auto text-xs underline hover:opacity-70 shrink-0" style={{ color: "#E6007E" }}>
              초기화
            </button>
          )}
        </div>
        {(q || tagFilter) && <p className="text-xs -mt-2" style={{ color: "#9ca3af" }}>검색 결과 {filteredNotices.length}건</p>}

        {/* 테이블 */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(230,0,126,0.08)" }}>
                {["태그", "제목", "작성일"].map((h) => (
                  <th key={h} className="text-left py-4 px-6 font-medium text-[11px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredNotices.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center text-sm" style={{ color: "#9ca3af" }}>
                    {q || tagFilter ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredNotices.map((notice, i) => {
                  const tag = getTagColor(notice.tag);
                  const isSelected = selected?.id === notice.id && drawerMode === "detail";
                  return (
                    <tr
                      key={notice.id}
                      onClick={() => openDetail(notice)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: i === filteredNotices.length - 1 ? "none" : "1px solid #f3f4f5",
                        background: isSelected ? "rgba(230,0,126,0.03)" : "transparent",
                      }}
                    >
                      <td className="py-4 px-6 w-24">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap" style={{ background: tag.bg, color: tag.color }}>
                          {notice.tag}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium" style={{ color: "#1A1C1E" }}>
                          {notice.pinned && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 mb-0.5" style={{ background: "#E6007E", verticalAlign: "middle" }} />
                          )}
                          {notice.title}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs whitespace-nowrap" style={{ color: "#9ca3af" }}>
                        {new Date(notice.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 사이드 드로어 ── */}
      <div
        className="shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: drawerOpen ? "400px" : "0px" }}
      >
        <div className="w-[400px] rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}>

          {/* 드로어 헤더 */}
          <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: "1px solid #f3f4f5" }}>
            <h2
              className="text-base font-bold truncate pr-3"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
              title={drawerMode === "detail" && selected ? selected.title : undefined}
            >
              {drawerMode === "register"
                ? "공지 등록"
                : drawerMode === "edit"
                  ? "공지 수정"
                  : (selected?.title || "공지 상세")}
            </h2>
            <div className="flex items-center gap-1">
              {drawerMode === "detail" && canEdit(selected) && (
                <>
                  <button
                    onClick={openEdit}
                    title="수정"
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    style={{ color: "#6b7280" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleDelete}
                    title="삭제"
                    disabled={isPending}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-60"
                    style={{ color: "#6b7280" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </>
              )}
              <button onClick={closeDrawer} className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-60" style={{ color: "#9ca3af" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── 상세 조회 — 모던 미니멀 ── */}
          {drawerMode === "detail" && selected && (
            <div className="px-7 py-6 space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto">
              {/* 메타 라인: 태그 + 고정 */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {(() => {
                  const tag = getTagColor(selected.tag);
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium"
                      style={{ background: tag.bg, color: tag.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color }} />
                      {selected.tag}
                    </span>
                  );
                })()}
                {selected.pinned && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(230,0,126,0.08)", color: "#E6007E" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" /></svg>
                    고정
                  </span>
                )}
              </div>

              {/* 작성자 byline */}
              <div className="flex items-center gap-3">
                <NoticeAvatar name={selected.author.name} photoUrl={selected.author.photoUrl} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" style={{ color: "#1A1C1E" }}>
                    {selected.author.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                    {new Date(selected.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
              </div>

              {/* 본문 */}
              <RichTextView html={selected.content} className="text-[15px]" />
            </div>
          )}

          {/* ── 공지 등록/수정 폼 ── */}
          {(drawerMode === "register" || drawerMode === "edit") && (
            <form
              ref={formRef}
              key={drawerMode === "edit" ? `edit-${selected?.id}` : "register"}
              onSubmit={handleSubmit}
              className="px-7 py-6 space-y-5"
            >

              {/* 제목 */}
              <FormField label="제목" required>
                <input
                  name="title" required placeholder="공지 제목을 입력하세요"
                  defaultValue={drawerMode === "edit" ? selected?.title : ""}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all"
                  style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                />
              </FormField>

              {/* 태그 */}
              <FormField label="태그">
                <div className="flex gap-2 flex-wrap">
                  {TAGS_LIST.map((t) => {
                    const tc = getTagColor(t);
                    return (
                      <label
                        key={t}
                        className="cursor-pointer"
                        style={{ ["--c" as string]: tc.color }}
                      >
                        <input
                          type="radio"
                          name="tag"
                          value={t}
                          checked={tag === t}
                          onChange={() => setTag(t)}
                          className="peer sr-only"
                        />
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all bg-[#f8f9fa] text-[#4F4F4F] border border-[#e8e9ea] peer-checked:bg-[var(--c)] peer-checked:text-white peer-checked:border-[var(--c)] peer-checked:font-semibold peer-checked:shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tc.color }} />
                          {t}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </FormField>

              {/* 고정 여부 — ON 시 태그 자동 "중요" */}
              <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                <div className="relative w-9 h-5">
                  <input
                    type="checkbox"
                    name="pinned"
                    checked={pinned}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setPinned(next);
                      if (next) setTag("중요");
                    }}
                    className="peer sr-only"
                  />
                  <div className="absolute inset-0 rounded-full transition-colors bg-[#e8e9ea] peer-checked:bg-[#E6007E]" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-xs font-medium" style={{ color: "#4F4F4F" }}>상단 고정</span>
              </label>

              {/* 내용 */}
              <FormField label="내용" required>
                <RichTextEditor
                  name="content"
                  value={drawerMode === "edit" ? selected?.content ?? "" : ""}
                  placeholder="공지 내용을 입력하세요"
                />
              </FormField>

              {/* 조회 권한 */}
              <FormField label="조회 권한">
                <RoleAccessSelector defaultValue={drawerMode === "edit" ? selected?.visibleRoles ?? null : null} />
              </FormField>

              {formError && <p className="text-xs" style={{ color: "#E6007E" }}>{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeDrawer} className="flex-1 h-10 rounded-xl text-sm font-semibold hover:opacity-70 transition-opacity" style={{ background: "#f3f4f5", color: "#4F4F4F" }}>취소</button>
                <button type="submit" disabled={isPending} className="flex-1 h-10 rounded-xl text-sm font-semibold hover:opacity-80 disabled:opacity-50 transition-opacity" style={{ background: "#E6007E", color: "#ffffff" }}>
                  {isPending ? "저장 중..." : drawerMode === "edit" ? "수정" : "등록"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "#4F4F4F" }}>
        {label}{required && <span className="ml-0.5" style={{ color: "#E6007E" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "#9ca3af" }}>{label}</p>
      {children}
    </div>
  );
}

function NoticeAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="w-9 h-9 shrink-0 rounded-full object-cover"
        style={{ background: "#f3f4f5" }}
      />
    );
  }
  return (
    <div
      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white"
      style={{
        background: "linear-gradient(135deg, #E6007E 0%, #ff5fa6 100%)",
        fontFamily: "var(--font-display)",
      }}
    >
      {initial}
    </div>
  );
}
