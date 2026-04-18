"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

interface Props {
  categories: { id: number; name: string }[];
  totalCount: number;
  filteredCount: number;
}

export default function ArchiveFilters({ categories, totalCount, filteredCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQ = searchParams.get("q") ?? "";
  const currentCat = searchParams.get("category") ?? "";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="space-y-2">
      {/* Search + filter chips on one line */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search bar */}
        <div className="relative shrink-0" style={{ width: "220px" }}>
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isPending ? "#E6007E" : "#9ca3af"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="자료명 검색..."
            defaultValue={currentQ}
            onChange={(e) => updateParams("q", e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
            style={{
              background: "#ffffff",
              color: "#1A1C1E",
              boxShadow: "0px 4px 12px rgba(25,28,29,0.06)",
              border: "1.5px solid transparent",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
          />
        </div>

        {/* Divider */}
        <div className="w-px h-5 shrink-0" style={{ background: "#e8e9ea" }} />

        {/* Category filter chips */}
        <button
          onClick={() => updateParams("category", "")}
          className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
          style={{
            background: currentCat === "" ? "#E6007E" : "#ffffff",
            color: currentCat === "" ? "#ffffff" : "#4F4F4F",
            boxShadow: "0px 4px 12px rgba(25,28,29,0.06)",
          }}
        >
          전체 ({totalCount})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => updateParams("category", String(cat.id))}
            className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
            style={{
              background: currentCat === String(cat.id) ? "#E6007E" : "#ffffff",
              color: currentCat === String(cat.id) ? "#ffffff" : "#4F4F4F",
              boxShadow: "0px 4px 12px rgba(25,28,29,0.06)",
            }}
          >
            {cat.name}
          </button>
        ))}

        {/* 초기화 */}
        {(currentQ || currentCat) && (
          <button
            onClick={() => router.push(pathname, { scroll: false })}
            className="ml-auto text-xs underline hover:opacity-70 shrink-0"
            style={{ color: "#E6007E" }}
          >
            {isPending ? "검색 중..." : `초기화`}
          </button>
        )}
      </div>

      {/* Result count */}
      {(currentQ || currentCat) && !isPending && (
        <p className="text-xs" style={{ color: "#9ca3af" }}>
          검색 결과 {filteredCount}건
        </p>
      )}
    </div>
  );
}
