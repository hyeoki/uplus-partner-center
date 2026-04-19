"use client";

import DOMPurify from "isomorphic-dompurify";
import { useMemo } from "react";

/**
 * 저장된 HTML(에디터 출력)을 안전하게 렌더.
 * sanitize-html로 XSS 차단.
 */
export default function RichTextView({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safe = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "u", "s", "del", "ins",
        "h1", "h2", "h3", "h4",
        "ul", "ol", "li",
        "blockquote", "code", "pre",
        "a", "span", "div",
        "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    });
  }, [html]);

  if (!safe) return null;

  return (
    <div
      className={`tiptap-content prose prose-sm max-w-none ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
