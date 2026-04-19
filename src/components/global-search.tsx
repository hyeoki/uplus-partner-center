"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 헤더 우측 통합 검색 트리거.
 * 평소: ? 아이콘 원형 버튼 (40×40)
 * 클릭/⌘K: 검색 input이 좌측으로 부드럽게 펼쳐짐 (width transition)
 * Esc / 외부 클릭(빈 입력) → 다시 아이콘으로 접힘
 */
export default function GlobalSearch({ scrolled = false }: { scrolled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wrapRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  // /search 페이지에서만 쿼리 동기화. 다른 페이지로 이동하면 input 비움.
  useEffect(() => {
    if (pathname === "/search") {
      setQ(params.get("q") ?? "");
    } else {
      setQ("");
    }
  }, [pathname, params]);

  // ⌘K / Ctrl+K 단축키 + Esc 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 펼쳐지면 자동 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      inputRef.current?.blur();
    }
  }, [open]);

  // 외부 클릭 → 접힘 (input이 비어있을 때만)
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        if (q.trim().length === 0) setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, q]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  }

  return (
    <form
      ref={wrapRef}
      onSubmit={handleSubmit}
      className="shrink-0 relative flex items-center h-10 rounded-full overflow-hidden backdrop-blur-md transition-[width,box-shadow,background] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        width: open ? "280px" : "40px",
        background: open
          ? "rgba(255,255,255,0.96)"
          : scrolled
            ? "rgba(255,255,255,0.96)"
            : "rgba(255,255,255,0.7)",
        border: "1px solid #e8e9ea",
        boxShadow: open
          ? "0px 4px 12px rgba(25,28,29,0.08)"
          : scrolled
            ? "0px 4px 12px rgba(25,28,29,0.06)"
            : "0px 2px 6px rgba(25,28,29,0.04)",
      }}
    >
      {/* 아이콘 버튼 — 닫혔을 때 클릭하면 열림 */}
      <button
        type="button"
        onClick={() => !open && setOpen(true)}
        aria-label={open ? "검색" : "검색 열기"}
        title="검색 (⌘K)"
        tabIndex={open ? -1 : 0}
        className="shrink-0 w-10 h-10 inline-flex items-center justify-center transition-colors"
        style={{ color: "#4F4F4F" }}
      >
        {open ? (
          // 돋보기 아이콘 (열렸을 때)
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ) : (
          // 물음표 아이콘 (닫혔을 때)
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </button>

      {/* 입력 영역 — 항상 마운트, 펼쳐졌을 때만 보임/사용 */}
      <div
        className="flex items-center gap-2 pr-2 flex-1 min-w-0 transition-opacity duration-200"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transitionDelay: open ? "120ms" : "0ms",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="사이트, 자료, 공지, 문의 검색"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          style={{ color: "#1A1C1E" }}
          tabIndex={open ? 0 : -1}
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="검색 닫기"
          tabIndex={open ? 0 : -1}
          className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-gray-100"
          style={{ color: "#9ca3af" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </form>
  );
}
