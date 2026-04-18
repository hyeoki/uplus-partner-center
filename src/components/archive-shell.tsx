"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createArchive, deleteArchive, incrementDownload, updateArchive } from "@/app/(dashboard)/archive/actions";
import RoleAccessSelector from "@/components/role-access-selector";

interface Category { id: number; name: string; colorId: string }

interface Archive {
  id: number;
  title: string;
  content: string | null;
  type: string;
  ext: string | null;
  size: string | null;
  url: string | null;
  fileName: string | null;
  downloads: number;
  visibleRoles?: string | null;
  createdAt: Date;
  category: { id: number; name: string; colorId: string };
}

interface Props {
  categories: Category[];
  allArchives: Archive[];
  filteredArchives: Archive[];
  q: string;
  category: string;
  isAdmin?: boolean;
}

import { getCategoryColor } from "@/lib/category-colors";

type DrawerMode = "closed" | "register" | "edit" | "detail";

export default function ArchiveShell({ categories, allArchives, filteredArchives, q, category, isAdmin = false }: Props) {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [selected, setSelected] = useState<Archive | null>(null);

  // register form state
  const [formError, setFormError] = useState("");
  const [isPendingForm, startFormTransition] = useTransition();
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPendingFilter, startFilterTransition] = useTransition();

  const updateParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    startFilterTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }, [router, pathname, searchParams]);

  function openDetail(archive: Archive) {
    setSelected(archive);
    setDrawerMode("detail");
  }

  // ?openId=N → 해당 자료 상세 자동 오픈 (통합 검색에서 진입)
  const openIdQuery = searchParams.get("openId");
  useEffect(() => {
    if (!openIdQuery) return;
    const target = allArchives.find((a) => String(a.id) === openIdQuery);
    if (target) {
      setSelected(target);
      setDrawerMode("detail");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openId");
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdQuery]);

  function openRegister() {
    setSelected(null);
    setDroppedFile(null);
    setFormError("");
    formRef.current?.reset();
    setDrawerMode("register");
  }

  function openEdit() {
    if (!selected || !isAdmin) return;
    setDroppedFile(null);
    setFormError("");
    formRef.current?.reset();
    setDrawerMode("edit");
  }

  function handleDelete() {
    if (!selected || !isAdmin) return;
    if (!confirm(`"${selected.title}" 자료를 삭제할까요?`)) return;
    startFormTransition(async () => {
      try {
        await deleteArchive(selected.id);
        closeDrawer();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  }

  function closeDrawer() {
    setDrawerMode("closed");
    setSelected(null);
    setDroppedFile(null);
    setFormError("");
    formRef.current?.reset();
  }

  function handleFileChange(file: File | null) {
    if (file) setDroppedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setDroppedFile(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (droppedFile) formData.set("file", droppedFile);
    setFormError("");
    startFormTransition(async () => {
      const result =
        drawerMode === "edit" && selected
          ? await updateArchive(selected.id, formData)
          : await createArchive(formData);
      if (result?.error) setFormError(result.error);
      else closeDrawer();
    });
  }

  async function handleDownload(archive: Archive, e: React.MouseEvent) {
    e.stopPropagation();
    if (!archive.url) return;
    await incrementDownload(archive.id);
    // NAS Web Station 직링크를 새 탭에서 열기 (브라우저가 파일 형식에 따라
    // 즉시 다운로드 또는 인라인 표시)
    window.open(archive.url, "_blank", "noopener,noreferrer");
  }

  const drawerOpen = drawerMode !== "closed";

  return (
    <div className="flex items-start gap-6 min-h-0">
      {/* ── 메인 콘텐츠 ── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}>자료실</h1>
              <span className="text-sm" style={{ color: "#9ca3af" }}>총 {allArchives.length}건</span>
            </div>
          </div>
          {isAdmin && (
            <button onClick={openRegister} className="h-9 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80" style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}>
              자료 등록
            </button>
          )}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative shrink-0" style={{ width: "220px" }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPendingFilter ? "#E6007E" : "#9ca3af"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input type="text" placeholder="자료를 검색해주세요." defaultValue={q} onChange={(e) => updateParams("q", e.target.value)} className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none transition-all" style={{ background: "#ffffff", color: "#1A1C1E", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)", border: "1.5px solid transparent" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")} onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")} />
          </div>
          <div className="w-px h-5 shrink-0" style={{ background: "#e8e9ea" }} />
          <button onClick={() => updateParams("category", "")} className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0" style={{ background: category === "" ? "#E6007E" : "#ffffff", color: category === "" ? "#ffffff" : "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}>
            전체 ({allArchives.length})
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => updateParams("category", String(cat.id))} className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0" style={{ background: category === String(cat.id) ? "#E6007E" : "#ffffff", color: category === String(cat.id) ? "#ffffff" : "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}>
              {cat.name}
            </button>
          ))}
          {(q || category) && (
            <button onClick={() => router.push(pathname, { scroll: false })} className="ml-auto text-xs underline hover:opacity-70 shrink-0" style={{ color: "#E6007E" }}>초기화</button>
          )}
        </div>
        {(q || category) && <p className="text-xs -mt-2" style={{ color: "#9ca3af" }}>검색 결과 {filteredArchives.length}건</p>}

        {/* 테이블 */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}>
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "140px" }} />
              <col />
              <col style={{ width: "120px" }} />
              <col style={{ width: "100px" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(230,0,126,0.08)" }}>
                {["카테고리", "자료명", "등록일"].map((h) => (
                  <th key={h} className="text-left py-4 px-6 font-medium text-[11px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>{h}</th>
                ))}
                <th className="text-right py-4 px-6 font-medium text-[11px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>다운로드</th>
              </tr>
            </thead>
            <tbody>
              {filteredArchives.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center" style={{ color: "#9ca3af" }}>
                    <div className="flex flex-col items-center gap-2">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e8e9ea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                      </svg>
                      <span className="text-sm">검색 결과가 없습니다.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredArchives.map((archive, i) => {
                  const cat = getCategoryColor(archive.category.colorId);
                  const isSelected = selected?.id === archive.id && drawerMode === "detail";
                  return (
                    <tr
                      key={archive.id}
                      onClick={() => openDetail(archive)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: i === filteredArchives.length - 1 ? "none" : "1px solid #f3f4f5",
                        background: isSelected ? "rgba(230,0,126,0.03)" : "transparent",
                      }}
                    >
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap" style={{ background: cat.bg, color: cat.color }}>{archive.category.name}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium" style={{ color: "#1A1C1E" }}>{archive.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {archive.ext && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase" style={{ background: "#e8e9ea", color: "#4F4F4F" }}>{archive.ext}</span>}
                          {archive.size && <span className="text-xs" style={{ color: "#9ca3af" }}>{archive.size}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs whitespace-nowrap" style={{ color: "#9ca3af" }}>
                        {new Date(archive.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {archive.url ? (
                          <button
                            onClick={(e) => handleDownload(archive, e)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{ background: "rgba(230,0,126,0.08)", color: "#E6007E" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            <span className="text-xs font-medium">{archive.downloads}</span>
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: "#e8e9ea" }}>—</span>
                        )}
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
        style={{ width: drawerOpen ? "380px" : "0px" }}
      >
        <div className="w-[380px] rounded-2xl overflow-hidden" style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25,28,29,0.06)" }}>

          {/* 드로어 헤더 */}
          <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: "1px solid #f3f4f5" }}>
            <h2
              className="text-base font-bold truncate pr-3"
              style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
              title={drawerMode === "detail" && selected ? selected.title : undefined}
            >
              {drawerMode === "register"
                ? "자료 등록"
                : drawerMode === "edit"
                  ? "자료 수정"
                  : (selected?.title || "자료 상세")}
            </h2>
            <div className="flex items-center gap-1">
              {drawerMode === "detail" && selected && isAdmin && (
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
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
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
              {/* 메타 라인: 카테고리 + 등록일 + 다운로드 수 */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {(() => {
                  const cat = getCategoryColor(selected.category.colorId);
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium"
                      style={{ background: cat.bg, color: cat.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                      {selected.category.name}
                    </span>
                  );
                })()}
                <span style={{ color: "#9ca3af" }}>
                  {new Date(selected.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span style={{ color: "#d1d5db" }}>·</span>
                <span className="inline-flex items-center gap-1" style={{ color: "#9ca3af" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  다운로드 {selected.downloads}회
                </span>
              </div>

              {/* 본문 (있을 때만) */}
              {selected.content && (
                <p
                  className="text-[15px] whitespace-pre-wrap"
                  style={{ color: "#1A1C1E", lineHeight: 1.7 }}
                >
                  {selected.content}
                </p>
              )}

              {/* 첨부 파일 카드 */}
              {selected.url ? (
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                  style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(230,0,126,0.08)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1A1C1E" }}>{selected.fileName ?? selected.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selected.ext && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase" style={{ background: "#e8e9ea", color: "#4F4F4F" }}>{selected.ext}</span>}
                      {selected.size && <span className="text-[11px]" style={{ color: "#9ca3af" }}>{selected.size}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDownload(selected, e)}
                    className="shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                    style={{ background: "#1A1C1E", color: "#ffffff" }}
                  >
                    다운로드
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center justify-center gap-2 px-4 py-6 rounded-2xl"
                  style={{ background: "#fafbfc", border: "1px dashed #e8e9ea", color: "#9ca3af" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-xs">첨부 파일이 없습니다</span>
                </div>
              )}
            </div>
          )}

          {/* ── 자료 등록/수정 폼 ── */}
          {(drawerMode === "register" || drawerMode === "edit") && (
            <form
              ref={formRef}
              key={drawerMode === "edit" ? `edit-${selected?.id}` : "register"}
              onSubmit={handleSubmit}
              className="px-7 py-6 space-y-5"
            >
              <Field label="자료명" required>
                <input
                  name="title" required placeholder="자료명을 입력하세요"
                  defaultValue={drawerMode === "edit" ? selected?.title : ""}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all" style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")} onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")} />
              </Field>

              <Field label="카테고리" required>
                <div className="relative">
                  <select
                    name="categoryId" required
                    defaultValue={drawerMode === "edit" ? String(selected?.category.id) : ""}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none appearance-none" style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")} onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}>
                    <option value="" disabled>카테고리 선택</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
                </div>
              </Field>

              <Field label="내용">
                <textarea
                  name="content" rows={4} placeholder="자료에 대한 설명을 입력하세요"
                  defaultValue={drawerMode === "edit" ? selected?.content ?? "" : ""}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all resize-none" style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent", lineHeight: "1.6" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")} onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")} />
              </Field>

              {drawerMode === "edit" && selected?.fileName && (
                <p className="text-xs px-3.5 py-2 rounded-lg" style={{ background: "rgba(255,153,0,0.08)", color: "#c97400" }}>
                  현재 파일: <span className="font-medium">{selected.fileName}</span> · 파일 변경은 지원하지 않습니다 (필요 시 자료를 새로 등록해주세요)
                </p>
              )}

              {drawerMode === "register" && <Field label="파일 업로드">
                <div
                  className="rounded-xl transition-all cursor-pointer"
                  style={{ border: `2px dashed ${isDragOver ? "#E6007E" : droppedFile ? "#E6007E" : "#e8e9ea"}`, background: isDragOver ? "rgba(230,0,126,0.04)" : droppedFile ? "rgba(230,0,126,0.03)" : "#f8f9fa" }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" name="file" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} accept=".pdf,.ppt,.pptx,.xlsx,.xls,.docx,.doc,.zip,.hwp" />
                  {droppedFile ? (
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(230,0,126,0.10)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "#1A1C1E" }}>{droppedFile.name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>{(droppedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDroppedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="shrink-0 hover:opacity-60" style={{ color: "#9ca3af" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-7">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>파일을 드래그하거나 <span style={{ color: "#E6007E" }}>클릭하여 선택</span></p>
                      <p className="text-[11px]" style={{ color: "#c4c7ca" }}>PDF, PPT, XLSX, DOCX, HWP, ZIP · 최대 50MB</p>
                    </div>
                  )}
                </div>
              </Field>}

              <Field label="조회 권한">
                <RoleAccessSelector defaultValue={drawerMode === "edit" ? selected?.visibleRoles ?? null : null} />
              </Field>

              {formError && <p className="text-xs" style={{ color: "#E6007E" }}>{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeDrawer} className="flex-1 h-10 rounded-xl text-sm font-semibold hover:opacity-70 transition-opacity" style={{ background: "#f3f4f5", color: "#4F4F4F" }}>취소</button>
                <button type="submit" disabled={isPendingForm} className="flex-1 h-10 rounded-xl text-sm font-semibold hover:opacity-80 disabled:opacity-50 transition-opacity" style={{ background: "#E6007E", color: "#ffffff" }}>
                  {isPendingForm ? "저장 중..." : drawerMode === "edit" ? "수정" : "등록"}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
