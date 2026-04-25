"use client";

import { useEffect, useRef, useState } from "react";
import GlobalSearch from "@/components/global-search";
import { useMobileMenu } from "@/hooks/useMobileMenu";

/**
 * 베타 배너 + 통합검색 묶음.
 * sticky 컨테이너 — 스크롤 시 부모 main의 scrollTop을 감지해 배경 불투명도를 강화.
 */
export default function TopHeaderBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { toggleMobile } = useMobileMenu();

  useEffect(() => {
    if (!ref.current) return;
    // sticky의 부모 = .flex-1.overflow-y-auto (main)
    let parent: HTMLElement | null = ref.current.parentElement;
    while (parent && parent !== document.body) {
      const overflowY = getComputedStyle(parent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      parent = parent.parentElement;
    }
    if (!parent) return;
    const scrollEl = parent;
    function onScroll() {
      setScrolled(scrollEl.scrollTop > 4);
    }
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  // 스크롤 시 배너와 검색바가 자체적으로 더 진해짐 (배경 그룹화 없음)
  const bannerBg = scrolled
    ? "linear-gradient(90deg, rgba(252, 234, 244, 0.96) 0%, rgba(250, 218, 235, 0.98) 100%)"
    : "linear-gradient(90deg, rgba(230,0,126,0.08) 0%, rgba(230,0,126,0.14) 100%)";
  const bannerShadow = scrolled
    ? "0px 8px 24px rgba(230, 0, 126, 0.12)"
    : "0px 4px 16px rgba(230, 0, 126, 0.08)";

  return (
    <div
      ref={ref}
      className="sticky top-0 z-10 px-4 md:px-8 pt-4 md:pt-5 pb-1 flex items-center gap-2 md:gap-3 pointer-events-none"
    >
      {/* 모바일 햄버거 — 우측 검색 ? 버튼과 정확히 같은 form 구조/스타일 */}
      <div
        className="pointer-events-auto md:hidden shrink-0 relative flex items-center h-10 rounded-full overflow-hidden backdrop-blur-md transition-[box-shadow,background] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: "40px",
          background: scrolled ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.7)",
          border: "1px solid #e8e9ea",
          boxShadow: scrolled
            ? "0px 4px 12px rgba(25,28,29,0.06)"
            : "0px 2px 6px rgba(25,28,29,0.04)",
        }}
      >
        <button
          type="button"
          onClick={toggleMobile}
          aria-label="메뉴 열기"
          className="shrink-0 w-10 h-10 inline-flex items-center justify-center transition-colors"
          style={{ color: "#9ca3af" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      <a
        href="/inquiry?compose=1"
        className="pointer-events-auto flex-1 flex items-center justify-center gap-2 md:gap-2.5 px-3 md:px-6 h-10 rounded-full text-sm transition-all hover:-translate-y-0.5 hover:shadow-md backdrop-blur-md overflow-hidden"
        style={{
          minWidth: "70px",
          background: bannerBg,
          color: "#7a1148",
          border: "1px solid rgba(230, 0, 126, 0.18)",
          boxShadow: bannerShadow,
        }}
      >
        <span
          className="text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wider shrink-0"
          style={{ background: "#E6007E", color: "#ffffff", fontFamily: "var(--font-display)" }}
        >
          BETA
        </span>
        <span className="truncate min-w-0">
          {/* 모바일: 짧은 문구 */}
          <span className="md:hidden">
            <span className="font-semibold underline underline-offset-2" style={{ color: "#E6007E" }}>
              의견 보내기
            </span>{" "}
            🙌
          </span>
          {/* 데스크탑: 풀 문구 */}
          <span className="hidden md:inline">
            파트너센터는 현재 베타 운영 중이에요. 사용하시면서 불편한 점이나 제안이 있다면{" "}
            <span className="font-semibold underline underline-offset-2" style={{ color: "#E6007E" }}>
              여기를 눌러 의견
            </span>
            을 들려주세요 🙌
          </span>
        </span>
      </a>
      <div className="pointer-events-auto">
        <GlobalSearch scrolled={scrolled} />
      </div>
    </div>
  );
}
