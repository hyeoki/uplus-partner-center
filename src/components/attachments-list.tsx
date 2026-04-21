"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 본문 HTML에서 파일 첨부(<a href="...">📎 파일명</a>)를 추출해 리스트로 표시.
 * 에디터에서 파일 업로드 시 삽입한 링크와 매칭됨.
 */
type Attachment = { url: string; name: string; isImage: boolean };

export default function AttachmentsList({
  html,
  primary,
  onDownload,
}: {
  html: string | null | undefined;
  /** 메인 첨부파일 (Archive.url 등) — 있으면 리스트 맨 앞에 함께 표시 */
  primary?: { url: string; name: string } | null;
  /** 다운로드 버튼 클릭 시 호출 — 자료실의 다운로드 카운트 증가용 */
  onDownload?: (url: string, name: string) => void;
}) {
  const attachments = useMemo<Attachment[]>(() => {
    const body = extractAttachments(html);
    if (!primary?.url) return body;
    // 같은 URL이면 중복 제거
    if (body.some((a) => a.url === primary.url)) return body;
    return [{ url: primary.url, name: primary.name, isImage: isImageUrl(primary.url) }, ...body];
  }, [html, primary]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ESC로 라이트박스 닫기
  useEffect(() => {
    if (!lightboxSrc) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setLightboxSrc(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#9ca3af" }}>
        첨부파일 {attachments.length}
      </div>
      <ul className="space-y-1.5">
        {attachments.map((a, i) => (
          <li
            key={`${a.url}-${i}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors hover:bg-gray-50"
            style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}
          >
            {a.isImage ? (
              <button
                type="button"
                onClick={() => setLightboxSrc(a.url)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-zoom-in"
                title="크게보기"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.name}
                  className="w-7 h-7 shrink-0 rounded-lg object-cover"
                  style={{ background: "#f3f4f5" }}
                />
                <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: "#1A1C1E" }}>
                  {a.name}
                </span>
              </button>
            ) : (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 flex-1 min-w-0"
              >
                <span
                  className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(230,0,126,0.08)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E6007E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: "#1A1C1E" }}>
                  {a.name}
                </span>
              </a>
            )}
            <a
              href={a.url}
              download={a.name}
              rel="noopener noreferrer"
              title="다운로드"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.(a.url, a.name);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </li>
        ))}
      </ul>

      {/* 라이트박스 — drawer overflow 탈출용 portal */}
      {mounted && lightboxSrc && createPortal(
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 cursor-zoom-out"
          style={{ background: "rgba(0,0,0,0.85)", animation: "lightboxIn 200ms ease-out" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightboxSrc}
            download
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.(lightboxSrc, lightboxSrc.split("/").pop() ?? "");
            }}
            title="다운로드"
            className="absolute top-5 right-16 w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            title="닫기"
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full transition-colors hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function hasBodyAttachments(html: string | null | undefined): boolean {
  return extractAttachments(html).length > 0;
}

export function getBodyAttachments(html: string | null | undefined): Array<{ url: string; name: string; isImage: boolean }> {
  return extractAttachments(html);
}

function extractAttachments(html: string | null | undefined): Array<{ url: string; name: string; isImage: boolean }> {
  if (!html) return [];
  const found: Array<{ url: string; name: string; isImage: boolean }> = [];
  const seen = new Set<string>();
  // <a> 태그 매칭 (파일 링크)
  const aRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(html)) !== null) {
    const url = m[1];
    const inner = m[2];
    const text = inner.replace(/<[^>]*>/g, "").trim();
    const isAttachment =
      /^📎/.test(text) ||
      /\/partner_center\//.test(url) ||
      /\.(pdf|pptx?|xlsx?|docx?|hwp|zip|csv|txt|tsv|rtf|jpg|jpeg|png|gif|svg|webp|mp4|mov|avi)(\?|$)/i.test(url);
    if (!isAttachment) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const name = text.replace(/^📎\s*/, "") || urlBasename(url);
    found.push({ url, name, isImage: isImageUrl(url) });
  }
  // <img> 태그 매칭 (본문에 삽입된 이미지도 첨부로 표시)
  const imgRe = /<img[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    // alt 속성에서 파일명 추출
    const altMatch = /\balt="([^"]*)"/i.exec(m[0]);
    const name = (altMatch?.[1] || "").trim() || urlBasename(url);
    found.push({ url, name, isImage: true });
  }
  return found;
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|svg|webp|bmp|avif)(\?|$)/i.test(url);
}

function urlBasename(url: string): string {
  try {
    const path = new URL(url, "https://x").pathname;
    return decodeURIComponent(path.split("/").pop() || url);
  } catch {
    return url;
  }
}
