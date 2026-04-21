"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PRODUCT_BADGE = { bg: "rgba(26,28,30,0.06)", color: "#1A1C1E" };

const LICENSE_FALLBACK: Record<string, string> = {
  STANDARD: "#5726E2",
  BASIC: "#38A7DA",
  FREE: "#4ba59f",
};

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  OFFICIAL: { bg: "rgba(22,163,74,0.10)", color: "#16a34a" },
  POC: { bg: "rgba(230,0,126,0.10)", color: "#E6007E" },
  DEV: { bg: "rgba(79,79,79,0.10)", color: "#4F4F4F" },
};

function withAlpha(hex: string, alpha = 0.12): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export type LicenseRow = {
  id: string;
  licenseName: string | null;
  licenseType: string | null;
  licenseColor: string | null;
  siteLicenseType: string | null;
  plan: string | null;
  sessionCount: number | null;
  startDate: string | null; // ISO
  endDate: string | null;
  /** hi-rtk 화면의 "활성/비활성"과 일치 (=activeStatus AND NOT expireStatus). null이면 미동기화 */
  licenseStatus: boolean | null;
};

export type SiteRow = {
  id: string;
  alias: string | null;
  name: string;
  bookmark: boolean;
  server: "AWS" | "NCP" | string;
  productName: string | null;
  productHost: string | null;
  productContextPath: string | null;
  licenses: LicenseRow[];
};

const SERVER_COLOR: Record<string, { bg: string; color: string }> = {
  AWS: { bg: "rgba(255,153,0,0.12)", color: "#FF9900" },     // AWS 오렌지
  NCP: { bg: "rgba(3,199,90,0.12)", color: "#03C75A" },      // 네이버 그린
};

const SERVER_LABEL: Record<string, string> = {
  AWS: "AWS",
  NCP: "네이버공공클라우드",
};

export default function CustomersTable({ sites }: { sites: SiteRow[] }) {
  const [q, setQ] = useState("");
  const [serverFilter, setServerFilter] = useState<string>("all"); // all/AWS/NCP
  const [licenseFilter, setLicenseFilter] = useState<string>("all"); // all/STANDARD/BASIC/FREE
  const [typeFilter, setTypeFilter] = useState<string>("all"); // all/OFFICIAL/POC/DEV
  const [statusFilter, setStatusFilter] = useState<string>("active"); // all/active/expired
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());

  // ?openId=xxx → 해당 사이트 row를 펼치고 스크롤 + 잠시 강조
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openIdQuery = searchParams.get("openId");
  useEffect(() => {
    if (!openIdQuery) return;
    const target = sites.find((s) => s.id === openIdQuery);
    if (target) {
      setExpanded((prev) => new Set(prev).add(target.id));
      setHighlightId(target.id);
      // 다음 paint에서 스크롤
      requestAnimationFrame(() => {
        rowRefs.current.get(target.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      // 2.5초 후 highlight 제거
      const t = setTimeout(() => setHighlightId(null), 2500);
      // 쿼리 정리
      const params = new URLSearchParams(searchParams.toString());
      params.delete("openId");
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdQuery]);

  const filteredSites = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return sites
      .map((s) => {
        const matchedLicenses = s.licenses.filter((l) => {
          // 활성/만료 판단은 licenseStatus 기준 (hi-rtk 화면과 일치)
          if (statusFilter === "active" && l.licenseStatus !== true) return false;
          if (statusFilter === "expired" && l.licenseStatus !== false) return false;
          if (licenseFilter !== "all" && l.licenseType !== licenseFilter) return false;
          if (typeFilter !== "all" && l.siteLicenseType !== typeFilter) return false;
          return true;
        });
        return { ...s, matchedLicenses };
      })
      .filter((s) => {
        if (serverFilter !== "all" && s.server !== serverFilter) return false;

        // 라이선스 필터/상태 필터가 걸려 있으면, 매칭되는 라이선스가 0건인 사이트는 숨김
        const filtersActive =
          serverFilter !== "all" ||
          licenseFilter !== "all" ||
          typeFilter !== "all" ||
          statusFilter !== "all";
        if (filtersActive && s.matchedLicenses.length === 0) return false;

        // 검색은 사이트명/코드/매칭된 라이선스의 plan에서
        if (qLower) {
          const hay = [
            s.alias,
            s.name,
            s.productName,
            ...s.matchedLicenses.map((l) => l.plan),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(qLower)) return false;
        }
        return true;
      });
  }, [sites, q, serverFilter, licenseFilter, typeFilter, statusFilter]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allExpanded = filteredSites.length > 0 && filteredSites.every((s) => expanded.has(s.id));
  function toggleAll() {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(filteredSites.map((s) => s.id)));
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {/* 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative shrink-0" style={{ width: "240px" }}>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="사이트를 검색해주세요."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
            style={{ background: "#ffffff", color: "#1A1C1E", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)", border: "1.5px solid transparent" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#E6007E")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
          />
        </div>
        <div className="w-px h-5 shrink-0" style={{ background: "#e8e9ea" }} />

        <Select value={serverFilter} onChange={setServerFilter} label="서버">
          <option value="all">서버 전체</option>
          <option value="AWS">AWS</option>
          <option value="NCP">네이버공공클라우드</option>
        </Select>

        <Select value={typeFilter} onChange={setTypeFilter} label="구분">
          <option value="all">구분 전체</option>
          <option value="OFFICIAL">OFFICIAL</option>
          <option value="POC">POC</option>
          <option value="DEV">DEV</option>
        </Select>

        <Select value={licenseFilter} onChange={setLicenseFilter} label="라이선스">
          <option value="all">라이선스 전체</option>
          <option value="STANDARD">고급형</option>
          <option value="BASIC">일반형</option>
          <option value="FREE">FREE</option>
        </Select>

        <Select value={statusFilter} onChange={setStatusFilter} label="활성화">
          <option value="active">활성만</option>
          <option value="expired">만료만</option>
          <option value="all">전체</option>
        </Select>

        <button
          type="button"
          onClick={toggleAll}
          className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0"
          style={{ background: "#ffffff", color: "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}
        >
          {allExpanded ? "모두 접기" : "모두 펼치기"}
        </button>
      </div>
      {(q || serverFilter !== "all" || typeFilter !== "all" || licenseFilter !== "all" || statusFilter !== "active") && (
        <p className="text-xs -mt-2" style={{ color: "#9ca3af" }}>
          검색 결과 {filteredSites.length}건
        </p>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#ffffff", boxShadow: "0px 12px 32px rgba(25, 28, 29, 0.06)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #edeeef" }}>
              <Th>사이트</Th>
              <Th>서버</Th>
              <Th>제품</Th>
              <Th align="right">동시접속(활성)</Th>
              <Th align="right" style={{ width: 60 }}> </Th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: "#9ca3af" }}>
                  조건에 맞는 사이트가 없습니다.
                </td>
              </tr>
            ) : (
              filteredSites.map((s) => {
                // hi-rtk 측위 콘솔 직링크 — 사이트 코드를 서브도메인으로 사용
                const externalUrl =
                  s.productHost && s.name
                    ? `https://${s.name}.${s.productHost}${s.productContextPath ?? ""}`
                    : null;
                const isOpen = expanded.has(s.id);
                const lics = s.matchedLicenses;
                const sessionTotal = lics
                  .filter((l) => l.licenseStatus === true)
                  .reduce((sum, l) => sum + (l.sessionCount ?? 0), 0);

                const isHighlighted = highlightId === s.id;
                return (
                  <FragmentRow key={s.id}>
                    <tr
                      ref={(el) => { rowRefs.current.set(s.id, el); }}
                      onClick={() => toggle(s.id)}
                      className="cursor-pointer transition-colors hover:bg-[#fafafa]"
                      style={{
                        borderBottom: isOpen ? "none" : "1px solid #f3f4f5",
                        background: isHighlighted ? "rgba(230,0,126,0.06)" : undefined,
                        transition: "background-color 0.5s ease",
                      }}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          {s.bookmark && (
                            <span title="북마크" style={{ color: "#E6007E" }} className="inline-flex">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            </span>
                          )}
                          {externalUrl ? (
                            <a
                              href={externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="사이트 바로가기 (새 탭)"
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium transition-colors hover:text-[#E6007E] hover:underline underline-offset-2"
                              style={{ color: "#1A1C1E" }}
                            >
                              {s.alias || s.name}
                            </a>
                          ) : (
                            <span className="font-medium" style={{ color: "#1A1C1E" }}>
                              {s.alias || s.name}
                            </span>
                          )}
                          <span className="text-[11px]" style={{ color: "#c4c7ca" }}>
                            {s.name}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        {(() => {
                          const c = SERVER_COLOR[s.server] ?? { bg: "#edeeef", color: "#4F4F4F" };
                          const label = SERVER_LABEL[s.server] ?? s.server;
                          return (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                              style={{ background: c.bg, color: c.color }}
                              title={s.server === "NCP" ? "네이버 공공클라우드" : "AWS"}
                            >
                              {label}
                            </span>
                          );
                        })()}
                      </Td>
                      <Td>
                        {s.productName ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                            style={{ background: PRODUCT_BADGE.bg, color: PRODUCT_BADGE.color }}
                          >
                            {s.productName}
                          </span>
                        ) : (
                          <Dash />
                        )}
                      </Td>
                      <Td align="right">
                        <span className="font-medium" style={{ color: "#1A1C1E" }}>
                          {sessionTotal.toLocaleString("ko-KR")}
                        </span>
                      </Td>
                      <Td align="right">
                        <Caret open={isOpen} />
                      </Td>
                    </tr>

                    {/* Expanded license cards */}
                    {isOpen && (
                      <tr style={{ borderBottom: "1px solid #f3f4f5", background: "#fafbfc" }}>
                        <td colSpan={5} className="px-6 py-5">
                          {lics.length === 0 ? (
                            <p className="text-xs text-center py-4" style={{ color: "#9ca3af" }}>
                              라이선스가 없습니다.
                            </p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ borderBottom: "1px solid #edeeef" }}>
                                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium whitespace-nowrap" style={{ color: "#9ca3af" }}>구분</th>
                                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-medium whitespace-nowrap" style={{ color: "#9ca3af" }}>요금제</th>
                                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-medium whitespace-nowrap" style={{ color: "#9ca3af" }}>동시접속</th>
                                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-medium whitespace-nowrap" style={{ color: "#9ca3af" }}>기간</th>
                                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-medium whitespace-nowrap" style={{ color: "#9ca3af" }}>활성</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lics.map((l, idx) => {
                                  const licColor =
                                    l.licenseColor ||
                                    (l.licenseType ? LICENSE_FALLBACK[l.licenseType] : null) ||
                                    "#9ca3af";
                                  const tColor = l.siteLicenseType ? TYPE_COLOR[l.siteLicenseType] : null;
                                  const end = l.endDate ? new Date(l.endDate) : null;
                                  const start = l.startDate ? new Date(l.startDate) : null;
                                  const isActive = l.licenseStatus === true;
                                  const fmtDate = (d: Date | null) =>
                                    d ? d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\.$/, "") : "—";
                                  return (
                                    <tr
                                      key={l.id}
                                      style={{ borderBottom: idx === lics.length - 1 ? "none" : "1px solid #f3f4f5" }}
                                    >
                                      {/* 구분 + 라이선스 뱃지 한 셀 */}
                                      <td className="px-3 py-2.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          {l.siteLicenseType && tColor ? (
                                            <span
                                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                                              style={{ background: tColor.bg, color: tColor.color }}
                                            >
                                              {l.siteLicenseType}
                                            </span>
                                          ) : null}
                                          {l.licenseName && (
                                            <span
                                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                                              style={{ background: withAlpha(licColor, 0.12), color: licColor }}
                                            >
                                              {l.licenseName}
                                            </span>
                                          )}
                                          {!l.siteLicenseType && !l.licenseName && <Dash />}
                                        </div>
                                      </td>
                                      {/* 요금제 */}
                                      <td className="px-3 py-2.5">
                                        {l.plan ? (
                                          <span className="text-sm" style={{ color: "#1A1C1E" }} title={l.plan}>
                                            {l.plan}
                                          </span>
                                        ) : (
                                          <Dash />
                                        )}
                                      </td>
                                      {/* 동시접속 */}
                                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                        <span className="text-sm font-medium" style={{ color: "#1A1C1E" }}>
                                          {l.sessionCount ?? "—"}
                                        </span>
                                      </td>
                                      {/* 기간 */}
                                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                        <span className="text-xs" style={{ color: "#4F4F4F" }}>
                                          {fmtDate(start)} ~ {fmtDate(end)}
                                        </span>
                                      </td>
                                      {/* 활성 */}
                                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                        {l.licenseStatus == null ? (
                                          <Dash />
                                        ) : (
                                          <span
                                            className="inline-flex items-center gap-1 text-[11px]"
                                            style={{ color: isActive ? "#16a34a" : "#9ca3af" }}
                                          >
                                            <span
                                              className="inline-block w-1.5 h-1.5 rounded-full"
                                              style={{ background: isActive ? "#16a34a" : "#c4c7ca" }}
                                            />
                                            {isActive ? "활성" : "비활성"}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// React.Fragment를 tbody의 자식으로 두 row 묶기 위한 헬퍼
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Th({
  children,
  align,
  style,
}: {
  children: React.ReactNode;
  align?: "right";
  style?: React.CSSProperties;
}) {
  return (
    <th
      className="px-4 py-3 text-[11px] uppercase tracking-wider font-medium whitespace-nowrap"
      style={{ color: "#9ca3af", textAlign: align ?? "left", ...style }}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td className="px-4 py-3 whitespace-nowrap" style={{ textAlign: align ?? "left" }}>
      {children}
    </td>
  );
}

function Dash() {
  return <span className="text-xs" style={{ color: "#9ca3af" }}>—</span>;
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9ca3af"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: "inline-block",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s ease",
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="px-3 py-2 rounded-xl text-xs font-medium outline-none cursor-pointer"
      style={{ background: "#ffffff", color: "#4F4F4F", boxShadow: "0px 4px 12px rgba(25,28,29,0.06)" }}
    >
      {children}
    </select>
  );
}
