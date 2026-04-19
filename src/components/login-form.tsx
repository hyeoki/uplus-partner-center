"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REMEMBER_KEY = "uplus-partner:remembered-loginId";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [remember, setRemember] = useState(false);

  // 마운트 시 localStorage에서 저장된 아이디 불러오기
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setLoginId(saved);
      setRemember(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const id = String(formData.get("loginId") ?? "");

    // 체크 상태에 따라 localStorage 저장/삭제
    if (typeof window !== "undefined") {
      if (remember && id) {
        window.localStorage.setItem(REMEMBER_KEY, id);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
    }

    const result = await signIn("credentials", {
      loginId: id,
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // NextAuth v5: throw 한 CredentialsSignin 의 code 는 result.code 또는 ?code= 쿼리로 전달
      const code = (result as { code?: string }).code;
      const urlCode = result.url ? new URL(result.url, window.location.origin).searchParams.get("code") : null;
      if (code === "role_denied" || urlCode === "role_denied") {
        setError("대리점/파트너 계정만 이용 가능합니다.");
      } else {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      }
    } else {
      router.push("/home");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ID Field */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "#1A1C1E" }}>
          아이디
        </label>
        <input
          name="loginId"
          type="text"
          placeholder="아이디를 입력하세요"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          onFocus={() => setFocused("loginId")}
          onBlur={() => setFocused(null)}
          className="w-full h-11 rounded-lg px-3 text-sm outline-none transition-all"
          style={{
            background: focused === "loginId" ? "#ffffff" : "#f3f4f5",
            color: "#1A1C1E",
            boxShadow: focused === "loginId" ? "0 0 0 3px rgba(230,0,126,0.18)" : "none",
          }}
          required
        />
      </div>

      {/* Password Field */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "#1A1C1E" }}>
          비밀번호
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호를 입력하세요"
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            className="w-full h-11 rounded-lg pl-3 pr-10 text-sm outline-none transition-all"
            style={{
              background: focused === "password" ? "#ffffff" : "#f3f4f5",
              color: "#1A1C1E",
              boxShadow: focused === "password" ? "0 0 0 3px rgba(230,0,126,0.18)" : "none",
            }}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "#9ca3af" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#E6007E")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
          >
            {showPassword ? (
              // eye-off
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a19.5 19.5 0 015.06-5.94" />
                <path d="M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a19.5 19.5 0 01-3.17 4.19" />
                <path d="M14.12 14.12A3 3 0 119.88 9.88" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // eye
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 좌: 아이디 기억하기 / 우: 계정 문의 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#4F4F4F" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: "#E6007E" }}
          />
          아이디 기억하기
        </label>
        <a
          href="https://www.hi-rtk.io/#/main/consult"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors hover:text-[#E6007E]"
          style={{ color: "#9ca3af" }}
        >
          계정 문의 &rsaquo;
        </a>
      </div>

      {error && <p className="text-xs" style={{ color: "#E6007E" }}>{error}</p>}

      {/* Primary CTA — Precision Gradient */}
      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
        style={{
          background: "#E6007E",
          color: "#ffffff",
          fontFamily: "var(--font-display)",
        }}
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
