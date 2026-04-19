"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createArchive, deleteArchive, incrementDownload, updateArchive } from "@/app/(dashboard)/archive/actions";
import RichTextEditor from "@/components/rich-text-editor";
import RichTextView from "@/components/rich-text-view";
import AttachmentsList, { hasBodyAttachments, getBodyAttachments } from "@/components/attachments-list";
import ListAvatar from "@/components/list-avatar";
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
  author?: { name: string; photoUrl?: string | null } | null;
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
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
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
    setDroppedFiles([]);
    setFormError("");
    formRef.current?.reset();
    setDrawerMode("register");
  }

  function openEdit() {
    if (!selected || !isAdmin) return;
    setDroppedFiles([]);
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
    setDroppedFiles([]);
    setFormError("");
    formRef.current?.reset();
  }

  function handleFilesChange(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) setDroppedFiles((prev) => [...prev, ...files]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesChange(e.dataTransfer.files);
  }

  function removeDroppedFile(idx: number) {
    setDroppedFiles((prev) => prev.filter((_, i) => i !== idx));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError("");
    startFormTransition(async () => {
      // 첫 파일은 메인 첨부, 나머지는 NAS 업로드 후 본문에 <a> 링크로 추가
      if (droppedFiles.length > 0) {
        formData.set("file", droppedFiles[0]);
      } else {
        formData.delete("file");
      }
      const extras = droppedFiles.slice(1);
      if (extras.length > 0) {
        const links: string[] = [];
        for (const f of extras) {
          const fd = new FormData();
          fd.set("file", f);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setFormError(err.error ?? `추가 파일 업로드 실패: ${f.name}`);
            return;
          }
          const data = (await res.json()) as { url: string; name: string; isImage: boolean };
          if (data.isImage) {
            links.push(`<p data-attachment="extra"><img src="${data.url}" alt="${escapeAttr(data.name)}" /></p>`);
          } else {
            links.push(`<p data-attachment="extra"><a href="${data.url}" target="_blank" rel="noopener noreferrer">📎 ${escapeAttr(data.name)}</a></p>`);
          }
        }
        const prevContent = (formData.get("content") as string) ?? "";
        formData.set("content", prevContent + links.join(""));
      }
      const result =
        drawerMode === "edit" && selected
          ? await updateArchive(selected.id, formData)
          : await createArchive(formData);
      if (result?.error) setFormError(result.error);
      else closeDrawer();
    });
  }

  function escapeAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function extFromName(name: string): string | null {
    const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(name);
    return m ? m[1].toUpperCase() : null;
  }

  function triggerDownload(url: string, fileName: string) {
    // 같은 origin(/api/files/...)이므로 <a download>가 정상 동작 → 새 탭 안 열고 바로 받기
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDownload(archive: Archive, e: React.MouseEvent) {
    e.stopPropagation();
    if (!archive.url) return;
    await incrementDownload(archive.id);
    triggerDownload(archive.url, archive.fileName ?? archive.title);
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
              <col style={{ width: "110px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "100px" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(230,0,126,0.08)" }}>
                {["카테고리", "자료명", "작성자", "등록일"].map((h) => (
                  <th key={h} className="text-left py-4 px-6 font-medium text-[11px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>{h}</th>
                ))}
                <th className="text-right py-4 px-6 font-medium text-[11px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>다운로드</th>
              </tr>
            </thead>
            <tbody>
              {filteredArchives.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center" style={{ color: "#9ca3af" }}>
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
                  // 메인 파일이 없으면 본문 첨부에서 확장자 추출 (이미지/파일)
                  const bodyAtts = !archive.url ? getBodyAttachments(archive.content) : [];
                  const fallbackExt = !archive.ext && bodyAtts.length > 0
                    ? extFromName(bodyAtts[0].name)
                    : null;
                  const displayExt = archive.ext ?? fallbackExt;
                  const extraCount = bodyAtts.length > 1 ? bodyAtts.length - 1 : 0;
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
                          {displayExt && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase" style={{ background: "#e8e9ea", color: "#4F4F4F" }}>{displayExt}</span>}
                          {extraCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "#e8e9ea", color: "#4F4F4F" }}>+{extraCount}</span>}
                          {archive.size && <span className="text-xs" style={{ color: "#9ca3af" }}>{archive.size}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs whitespace-nowrap truncate" style={{ color: "#4F4F4F" }}>
                        {archive.author ? (
                          <span className="inline-flex items-center gap-2">
                            <ListAvatar name={archive.author.name} photoUrl={archive.author.photoUrl} />
                            <span>{archive.author.name}</span>
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs whitespace-nowrap" style={{ color: "#9ca3af" }}>
                        {new Date(archive.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {archive.url || hasBodyAttachments(archive.content) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // 메인 파일 + 본문 첨부 모두 합쳐서 일괄 다운로드 (200ms 간격)
                              const downloads: Array<{ url: string; name: string }> = [];
                              if (archive.url) {
                                downloads.push({ url: archive.url, name: archive.fileName ?? archive.title });
                              }
                              for (const a of getBodyAttachments(archive.content)) {
                                downloads.push({ url: a.url, name: a.name });
                              }
                              if (downloads.length === 0) return;
                              incrementDownload(archive.id);
                              downloads.forEach((d, idx) => {
                                setTimeout(() => triggerDownload(d.url, d.name), idx * 200);
                              });
                            }}
                            title={archive.url ? "다운로드" : "첨부파일 다운로드"}
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

              {/* 작성자 byline */}
              <div className="flex items-center gap-3">
                <ArchiveAvatar
                  name={selected.author?.name ?? "관리자"}
                  photoUrl={selected.author?.photoUrl}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" style={{ color: "#1A1C1E" }}>
                    {selected.author?.name ?? "관리자"}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                    {new Date(selected.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
              </div>

              {/* 본문 (있을 때만) */}
              {selected.content && (
                <RichTextView html={selected.content} className="text-[15px]" />
              )}

              {/* 첨부파일 — 메인 + 본문 첨부 통합 표시 */}
              {(selected.url || hasBodyAttachments(selected.content)) ? (
                <AttachmentsList
                  html={selected.content}
                  primary={selected.url ? { url: selected.url, name: selected.fileName ?? selected.title } : null}
                />
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
                <RichTextEditor
                  name="content"
                  value={drawerMode === "edit" ? selected?.content ?? "" : ""}
                  placeholder="자료에 대한 설명을 입력하세요"
                />
              </Field>

              {drawerMode === "edit" && selected?.fileName && (
                <p className="text-xs px-3.5 py-2 rounded-lg" style={{ background: "rgba(255,153,0,0.08)", color: "#c97400" }}>
                  현재 파일: <span className="font-medium">{selected.fileName}</span> · 파일 변경은 지원하지 않습니다 (필요 시 자료를 새로 등록해주세요)
                </p>
              )}

              {drawerMode === "register" && <Field label="파일 업로드">
                <div
                  className="rounded-xl transition-all cursor-pointer"
                  style={{ border: `2px dashed ${isDragOver ? "#E6007E" : droppedFiles.length > 0 ? "#E6007E" : "#e8e9ea"}`, background: isDragOver ? "rgba(230,0,126,0.04)" : droppedFiles.length > 0 ? "rgba(230,0,126,0.03)" : "#f8f9fa" }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFilesChange(e.target.files)} />
                  {droppedFiles.length > 0 ? (
                    <div className="px-3 py-3 space-y-1.5">
                      {droppedFiles.map((f, idx) => (
                        <div key={`${f.name}-${idx}`} className="flex items-center gap-3 px-2 py-2 rounded-lg" style={{ background: "rgba(230,0,126,0.04)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(230,0,126,0.10)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "#1A1C1E" }}>{f.name}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>{(f.size / (1024 * 1024)).toFixed(1)} MB</p>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeDroppedFile(idx); }} className="shrink-0 hover:opacity-60" style={{ color: "#9ca3af" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <p className="text-[11px] text-center pt-1" style={{ color: "#E6007E" }}>+ 파일 더 추가</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-7">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      <p className="text-xs" style={{ color: "#9ca3af" }}>파일을 드래그하거나 <span style={{ color: "#E6007E" }}>클릭하여 선택</span> (여러 개 가능)</p>
                      <p className="text-[11px]" style={{ color: "#c4c7ca" }}>최대 100MB / 파일</p>
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

function ArchiveAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
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
