"use client";

import { useRef, useState, useTransition } from "react";
import { createArchive } from "@/app/(dashboard)/archive/actions";

interface Category {
  id: number;
  name: string;
}

export default function ArchiveRegisterButton({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await createArchive(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
      >
        자료 등록
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(26,28,30,0.40)" }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-7 relative"
            style={{ background: "#ffffff", boxShadow: "0px 24px 64px rgba(25,28,29,0.16)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-base font-bold"
                style={{ fontFamily: "var(--font-display)", color: "#1A1C1E" }}
              >
                자료 등록
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-60"
                style={{ color: "#9ca3af" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {/* 자료명 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4F4F4F" }}>
                  자료명 <span style={{ color: "#E6007E" }}>*</span>
                </label>
                <input
                  name="title"
                  required
                  placeholder="자료명을 입력하세요"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all"
                  style={{
                    background: "#f8f9fa",
                    color: "#1A1C1E",
                    border: "1.5px solid transparent",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4F4F4F" }}>
                  카테고리 <span style={{ color: "#E6007E" }}>*</span>
                </label>
                <select
                  name="categoryId"
                  required
                  defaultValue=""
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none transition-all appearance-none"
                  style={{
                    background: "#f8f9fa",
                    color: "#1A1C1E",
                    border: "1.5px solid transparent",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                >
                  <option value="" disabled>카테고리 선택</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* 파일 형식 + 용량 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4F4F4F" }}>
                    파일 형식
                  </label>
                  <select
                    name="ext"
                    defaultValue="PDF"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none appearance-none"
                    style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                  >
                    <option>PDF</option>
                    <option>PPT</option>
                    <option>XLSX</option>
                    <option>DOCX</option>
                    <option>ZIP</option>
                    <option>기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4F4F4F" }}>
                    파일 크기
                  </label>
                  <input
                    name="size"
                    placeholder="예: 4.2 MB"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: "#f8f9fa", color: "#1A1C1E", border: "1.5px solid transparent" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs" style={{ color: "#E6007E" }}>{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
                  style={{ background: "#f3f4f5", color: "#4F4F4F" }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "#E6007E", color: "#ffffff" }}
                >
                  {isPending ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
