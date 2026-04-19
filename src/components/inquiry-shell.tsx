"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createInquiry, deleteInquiry, replyInquiry, updateInquiry } from "@/app/(dashboard)/inquiry/actions";
import ListAvatar from "@/components/list-avatar";

type InquiryRow = {
  id: string;
  category: string;
  title: string;
  content: string;
  status: string;
  isPrivate: boolean;
  isMine: boolean;
  canViewBody: boolean;
  reply: string | null;
  replyAt: string | null;
  createdAt: string;
  user: { name: string; loginId: string; photoUrl?: string | null };
};

interface Props {
  inquiries: InquiryRow[];
  isAdmin?: boolean;
  adminProfile?: { name: string; photoUrl: string | null } | null;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: "대기", bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
  answered: { label: "답변완료", bg: "rgba(22,163,74,0.10)", color: "#16a34a" },
  closed: { label: "종료", bg: "#e8e9ea", color: "#6b7280" },
};

const CATEGORY_BADGE: Record<string, { bg: string; color: string }> = {
  "기술 문의": { bg: "rgba(230,0,126,0.08)", color: "#E6007E" },
  "사용 가이드 문의": { bg: "rgba(87,38,226,0.08)", color: "#5726E2" },
  "서비스 교육 요청": { bg: "rgba(22,163,74,0.10)", color: "#16a34a" },
  "미팅 요청": { bg: "rgba(255,153,0,0.12)", color: "#FF9900" },
  기타: { bg: "#e8e9ea", color: "#4F4F4F" },
};

const CATEGORIES = [
  "기술 문의",
  "사용 가이드 문의",
  "서비스 교육 요청",
  "미팅 요청",
  "기타",
] as const;

function formatDateTime(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h24 = d.getHours();
  const ampm = h24 < 12 ? "오전" : "오후";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const hh = String(h12).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${ampm} ${hh}:${mi}`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

type DrawerMode = "closed" | "register" | "edit" | "detail";

export default function InquiryShell({ inquiries, isAdmin = false, adminProfile = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const composeQuery = searchParams.get("compose");
  const q = searchParams.get("q") ?? "";
  const catFilter = searchParams.get("cat") ?? "";
  const [, startFilterTransition] = useTransition();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startFilterTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    });
  }

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((i) => {
      const visibleTitle = i.canViewBody ? i.title : "";
      const visibleContent = i.canViewBody ? i.content : "";
      const matchQ = q ? (visibleTitle.toLowerCase().includes(q.toLowerCase()) || visibleContent.toLowerCase().includes(q.toLowerCase())) : true;
      const matchCat = catFilter ? i.category === catFilter : true;
      return matchQ && matchCat;
    });
  }, [inquiries, q, catFilter]);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [selected, setSelected] = useState<InquiryRow | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // 답변 작성 상태
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [isReplying, startReplyTransition] = useTransition();

  // 선택된 inquiry가 list에서 갱신되면 selected도 동기화
  useEffect(() => {
    if (selected) {
      const fresh = inquiries.find((q) => q.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [inquiries, selected]);

  // ?compose=1 진입 시 자동 오픈
  useEffect(() => {
    if (composeQuery === "1") {
      setSelected(null);
      setDrawerMode("register");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("compose");
      router.replace(`/inquiry${params.toString() ? `?${params.toString()}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeQuery]);

  // ?openId=xxx → 해당 문의 상세 자동 오픈 (통합 검색에서 진입)
  const openIdQuery = searchParams.get("openId");
  useEffect(() => {
    if (!openIdQuery) return;
    const target = inquiries.find((i) => i.id === openIdQuery);
    if (target && target.canViewBody) {
      setSelected(target);
      setShowReplyForm(false);
      setReplyError("");
      setDrawerMode("detail");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openId");
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdQuery]);

  function openDetail(q: InquiryRow) {
    if (!q.canViewBody) return; // 비밀글이고 권한 없으면 열지 않음
    setSelected(q);
    setShowReplyForm(false);
    setReplyError("");
    setDrawerMode("detail");
  }

  function openRegister() {
    setSelected(null);
    setFormError("");
    formRef.current?.reset();
    setDrawerMode("register");
  }

  function canEdit(q: InquiryRow | null): boolean {
    if (!q) return false;
    return isAdmin || q.isMine;
  }

  function openEdit() {
    if (!selected || !canEdit(selected)) return;
    setFormError("");
    formRef.current?.reset();
    setDrawerMode("edit");
  }

  function handleDelete() {
    if (!selected || !canEdit(selected)) return;
    if (!confirm(`"${selected.title}" 문의를 삭제할까요?`)) return;
    startTransition(async () => {
      try {
        await deleteInquiry(selected.id);
        closeDrawer();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  }

  function closeDrawer() {
    setDrawerMode("closed");
    setSelected(null);
    setShowReplyForm(false);
    setFormError("");
    setReplyError("");
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError("");
    startTransition(async () => {
      const result =
        drawerMode === "edit" && selected
          ? await updateInquiry(selected.id, formData)
          : await createInquiry(null, formData);
      if (result?.error) setFormError(result.error);
      else closeDrawer();
    });
  }

  function handleReplySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const formData = new FormData(e.currentTarget);
    formData.set("inquiryId", selected.id);
    setReplyError("");
    startReplyTransition(async () => {
      const result = await replyInquiry(null, formData);
      if (result?.error) setReplyError(result.error);
      else setShowReplyForm(false);
    });
  }

  const drawerOpen = drawerMode !== "closed";

  return (
    <div className="flex items-start gap-6 min-h-0">
      {/* 메인 — 리스트 */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h1
              className="text-xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
            >
              헬프센터
            </h1>
            <span className="text-sm" style={{ color: "#9ca3af" }}>
              총 {inquiries.length}건
            </span>
          </div>
          <button
            type="button"
            onClick={openRegister}
            className="h-9 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
          >
            문의하기
          </button>
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative shrink-0" style={{ width: "220px" }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text" placeholder="문의를 검색해주세요." defaultValue={q}
              onChange={(e) => updateParams("q", e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
              style={{ background: "#ffffff", color: "#1A1C1E", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)", border: "1.5px solid transparent" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
            />
          </div>
          <div className="w-px h-5 shrink-0" style={{ background: "#e8e9ea" }} />
          <button
            onClick={() => updateParams("cat", "")}
            className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
            style={{ background: catFilter === "" ? "#E6007E" : "#ffffff", color: catFilter === "" ? "#ffffff" : "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}
          >
            전체 ({inquiries.length})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => updateParams("cat", c)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
              style={{ background: catFilter === c ? "#E6007E" : "#ffffff", color: catFilter === c ? "#ffffff" : "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}
            >
              {c}
            </button>
          ))}
          {(q || catFilter) && (
            <button onClick={() => router.replace(pathname, { scroll: false })} className="ml-auto text-xs underline hover:opacity-70 shrink-0" style={{ color: "#E6007E" }}>
              초기화
            </button>
          )}
        </div>
        {(q || catFilter) && <p className="text-xs -mt-2" style={{ color: "#9ca3af" }}>검색 결과 {filteredInquiries.length}건</p>}

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
        >
          {filteredInquiries.length === 0 ? (
            <p className="text-sm py-16 text-center" style={{ color: "#9ca3af" }}>
              {q || catFilter ? "검색 결과가 없습니다." : "아직 등록된 문의가 없습니다."}
            </p>
          ) : (
            <table className="w-full">
              <thead style={{ background: "#fafbfc", borderBottom: "1px solid #f1f3f5" }}>
                <tr>
                  {["카테고리", "제목", "상태", "작성자", "작성일"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-4 px-6 font-medium text-[11px] uppercase tracking-wider"
                      style={{ color: "#9ca3af" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInquiries.map((q, i) => {
                  const cat = CATEGORY_BADGE[q.category] ?? CATEGORY_BADGE["기타"];
                  const st = STATUS_LABEL[q.status] ?? STATUS_LABEL.open;
                  const isSelected = selected?.id === q.id && drawerMode === "detail";
                  const date = new Date(q.createdAt);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => openDetail(q)}
                      className={q.canViewBody ? "cursor-pointer transition-colors" : "transition-colors"}
                      style={{
                        borderBottom: i === filteredInquiries.length - 1 ? "none" : "1px solid #f3f4f5",
                        background: isSelected ? "rgba(230,0,126,0.03)" : "transparent",
                      }}
                    >
                      <td className="py-4 px-6 w-24">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                          style={{ background: cat.bg, color: cat.color }}
                        >
                          {q.category}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium inline-flex items-center gap-2" style={{ color: "#1A1C1E" }}>
                          {q.canViewBody ? (
                            <>
                              {q.isPrivate && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                              )}
                              <span>{q.title}</span>
                            </>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>🔒 비밀글입니다.</span>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 w-24">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 w-32 text-xs whitespace-nowrap" style={{ color: "#4F4F4F" }}>
                        <span className="inline-flex items-center gap-2">
                          <ListAvatar name={q.user.name} photoUrl={q.user.photoUrl} />
                          <span>{q.user.name}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 w-28 text-xs whitespace-nowrap" style={{ color: "#9ca3af" }}>
                        {formatDate(date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 사이드 드로어 */}
      <div
        className="shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: drawerOpen ? "440px" : "0px" }}
      >
        <div
          className="w-[440px] rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center justify-between px-7 py-5"
            style={{ borderBottom: "1px solid #f3f4f5" }}
          >
            <h2
              className="text-base font-bold truncate pr-3"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
              title={drawerMode === "detail" && selected ? selected.title : undefined}
            >
              {drawerMode === "register"
                ? "문의하기"
                : drawerMode === "edit"
                  ? "문의 수정"
                  : selected?.title || "문의 상세"}
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
              <button
                onClick={closeDrawer}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-60"
                style={{ color: "#9ca3af" }}
                aria-label="닫기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 상세 조회 — 모던 미니멀 */}
          {drawerMode === "detail" && selected && (
            <div className="px-7 py-6 space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto">
              {/* 메타 라인: 카테고리 · 상태 · 비밀글 */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {(() => {
                  const cat = CATEGORY_BADGE[selected.category] ?? CATEGORY_BADGE["기타"];
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium"
                      style={{ background: cat.bg, color: cat.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                      {selected.category}
                    </span>
                  );
                })()}
                {(() => {
                  const st = STATUS_LABEL[selected.status] ?? STATUS_LABEL.open;
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {selected.status === "answered" ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                      )}
                      {st.label}
                    </span>
                  );
                })()}
                {selected.isPrivate && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium" style={{ background: "#f3f4f5", color: "#6b7280" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    비밀글
                    {selected.isMine && <span className="ml-1 opacity-70">· 나만 볼 수 있어요 🤫</span>}
                  </span>
                )}
              </div>

              {/* 작성자 byline */}
              <div className="flex items-center gap-3">
                <Avatar name={selected.user.name} variant="user" photoUrl={selected.user.photoUrl} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" style={{ color: "#1A1C1E" }}>
                    {selected.user.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                    {formatDateTime(new Date(selected.createdAt))}
                  </div>
                </div>
              </div>

              {/* 본문 — 박스 없이 자연스럽게 */}
              <p
                className="text-[15px] whitespace-pre-wrap"
                style={{ color: "#1A1C1E", lineHeight: 1.7 }}
              >
                {selected.content}
              </p>

              {/* 답변 섹션 */}
              <div className="space-y-4 pt-5" style={{ borderTop: "1px solid #f1f3f5" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm font-semibold" style={{ color: "#1A1C1E" }}>
                      답변 {selected.reply ? 1 : 0}
                    </span>
                  </div>
                  {isAdmin && selected.reply && !showReplyForm && (
                    <button
                      type="button"
                      onClick={() => { setShowReplyForm(true); setReplyError(""); }}
                      className="text-xs font-medium px-2.5 py-1 rounded-md hover:bg-gray-100 transition-colors"
                      style={{ color: "#6b7280" }}
                    >
                      수정
                    </button>
                  )}
                </div>

                {selected.reply && !showReplyForm && (
                  <CommentItem
                    authorName={adminProfile?.name ?? "관리자"}
                    photoUrl={adminProfile?.photoUrl ?? null}
                    createdAt={selected.replyAt ? new Date(selected.replyAt) : null}
                    content={selected.reply}
                  />
                )}

                {isAdmin && (showReplyForm || !selected.reply) && (
                  <form onSubmit={handleReplySubmit} className="space-y-2">
                    <div className="flex gap-3">
                      <Avatar name={adminProfile?.name ?? "관리자"} variant="admin" photoUrl={adminProfile?.photoUrl ?? null} />
                      <div className="flex-1 min-w-0">
                        <textarea
                          name="reply"
                          defaultValue={selected.reply ?? ""}
                          placeholder="답변을 작성해주세요"
                          required
                          rows={3}
                          autoFocus={showReplyForm}
                          className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-y transition-all focus:border-[#E6007E]"
                          style={{ background: "#fafbfc", color: "#1A1C1E", border: "1px solid #e8e9ea" }}
                        />
                        {replyError && (
                          <p className="text-xs mt-1.5" style={{ color: "#E6007E" }}>{replyError}</p>
                        )}
                        <div className="flex justify-end gap-1.5 mt-2">
                          {showReplyForm && (
                            <button
                              type="button"
                              onClick={() => { setShowReplyForm(false); setReplyError(""); }}
                              className="h-8 px-3 rounded-lg text-xs font-medium hover:bg-gray-100"
                              style={{ color: "#6b7280" }}
                            >
                              취소
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={isReplying}
                            className="h-8 px-4 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: "#1A1C1E", color: "#ffffff" }}
                          >
                            {isReplying ? "등록 중..." : selected.reply ? "수정 완료" : "답변 등록"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}

                {!selected.reply && !isAdmin && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="text-xs" style={{ color: "#9ca3af" }}>
                      답변을 기다리는 중이에요
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 등록 폼 */}
          {(drawerMode === "register" || drawerMode === "edit") && (
            <form
              ref={formRef}
              key={drawerMode === "edit" ? `edit-${selected?.id}` : "register"}
              onSubmit={handleSubmit}
              className="px-7 py-6 space-y-4"
            >
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: "#9ca3af" }}>카테고리</label>
                <select
                  name="category"
                  defaultValue={drawerMode === "edit" ? selected?.category : "기술 문의"}
                  className="w-full h-11 rounded-xl px-3 text-sm outline-none cursor-pointer"
                  style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1px solid #e8e9ea" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: "#9ca3af" }}>제목</label>
                <input
                  name="title"
                  type="text"
                  placeholder="간단한 제목을 입력해주세요"
                  defaultValue={drawerMode === "edit" ? selected?.title : ""}
                  required
                  maxLength={200}
                  className="w-full h-11 rounded-xl px-3 text-sm outline-none"
                  style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1px solid #e8e9ea" }}
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: "#9ca3af" }}>내용</label>
                <textarea
                  name="content"
                  placeholder="무엇이든 자유롭게 문의하세요"
                  defaultValue={drawerMode === "edit" ? selected?.content : ""}
                  required
                  rows={8}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-y"
                  style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1px solid #e8e9ea" }}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" name="isPrivate" defaultChecked={drawerMode === "edit" && selected?.isPrivate} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "#E6007E" }} />
                <span className="text-xs" style={{ color: "#4F4F4F" }}>비밀로 전달할게요.</span>
              </label>

              {formError && <p className="text-xs" style={{ color: "#E6007E" }}>{formError}</p>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeDrawer} className="flex-1 h-10 rounded-xl text-sm font-semibold hover:opacity-70 transition-opacity" style={{ background: "#f3f4f5", color: "#4F4F4F" }}>
                  취소
                </button>
                <button type="submit" disabled={isPending} className="flex-1 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60" style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}>
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

function Avatar({
  name,
  variant,
  photoUrl,
}: {
  name: string;
  variant: "user" | "admin";
  photoUrl?: string | null;
}) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const bg =
    variant === "admin"
      ? "linear-gradient(135deg, #E6007E 0%, #ff5fa6 100%)"
      : "linear-gradient(135deg, #5726E2 0%, #8b6cff 100%)";

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
      style={{ background: bg, fontFamily: "var(--font-display)" }}
    >
      {initial}
    </div>
  );
}

function CommentItem({
  authorName,
  photoUrl,
  createdAt,
  content,
}: {
  authorName: string;
  photoUrl?: string | null;
  createdAt: Date | null;
  content: string;
}) {
  return (
    <div className="flex gap-3">
      <Avatar name={authorName} variant="admin" photoUrl={photoUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-sm font-semibold" style={{ color: "#1A1C1E" }}>
            {authorName}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-wider"
            style={{ background: "rgba(230,0,126,0.08)", color: "#E6007E" }}
          >
            ADMIN
          </span>
          {createdAt && (
            <span className="text-xs" style={{ color: "#9ca3af" }}>
              · {formatDateTime(createdAt)}
            </span>
          )}
        </div>
        <p
          className="text-sm whitespace-pre-wrap"
          style={{ color: "#1A1C1E", lineHeight: 1.65 }}
        >
          {content}
        </p>
      </div>
    </div>
  );
}
