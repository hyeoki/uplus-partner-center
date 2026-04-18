"use client";

import { useState, useRef, useTransition } from "react";
import { createNotice, deleteNotice, updateNotice } from "@/app/(dashboard)/notice/actions";
import RoleAccessSelector from "@/components/role-access-selector";

interface Notice {
  id: number;
  title: string;
  content: string;
  tag: string;
  pinned: boolean;
  visibleRoles?: string | null;
  authorId?: string;
  createdAt: Date;
  author: { name: string };
}

interface Props {
  notices: Notice[];
  isAdmin?: boolean;
  currentUserId?: string | null;
}

const TAG_COLOR: Record<string, { bg: string; color: string }> = {
  중요: { bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
  시스템: { bg: "rgba(26,28,30,0.06)", color: "#1A1C1E" },
  정책: { bg: "rgba(79,79,79,0.08)", color: "#4F4F4F" },
  일반: { bg: "#e8e9ea", color: "#4F4F4F" },
};

const TAGS = ["일반", "중요", "시스템", "정책"];

type DrawerMode = "closed" | "register" | "edit" | "detail";

export default function NoticeShell({ notices, isAdmin = false, currentUserId = null }: Props) {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [selected, setSelected] = useState<Notice | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

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
    formRef.current?.reset();
    setDrawerMode("register");
  }

  function openEdit() {
    if (!selected || !canEdit(selected)) return;
    setFormError("");
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
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}>공지사항</h1>
            <p className="text-sm mt-0.5" style={{ color: "#9ca3af" }}>총 {notices.length}건</p>
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
              {notices.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center text-sm" style={{ color: "#9ca3af" }}>
                    등록된 공지사항이 없습니다.
                  </td>
                </tr>
              ) : (
                notices.map((notice, i) => {
                  const tag = TAG_COLOR[notice.tag] ?? TAG_COLOR["일반"];
                  const isSelected = selected?.id === notice.id && drawerMode === "detail";
                  return (
                    <tr
                      key={notice.id}
                      onClick={() => openDetail(notice)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: i === notices.length - 1 ? "none" : "1px solid #f3f4f5",
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
                  const tag = TAG_COLOR[selected.tag] ?? TAG_COLOR["일반"];
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
                <NoticeAvatar name={selected.author.name} />
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
              <p
                className="text-[15px] whitespace-pre-wrap"
                style={{ color: "#1A1C1E", lineHeight: 1.7 }}
              >
                {selected.content}
              </p>
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
                  {TAGS.map((t) => {
                    const tc = TAG_COLOR[t];
                    const checked = drawerMode === "edit" ? selected?.tag === t : t === "일반";
                    return (
                      <label key={t} className="cursor-pointer">
                        <input type="radio" name="tag" value={t} defaultChecked={checked} className="peer sr-only" />
                        <span
                          className="inline-block px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all peer-checked:border-transparent"
                          style={{
                            background: tc.bg,
                            color: tc.color,
                            borderColor: "#e8e9ea",
                          }}
                        >
                          {t}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </FormField>

              {/* 고정 여부 */}
              <label className="flex items-center gap-2.5 cursor-pointer w-fit">
                <div className="relative w-9 h-5">
                  <input type="checkbox" name="pinned" defaultChecked={drawerMode === "edit" && selected?.pinned} className="peer sr-only" />
                  <div className="absolute inset-0 rounded-full transition-colors bg-[#e8e9ea] peer-checked:bg-[#E6007E]" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-xs font-medium" style={{ color: "#4F4F4F" }}>상단 고정</span>
              </label>

              {/* 내용 */}
              <FormField label="내용" required>
                <textarea
                  name="content" required rows={7} placeholder="공지 내용을 입력하세요"
                  defaultValue={drawerMode === "edit" ? selected?.content : ""}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all resize-none"
                  style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent", lineHeight: "1.7" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
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

function NoticeAvatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
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
