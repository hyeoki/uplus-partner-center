"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createNoticeTag,
  deleteNoticeTag,
  renameNoticeTag,
  reorderNoticeTags,
  toggleNoticeTagActive,
  updateNoticeTagColor,
} from "@/app/(dashboard)/system/actions";
import { CATEGORY_COLORS, getCategoryColor } from "@/lib/category-colors";

type TagRow = {
  id: number;
  name: string;
  colorId: string;
  active: boolean;
  noticeCount: number;
};

export default function TagManager({ tags }: { tags: TagRow[] }) {
  // 드래그 정렬
  const [orderedIds, setOrderedIds] = useState<number[]>(() => tags.map((t) => t.id));
  const [draggingId, setDraggingId] = useState<number | null>(null);
  useEffect(() => {
    setOrderedIds(tags.map((t) => t.id));
  }, [tags]);
  const orderedTags = orderedIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is TagRow => !!t);

  function onDragStart(e: React.DragEvent, id: number) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent, overId: number) {
    e.preventDefault();
    if (draggingId === null || draggingId === overId) return;
    setOrderedIds((prev) => {
      const next = [...prev];
      const from = next.indexOf(draggingId);
      const to = next.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, draggingId);
      return next;
    });
  }
  function onDragEnd() {
    setDraggingId(null);
    const original = tags.map((t) => t.id).join(",");
    const next = orderedIds.join(",");
    if (original !== next) {
      void reorderNoticeTags(orderedIds);
    }
  }

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColorId, setNewColorId] = useState<string>(CATEGORY_COLORS[0].id);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [colorPickerId, setColorPickerId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function startAdd() {
    setNewName("");
    setNewColorId(CATEGORY_COLORS[0].id);
    setCreateError("");
    setAdding(true);
  }
  function cancelAdd() {
    setAdding(false);
    setNewName("");
    setCreateError("");
  }
  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", newName);
    fd.set("colorId", newColorId);
    setCreateError("");
    startTransition(async () => {
      const result = await createNoticeTag(null, fd);
      if (result?.error) setCreateError(result.error);
      else cancelAdd();
    });
  }

  function startEdit(tag: TagRow) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setRowError(null);
  }
  function submitEdit(id: number) {
    const name = editName;
    setRowError(null);
    startTransition(async () => {
      try {
        await renameNoticeTag(id, name);
        setEditingId(null);
      } catch (e) {
        setRowError({ id, msg: (e as Error).message });
      }
    });
  }
  function changeColor(id: number, colorId: string) {
    setRowError(null);
    setColorPickerId(null);
    startTransition(async () => {
      try {
        await updateNoticeTagColor(id, colorId);
      } catch (e) {
        setRowError({ id, msg: (e as Error).message });
      }
    });
  }
  function handleToggle(id: number) {
    setRowError(null);
    startTransition(async () => {
      try {
        await toggleNoticeTagActive(id);
      } catch (e) {
        setRowError({ id, msg: (e as Error).message });
      }
    });
  }
  function handleDelete(tag: TagRow) {
    if (!confirm(`"${tag.name}" 태그를 삭제할까요?`)) return;
    setRowError(null);
    startTransition(async () => {
      try {
        await deleteNoticeTag(tag.id);
      } catch (e) {
        setRowError({ id: tag.id, msg: (e as Error).message });
      }
    });
  }

  return (
    <div
      className="rounded-2xl p-7"
      style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2
          className="text-sm font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
        >
          공지사항 태그
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={startAdd}
            className="h-9 px-4 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
          >
            + 태그 추가
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {adding && (
        <form
          onSubmit={submitAdd}
          className="mb-3 px-4 py-3 rounded-xl space-y-2"
          style={{ background: "#fafbfc", border: "1px solid #e8e9ea" }}
        >
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 태그명"
              maxLength={20}
              className="flex-1 h-9 px-3 text-sm bg-white rounded-lg outline-none"
              style={{ border: "1px solid #e8e9ea" }}
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ background: "#E6007E", color: "#ffffff" }}
            >
              추가
            </button>
            <button
              type="button"
              onClick={cancelAdd}
              className="h-9 px-3 rounded-lg text-xs font-medium hover:bg-gray-100"
              style={{ color: "#4F4F4F" }}
            >
              취소
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px]" style={{ color: "#9ca3af" }}>색상</span>
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setNewColorId(c.id)}
                title={c.label}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: c.swatch,
                  outline: newColorId === c.id ? `2px solid ${c.swatch}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </form>
      )}
      {createError && (
        <p className="mb-3 text-xs" style={{ color: "#E6007E" }}>{createError}</p>
      )}

      <div className="space-y-2">
        {orderedTags.length === 0 && !adding ? (
          <p className="text-sm py-8 text-center" style={{ color: "#9ca3af" }}>
            등록된 태그가 없습니다.
          </p>
        ) : (
          orderedTags.map((tag) => {
            const isEditing = editingId === tag.id;
            const isDragging = draggingId === tag.id;
            const c = getCategoryColor(tag.colorId);
            return (
              <div
                key={tag.id}
                draggable={!isEditing}
                onDragStart={(e) => onDragStart(e, tag.id)}
                onDragOver={(e) => onDragOver(e, tag.id)}
                onDragEnd={onDragEnd}
                style={{ opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s" }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                  style={{ background: "#f8f9fa" }}
                >
                  {/* 드래그 핸들 */}
                  <span
                    className="shrink-0 select-none"
                    style={{ color: "#c4c7ca", cursor: "grab", fontSize: "16px", lineHeight: 1 }}
                    title="드래그해서 순서 변경"
                  >
                    ⠿
                  </span>

                  {/* 컬러 스왓치 */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setColorPickerId(colorPickerId === tag.id ? null : tag.id)}
                      title="색상 변경"
                      className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                      style={{ background: c.swatch }}
                    />
                    {colorPickerId === tag.id && (
                      <div
                        className="absolute z-20 top-6 left-0 flex items-center gap-1.5 p-2 rounded-lg shadow-lg bg-white"
                        style={{ border: "1px solid #e8e9ea" }}
                      >
                        {CATEGORY_COLORS.map((cc) => (
                          <button
                            key={cc.id}
                            type="button"
                            onClick={() => changeColor(tag.id, cc.id)}
                            title={cc.label}
                            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                            style={{
                              background: cc.swatch,
                              outline: tag.colorId === cc.id ? `2px solid ${cc.swatch}` : "none",
                              outlineOffset: "2px",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitEdit(tag.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={20}
                      className="flex-1 h-8 px-2 text-sm bg-white rounded-md outline-none"
                      style={{ border: "1px solid #e8e9ea" }}
                    />
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-medium flex-1"
                      style={{ color: "#1A1C1E" }}
                    >
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: c.bg, color: c.color }}
                      >
                        {tag.name}
                      </span>
                    </span>
                  )}

                  <span className="text-xs" style={{ color: "#9ca3af" }}>
                    {tag.noticeCount}건
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggle(tag.id)}
                    disabled={isPending}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
                    style={{
                      background: tag.active ? "rgba(230,0,126,0.08)" : "#e8e9ea",
                      color: tag.active ? "#E6007E" : "#9ca3af",
                    }}
                  >
                    {tag.active ? "활성" : "비활성"}
                  </button>

                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => submitEdit(tag.id)}
                        disabled={isPending}
                        className="h-7 px-3 rounded-md text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
                        style={{ background: "#E6007E", color: "#ffffff" }}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="h-7 px-2 rounded-md text-xs hover:bg-gray-200"
                        style={{ color: "#6b7280" }}
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(tag)}
                        title="이름 수정"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-gray-200"
                        style={{ color: "#6b7280" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tag)}
                        disabled={isPending}
                        title="삭제"
                        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-gray-200 disabled:opacity-60"
                        style={{ color: "#6b7280" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
                {rowError?.id === tag.id && (
                  <p className="text-xs mt-1.5 px-4" style={{ color: "#E6007E" }}>
                    {rowError.msg}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
