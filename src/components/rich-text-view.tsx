"use client";

import DOMPurify from "isomorphic-dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 저장된 HTML(에디터 출력)을 안전하게 렌더.
 * sanitize-html로 XSS 차단 + 이미지 클릭 시 라이트박스 + 호버 다운로드.
 */
export default function RichTextView({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const safe = useMemo(() => {
    if (!html) return "";
    // 자료실 등록 시 dropzone에 추가된 추가 파일은 data-attachment 마커를 달아둠 —
    // 본문 렌더에서는 숨기고(AttachmentsList가 보여줌) 중복 방지.
    const stripped = html.replace(
      /<(p|div)[^>]*data-attachment[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    );
    return DOMPurify.sanitize(stripped, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "u", "s", "del", "ins",
        "h1", "h2", "h3", "h4",
        "ul", "ol", "li",
        "blockquote", "code", "pre",
        "a", "span", "div",
        "img",
        "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "src", "alt", "title", "style", "data-attachment"],
    });
  }, [html]);

  // 이미지에 zoom-in 커서 클래스만 부여 (다운로드 오버레이는 라이트박스에서 처리)
  useEffect(() => {
    if (!containerRef.current) return;
    const root = containerRef.current;
    const imgs = root.querySelectorAll<HTMLImageElement>("img");
    imgs.forEach((img) => {
      if (img.parentElement?.classList.contains("rtv-img-wrap")) return;
      const wrap = document.createElement("span");
      wrap.className = "rtv-img-wrap";
      img.parentNode?.insertBefore(wrap, img);
      wrap.appendChild(img);
    });
  }, [safe]);

  // 이벤트 위임: 컨테이너 클릭 → 이미지 클릭이면 lightbox 열기
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const img = t.closest<HTMLImageElement>("img");
      if (!img) return;
      e.preventDefault();
      setLightboxSrc(img.src);
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  if (!safe) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={`tiptap-content prose prose-sm max-w-none ${className ?? ""}`}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
      {lightboxSrc && typeof window !== "undefined" && createPortal(
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />,
        document.body,
      )}
    </>
  );
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-[lightboxIn_0.2s_ease-out]"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      {/* 닫기 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="fixed top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      {/* 다운로드 */}
      <a
        href={src}
        download
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="다운로드"
        className="fixed top-4 right-16 w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
      {/* 큰 이미지 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}
