"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
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
  const hiddenRef = useRef<HTMLInputElement>(null);

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
      const html = editor.getHTML();
      if (hiddenRef.current) hiddenRef.current.value = html;
      onChange?.(html);
    },
  });

  // value prop 변경 시 에디터 동기화 (수정 모드 진입 등)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      if (hiddenRef.current) hiddenRef.current.value = value || "";
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className="rounded-xl tiptap-editor-root"
      style={{ background: "#f8f9fa", border: "1px solid #e8e9ea" }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {/* form submit용 hidden input */}
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={value} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const colorBtnRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLDivElement>(null);
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null);
  const [emojiPos, setEmojiPos] = useState<{ top: number; left: number } | null>(null);

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
