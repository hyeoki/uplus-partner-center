"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 헤더 우측에 위치한 통합 검색 트리거.
 * 폼 submit 또는 Enter → /search?q=... 페이지로 이동.
 * ⌘K / Ctrl+K 단축키로 포커스.
 */
export default function GlobalSearch({ scrolled = false }: { scrolled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [isMac, setIsMac] = useState(false);

  // OS 감지 — kbd 표기 (Mac: ⌘K / Win·Linux: Ctrl K)
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent));
    }
  }, []);

  // /search 페이지에서만 쿼리 동기화. 다른 페이지로 이동하면 input 비움.
  useEffect(() => {
    if (pathname === "/search") {
      setQ(params.get("q") ?? "");
    } else {
      setQ("");
    }
  }, [pathname, params]);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed.length === 0) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 flex items-center gap-2 px-3 h-10 rounded-full overflow-hidden transition-[width,background] duration-300 ease-out focus-within:bg-white w-[140px] focus-within:w-[280px] backdrop-blur-md"
      style={{
        background: scrolled ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.6)",
        border: "1px solid #e8e9ea",
        boxShadow: scrolled ? "0px 4px 12px rgba(25,28,29,0.06)" : "none",
      }}
    >
      <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="검색"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        style={{ color: "#1A1C1E" }}
      />
      <kbd
        className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium"
        style={{ background: "#f3f4f5", color: "#9ca3af", border: "1px solid #e5e7eb" }}
      >
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </form>
  );
}
