"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { useMobileMenu } from "@/hooks/useMobileMenu";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  desc: string;
  /** true면 admin 계정에만 노출 */
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "홈", icon: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z", desc: "대시보드 홈" },
  { href: "/notice", label: "공지사항", icon: "M4 6h16M4 12h10M4 18h12", desc: "파트너 공지 확인" },
  { href: "/archive", label: "자료실", icon: "M4 4h16v16H4zM8 8h8M8 12h5", desc: "소개서·브로슈어 다운로드" },
  { href: "/inquiry", label: "헬프센터", icon: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z", desc: "문의·의견 보내기" },
  { href: "/customers", label: "고객사 사이트", icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM8 13.5h.01M12 13.5h.01M16 13.5h.01", desc: "고객사·라이선스 관리" },
  { href: "/system", label: "시스템 관리", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z", desc: "카테고리·설정 관리", adminOnly: true },
];

const STORAGE_KEY = "sidebar-collapsed";

export default function Sidebar({
  profile,
  isAdmin = false,
}: {
  profile?: { name: string; photoUrl: string | null };
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { isFavorite, toggle } = useFavorites();
  const { mobileOpen, setMobileOpen } = useMobileMenu();
  const [isMobile, setIsMobile] = useState(false);

  // 페이지 이동 시 모바일 드로어 자동 닫기
  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 모바일 viewport 감지
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const filteredNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  // 정렬: 홈 항상 최상단 → 즐겨찾기된 메뉴 → 그 외. 같은 그룹 내에선 NAV_ITEMS 원래 순서.
  const visibleNav = [
    ...filteredNav.filter((i) => i.href === "/home"),
    ...filteredNav.filter((i) => i.href !== "/home" && isFavorite(i.href)),
    ...filteredNav.filter((i) => i.href !== "/home" && !isFavorite(i.href)),
  ];
  const [collapsedState, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // localStorage에서 접힘 상태 복원 (hydration mismatch 방지)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  // 모바일에서는 collapsed 무시 (항상 풀 폭). 데스크탑에서만 collapsed 적용.
  const collapsed = isMobile ? false : collapsedState;

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      {/* 모바일 백드롭 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        data-sidebar
        className={
          "flex flex-col shrink-0 transition-[width,transform] duration-200 ease-out " +
          "fixed inset-y-0 left-0 z-50 md:static md:translate-x-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")
        }
        style={{
          background: "#f3f4f5",
          width: isMobile ? "100vw" : collapsed ? 64 : 220,
          transition: hydrated ? undefined : "none",
        }}
      >
      {/* Brand + Toggle */}
      <div className={collapsed ? "px-3 pt-6 pb-4 mb-2 flex flex-col items-center gap-3" : "px-5 pt-6 pb-4 mb-2 flex items-start justify-between gap-2"}>
        {!collapsed && (
          <div className="min-w-0">
            <Image
              src="/logo.svg"
              alt="U+ 초정밀측위"
              width={72}
              height={15}
              className="object-contain"
              priority
            />
            <div
              className="mt-2 text-xl font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)", color: "#3a3d40" }}
            >
              파트너센터
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={isMobile ? () => setMobileOpen(false) : toggleCollapsed}
          aria-label={isMobile ? "메뉴 닫기" : collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          title={isMobile ? "메뉴 닫기" : collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "#4F4F4F" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e8e9ea";
            e.currentTarget.style.color = "#E6007E";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#4F4F4F";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className={collapsed ? "flex-1 px-2" : "flex-1 px-3"}>
        {visibleNav.map((item) => {
          const isActive = pathname === item.href;
          const starred = isFavorite(item.href);
          return (
            <div key={item.href} className="flex items-center gap-1 mb-0.5 group/row">
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={
                  (collapsed
                    ? "flex items-center justify-center w-10 h-10 rounded-xl mx-auto"
                    : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm flex-1") +
                  " transition-colors duration-150 " +
                  (isActive
                    ? "bg-white text-[#E6007E] font-semibold shadow-[0px_4px_12px_rgba(25,28,29,0.05)]"
                    : "text-[#4F4F4F] hover:bg-white/70 hover:text-[#E6007E]")
                }
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
                {!collapsed && item.label}
              </Link>

              {/* 즐겨찾기 버튼 — 홈 제외, 펼쳐진 상태에서만 노출 */}
              {!collapsed && item.href !== "/home" && (
                <button
                  onClick={() => toggle(item.href)}
                  title={starred ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-all"
                  style={{
                    opacity: starred ? 1 : undefined,
                    color: starred ? "#E6007E" : "#9ca3af",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill={starred ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={!starred ? "opacity-0 group-hover/row:opacity-100 transition-opacity" : ""}
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* Wiki shortcuts (외부 링크 — 새 탭) */}
      <div
        className={collapsed ? "px-2 pt-3 pb-1 flex flex-col items-center gap-1" : "px-3 pt-3 pb-1"}
        style={{ borderTop: "1px solid #e8e9ea" }}
      >
        {!collapsed && (
          <div className="px-3 mb-1.5 text-[10px] uppercase tracking-wider" style={{ color: "#9ca3af" }}>
            위키 바로가기
          </div>
        )}
        <WikiLink
          collapsed={collapsed}
          href="https://hni-gl.atlassian.net/wiki/spaces/HICCPWK/overview"
          label="U+ 초정밀측위 서비스"
          shortLabel="U+"
        />
        <WikiLink
          collapsed={collapsed}
          href="https://hni-gl.atlassian.net/wiki/spaces/HIEDGWK/overview"
          label="GNSS 수신기"
          shortLabel="GNSS"
        />
      </div>

      {/* Profile dropdown (sidebar bottom) */}
      <ProfileMenu profile={profile} collapsed={collapsed} />
      </aside>
    </>
  );
}

function ProfileMenu({
  profile,
  collapsed,
}: {
  profile?: { name: string; photoUrl: string | null };
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initial = ((profile?.name ?? "?").trim().slice(0, 1) || "?");

  return (
    <div
      ref={ref}
      className={collapsed ? "relative px-2 py-3 flex justify-center" : "relative px-3 py-3"}
      style={{ borderTop: "1px solid #e8e9ea" }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={profile?.name ? `${profile.name}님` : "프로필"}
        className={
          collapsed
            ? "w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            : "flex items-center gap-2 px-2 py-2 rounded-lg transition-colors w-full text-left"
        }
        style={{ background: open ? "#e8e9ea" : "transparent", color: "#1A1C1E" }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "#e8e9ea"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {profile?.photoUrl ? (
          <img
            src={profile.photoUrl}
            alt={`${profile.name} 프로필`}
            className={collapsed ? "w-7 h-7 rounded-full object-cover" : "w-8 h-8 rounded-full object-cover shrink-0"}
            style={{ border: "1px solid #e8e9ea" }}
          />
        ) : (
          <span
            className={
              collapsed
                ? "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                : "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            }
            style={{ background: "#e8e9ea", color: "#4F4F4F" }}
          >
            {initial}
          </span>
        )}
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: "#1A1C1E" }}>
                {profile?.name ?? "사용자"}
              </div>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: "#9ca3af",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown panel — 위로 펼침 */}
      {open && (
        <div
          className={
            collapsed
              ? "absolute left-full bottom-2 ml-2 w-44 rounded-xl p-1.5 z-20"
              : "absolute left-3 right-3 bottom-[calc(100%-12px)] rounded-xl p-1.5 z-20"
          }
          style={{
            background: "#ffffff",
            boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.12)",
            border: "1px solid #e8e9ea",
          }}
        >
          <a
            href="https://www.hi-rtk.io/#/main/my-account"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ color: "#1A1C1E" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="flex-1">계정 관리</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
              <path d="M7 17L17 7M17 7H8M17 7v9" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              // 현재 origin 기준으로 redirect → 로컬은 localhost/0.0.0.0:3000, 운영은 partners.hi-rtk.io
              signOut({ callbackUrl: `${window.location.origin}/` });
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors w-full text-left"
            style={{ color: "#dc2626" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span>로그아웃</span>
          </button>
        </div>
      )}
    </div>
  );
}

function WikiLink({
  href,
  label,
  shortLabel,
  collapsed,
}: {
  href: string;
  label: string;
  shortLabel: string;
  collapsed: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${label} 위키 (새 탭)`}
      className={
        collapsed
          ? "w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
          : "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
      }
      style={{ color: "#4F4F4F" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#e8e9ea";
        e.currentTarget.style.color = "#E6007E";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "#4F4F4F";
      }}
    >
      {/* 위키(펼친 책) 아이콘 — 펼친/접힌 상태 모두 표시 */}
      <svg
        width={collapsed ? 17 : 14}
        height={collapsed ? 17 : 14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
      {!collapsed && (
        <>
          <span className="flex-1 truncate" aria-label={shortLabel}>
            {label}
          </span>
          {/* external icon */}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.6 }}
          >
            <path d="M7 17L17 7M17 7H8M17 7v9" />
          </svg>
        </>
      )}
    </a>
  );
}
