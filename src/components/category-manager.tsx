"use client";

import { useState, useTransition } from "react";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  toggleCategoryActive,
  updateCategoryColor,
} from "@/app/(dashboard)/system/actions";
import { CATEGORY_COLORS, getCategoryColor } from "@/lib/category-colors";

type CategoryRow = {
  id: number;
  name: string;
  colorId: string;
  active: boolean;
  archiveCount: number;
};

export default function CategoryManager({ categories }: { categories: CategoryRow[] }) {
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
      const result = await createCategory(null, fd);
      if (result?.error) setCreateError(result.error);
      else cancelAdd();
    });
  }
  function changeColor(id: number, colorId: string) {
    setRowError(null);
    setColorPickerId(null);
    startTransition(async () => {
      try {
        await updateCategoryColor(id, colorId);
      } catch (e) {
        setRowError({ id, msg: (e as Error).message });
      }
    });
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setRowError(null);
  }
  function submitEdit(id: number) {
    const name = editName;
    setRowError(null);
    startTransition(async () => {
      try {
        await renameCategory(id, name);
        setEditingId(null);
      } catch (e) {
        setRowError({ id, msg: (e as Error).message });
      }
    });
  }
  function handleToggle(id: number) {
    setRowError(null);
    startTransition(async () => {
      try {
        await toggleCategoryActive(id);
      } catch (e) {
        setRowError({ id, msg: (e as Error).message });
      }
    });
  }
  function handleDelete(cat: CategoryRow) {
    if (!confirm(`"${cat.name}" 카테고리를 삭제할까요?`)) return;
    setRowError(null);
    startTransition(async () => {
      try {
        await deleteCategory(cat.id);
      } catch (e) {
        setRowError({ id: cat.id, msg: (e as Error).message });
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
          자료실 카테고리
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={startAdd}
            className="h-9 px-4 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
          >
            + 카테고리 추가
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
              placeholder="새 카테고리명"
              maxLength={30}
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
        {categories.length === 0 && !adding ? (
          <p className="text-sm py-8 text-center" style={{ color: "#9ca3af" }}>
            등록된 카테고리가 없습니다. 우측 상단 &quot;카테고리 추가&quot; 버튼으로 시작해보세요.
          </p>
        ) : (
          categories.map((cat) => {
            const isEditing = editingId === cat.id;
            return (
              <div key={cat.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                  style={{ background: "#f8f9fa" }}
                >
                  {/* 컬러 스왓치 — 클릭 시 색상 변경 픽커 */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setColorPickerId(colorPickerId === cat.id ? null : cat.id)}
                      title="색상 변경"
                      className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                      style={{ background: getCategoryColor(cat.colorId).swatch }}
                    />
                    {colorPickerId === cat.id && (
                      <div
                        className="absolute z-20 top-6 left-0 flex items-center gap-1.5 p-2 rounded-lg shadow-lg bg-white"
                        style={{ border: "1px solid #e8e9ea" }}
                      >
                        {CATEGORY_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => changeColor(cat.id, c.id)}
                            title={c.label}
                            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                            style={{
                              background: c.swatch,
                              outline: cat.colorId === c.id ? `2px solid ${c.swatch}` : "none",
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
                        if (e.key === "Enter") submitEdit(cat.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={30}
                      className="flex-1 h-8 px-2 text-sm bg-white rounded-md outline-none"
                      style={{ border: "1px solid #e8e9ea" }}
                    />
                  ) : (
                    <span
                      className="text-sm font-medium flex-1"
                      style={{ color: "#1A1C1E" }}
                    >
                      {cat.name}
                    </span>
                  )}

                  <span className="text-xs" style={{ color: "#9ca3af" }}>
                    {cat.archiveCount}건
                  </span>

                  {/* 활성 토글 */}
                  <button
                    type="button"
                    onClick={() => handleToggle(cat.id)}
                    disabled={isPending}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-60"
                    style={{
                      background: cat.active ? "rgba(230,0,126,0.08)" : "#e8e9ea",
                      color: cat.active ? "#E6007E" : "#9ca3af",
                    }}
                  >
                    {cat.active ? "활성" : "비활성"}
                  </button>

                  {/* 액션 버튼들 */}
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => submitEdit(cat.id)}
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
                        onClick={() => startEdit(cat)}
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
                        onClick={() => handleDelete(cat)}
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
                {rowError?.id === cat.id && (
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
