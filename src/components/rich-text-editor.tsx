"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Image } from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const EMOJIS = [
  "😀", "😄", "😅", "🤣", "😊", "😍", "🥰", "😎", "🤔", "😴",
  "👍", "👏", "🙏", "💪", "✌️", "👀", "💯", "🔥", "✨", "⚡️",
  "❤️", "💗", "💛", "💚", "💙", "💜", "🤍", "💔", "🌹", "🌸",
  "🎉", "🎊", "🎁", "🎂", "🥳", "🏆", "⭐️", "🌟", "💎", "👑",
  "✅", "❌", "⚠️", "❓", "❗️", "💡", "📌", "📎", "🔗", "📝",
  "📅", "🕐", "📞", "📧", "💬", "💭", "🗣️", "👋", "🙌", "🤝",
  "☕️", "🍵", "🍱", "🍕", "🍰", "🎂", "🌈", "☀️", "🌙", "⛅️",
];

const COLORS = [
  { label: "기본", value: "" },
  { label: "분홍", value: "#E6007E" },
  { label: "보라", value: "#5726E2" },
  { label: "파랑", value: "#2563eb" },
  { label: "초록", value: "#16a34a" },
  { label: "주황", value: "#ea580c" },
  { label: "빨강", value: "#dc2626" },
  { label: "회색", value: "#6b7280" },
];

/**
 * 공지/자료 등록·수정에 사용하는 리치 텍스트 에디터.
 * TipTap 기반. 출력은 HTML, 저장은 polyfill 없이 string 그대로 DB에 저장.
 *
 * Props:
 * - value: 초기 HTML
 * - onChange: HTML 변경 콜백
 * - name: 폼 submit에 함께 보낼 hidden input의 name (기본 "content")
 * - placeholder: 빈 상태 안내 문구
 */
export default function RichTextEditor({
  value = "",
  onChange,
  name = "content",
  placeholder = "내용을 입력해주세요",
}: {
  value?: string;
  onChange?: (html: string) => void;
  name?: string;
  placeholder?: string;
}) {
  const [html, setHtml] = useState<string>(value || "");
  // 호버 중인 이미지의 화면상 위치 (floating 삭제 버튼 표시용)
  const [hoverImage, setHoverImage] = useState<{
    img: HTMLImageElement;
    rect: DOMRect;
  } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Image.configure({
        HTMLAttributes: { class: "rounded-lg my-2 max-w-full" },
      }),
    ],
    content: value,
    immediatelyRender: false, // SSR 호환
    editorProps: {
      attributes: {
        class:
          "tiptap-content min-h-[160px] max-h-[400px] overflow-y-auto px-3.5 py-3 text-sm outline-none prose prose-sm max-w-none",
      },
    },
    onUpdate({ editor }) {
      const next = editor.getHTML();
      setHtml(next);
      onChange?.(next);
    },
  });

  // value prop 변경 시 에디터 동기화 (수정 모드 진입 등)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      setHtml(value || "");
    }
  }, [value, editor]);

  // 에디터 안 이미지 hover/leave → floating 삭제 버튼 위치 추적
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    function show(img: HTMLImageElement) {
      setHoverImage({ img, rect: img.getBoundingClientRect() });
    }
    function onOver(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "IMG") show(t as HTMLImageElement);
    }
    function onLeaveDom(e: MouseEvent) {
      // 에디터 영역 자체를 벗어나면 닫기 (이미지 → 버튼 사이 공간 이동은 유지)
      const next = e.relatedTarget as Node | null;
      if (next && (dom.contains(next) || (next as HTMLElement).closest?.("[data-rte-img-overlay]"))) return;
      setHoverImage(null);
    }
    dom.addEventListener("mouseover", onOver);
    dom.addEventListener("mouseleave", onLeaveDom);
    // 위치 업데이트 (스크롤/리사이즈 시 따라가도록)
    function reposition() {
      setHoverImage((cur) => {
        if (!cur) return cur;
        const r = cur.img.getBoundingClientRect();
        // 이미지가 에디터 영역 밖으로 나가면 숨김
        const editorRect = dom.getBoundingClientRect();
        if (r.bottom < editorRect.top || r.top > editorRect.bottom) return null;
        return { img: cur.img, rect: r };
      });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      dom.removeEventListener("mouseover", onOver);
      dom.removeEventListener("mouseleave", onLeaveDom);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [editor]);

  function deleteHoveredImage() {
    if (!editor || !hoverImage) return;
    const pos = editor.view.posAtDOM(hoverImage.img, 0);
    if (typeof pos === "number") {
      editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
    }
    setHoverImage(null);
  }

  if (!editor) return null;

  return (
    <div
      className="rounded-xl tiptap-editor-root"
      style={{ background: "#f8f9fa", border: "1px solid #e8e9ea" }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {/* form submit용 hidden input — controlled로 항상 최신 HTML 반영 */}
      <input type="hidden" name={name} value={html} readOnly />
      {/* 호버된 이미지의 floating 삭제 버튼 */}
      {hoverImage && typeof window !== "undefined" && createPortal(
        <button
          type="button"
          data-rte-img-overlay
          onMouseDown={(e) => e.preventDefault()}
          onClick={deleteHoveredImage}
          onMouseLeave={() => setHoverImage(null)}
          title="이미지 삭제"
          className="fixed z-[120] inline-flex items-center justify-center w-8 h-8 rounded-full text-white shadow-lg transition-transform hover:scale-105"
          style={{
            top: hoverImage.rect.top + 8,
            left: hoverImage.rect.right - 36,
            background: "rgba(220, 38, 38, 0.92)",
            backdropFilter: "blur(4px)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>,
        document.body,
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const colorBtnRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null);
  const [emojiPos, setEmojiPos] = useState<{ top: number; left: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File): Promise<{ url: string; name: string; isImage: boolean } | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "업로드에 실패했습니다.");
        return null;
      }
      return (await res.json()) as { url: string; name: string; isImage: boolean };
    } catch (e) {
      alert("업로드 중 오류가 발생했습니다.");
      console.error(e);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function uploadAllSerial(files: File[]) {
    // FileStation 동시 업로드 시 세션/폴더 충돌 방지 위해 순차 처리
    const out: Array<{ url: string; name: string; isImage: boolean }> = [];
    for (const f of files) {
      const r = await uploadFile(f);
      if (r?.url) out.push(r);
    }
    return out;
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = input.files ? Array.from(input.files) : [];
    input.value = "";
    if (files.length === 0) return;
    const results = await uploadAllSerial(files);
    const html = results
      .map((r) => `<p><img src="${r.url}" alt="${escapeAttr(r.name)}" /></p>`)
      .join("");
    if (html) {
      editor.chain().focus().insertContent(html).run();
    }
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = input.files ? Array.from(input.files) : [];
    input.value = "";
    if (files.length === 0) return;
    const results = await uploadAllSerial(files);
    const html = results
      .map((r) => `<p><a href="${r.url}" target="_blank" rel="noopener noreferrer">📎 ${escapeAttr(r.name)}</a></p>`)
      .join("");
    if (html) {
      editor.chain().focus().insertContent(html).run();
    }
  }

  function escapeAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 팝업: 버튼 중앙에 정렬 + viewport 양 끝 8px 안쪽으로 클램프
  function centerOnButton(rect: DOMRect, popWidth: number) {
    const center = rect.left + rect.width / 2;
    const ideal = center - popWidth / 2;
    const min = 8;
    const max = window.innerWidth - popWidth - 8;
    return { top: rect.bottom + 4, left: Math.max(min, Math.min(max, ideal)) };
  }
  useEffect(() => {
    if (!colorOpen || !colorBtnRef.current) return;
    setColorPos(centerOnButton(colorBtnRef.current.getBoundingClientRect(), 260));
  }, [colorOpen]);
  useEffect(() => {
    if (!emojiOpen || !emojiBtnRef.current) return;
    setEmojiPos(centerOnButton(emojiBtnRef.current.getBoundingClientRect(), 280));
  }, [emojiOpen]);

  // 외부 클릭으로 팝업 닫기
  useEffect(() => {
    if (!colorOpen && !emojiOpen) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (colorBtnRef.current?.contains(t) || emojiBtnRef.current?.contains(t)) return;
      const popovers = document.querySelectorAll("[data-rte-popover]");
      for (const p of popovers) if (p.contains(t)) return;
      setColorOpen(false);
      setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [colorOpen, emojiOpen]);

  const btn = (active: boolean) =>
    "min-w-7 h-7 px-2 inline-flex items-center justify-center rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors hover:bg-gray-100 " +
    (active ? "text-[#E6007E] bg-[rgba(230,0,126,0.08)]" : "text-[#4F4F4F]");

  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) ?? "";

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 flex-wrap"
      style={{ borderBottom: "1px solid #e8e9ea" }}
    >
      <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={btn(false)} title="본문으로 변경">
        본문
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))} title="제목 1">
        H1
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))} title="제목 2">
        H2
      </button>
      <Divider />
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} title="굵게 (Ctrl+B)">
        B
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} title="기울임 (Ctrl+I)">
        I
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))} title="밑줄 (Ctrl+U)">
        U
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))} title="취소선">
        S
      </button>
      <Divider />
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))} title="불릿 리스트">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" />
        </svg>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))} title="번호 리스트">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
          <path d="M4 6h1v4M4 10h2M6 18H4l2-2v0a1 1 0 10-2-1" />
        </svg>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))} title="인용">
        ❝
      </button>
      <Divider />
      <button
        type="button"
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("링크 URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
        className={btn(editor.isActive("link"))}
        title="링크"
      >
        🔗
      </button>
      <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={btn(false)} title="서식 지우기">
        ⌫
      </button>

      {/* 이미지 업로드 */}
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        disabled={uploading}
        className={btn(false) + " disabled:opacity-50"}
        title="이미지 첨부"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </button>
      <input ref={imageInputRef} type="file" accept="image/*" hidden multiple onChange={handleImagePick} />

      {/* 파일 첨부 */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={btn(false) + " disabled:opacity-50"}
        title="파일 첨부"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <input ref={fileInputRef} type="file" hidden multiple onChange={handleFilePick} />

      {/* 색상 */}
      <div ref={colorBtnRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => { setColorOpen((v) => !v); setEmojiOpen(false); }}
          className={btn(colorOpen) + " gap-1"}
          title="글자 색상"
        >
          <span style={{ borderBottom: `3px solid ${currentColor || "#1A1C1E"}`, paddingBottom: "1px", lineHeight: 1 }}>A</span>
        </button>
        {colorOpen && colorPos && typeof window !== "undefined" && createPortal(
          <div
            data-rte-popover
            className="fixed z-[100] flex items-center gap-1.5 p-2 rounded-lg shadow-lg bg-white"
            style={{
              top: colorPos.top,
              left: colorPos.left,
              border: "1px solid #e8e9ea",
            }}
          >
            {COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (c.value) editor.chain().focus().setColor(c.value).run();
                  else editor.chain().focus().unsetColor().run();
                  setColorOpen(false);
                }}
                title={c.label}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                style={{
                  background: c.value || "#ffffff",
                  border: c.value ? "none" : "1.5px solid #e8e9ea",
                  outline: currentColor === c.value ? `2px solid ${c.value || "#9ca3af"}` : "none",
                  outlineOffset: "2px",
                  color: c.value ? "#ffffff" : "#9ca3af",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                {!c.value && "✕"}
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>

      {/* 이모지 */}
      <div ref={emojiBtnRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => { setEmojiOpen((v) => !v); setColorOpen(false); }}
          className={btn(emojiOpen)}
          title="이모지"
        >
          😀
        </button>
        {emojiOpen && emojiPos && typeof window !== "undefined" && createPortal(
          <div
            data-rte-popover
            className="fixed z-[100] p-2 rounded-lg shadow-lg bg-white"
            style={{
              top: emojiPos.top,
              left: emojiPos.left,
              border: "1px solid #e8e9ea",
              width: "260px",
            }}
          >
            <div className="flex flex-wrap gap-0.5">
              {EMOJIS.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().insertContent(e).run();
                    setEmojiOpen(false);
                  }}
                  className="w-6 h-6 shrink-0 inline-flex items-center justify-center rounded hover:bg-gray-100"
                  style={{ fontSize: "16px", lineHeight: 1 }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-4 mx-0.5" style={{ background: "#e8e9ea" }} />;
}
